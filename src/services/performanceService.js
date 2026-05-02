/**
 * PerformanceService — per-agent P&L, ROI, trade history, strategy metrics.
 *
 * Ledger entry shape:
 * {
 *   id, timestamp, type,           // 'trade'|'strategy_trigger'|'event_response'|'ai_decision'
 *   token, side,                   // 'BUY'|'SELL'|null
 *   amountToken, amountUSD,        // size in token & USD
 *   priceUSD,                      // execution price
 *   pnl, roi,                      // realized P&L for completed round-trips
 *   strategyId, strategyType,      // if triggered by strategy
 *   txHash, dryRun,                // on-chain ref
 *   note                           // free-text
 * }
 */
import path from 'path';
import fs   from 'fs';
import { createLogger } from '../utils/logger.js';

const log = createLogger('performanceService');

// ── Storage ───────────────────────────────────────────────────────────────────

function ledgerDir() {
  const home = process.env.HOME || process.cwd();
  const dir  = path.join(home, '.arb-agent', 'performance');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ledgerFile(agentName) {
  return path.join(ledgerDir(), `${agentName}.json`);
}

function loadLedger(agentName) {
  const file = ledgerFile(agentName);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch(e) { log.warn('Failed to load ledger', { agentName, err: e.message }); return []; }
}

function saveLedger(agentName, entries) {
  const file = ledgerFile(agentName);
  const tmp  = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, file);
}

// ── P&L Engine ────────────────────────────────────────────────────────────────

/**
 * Average-cost P&L calculator per token (FIFO-style avg cost).
 * Returns realized P&L for a SELL given open BUY positions.
 */
class CostBasisTracker {
  constructor() {
    this.positions = {}; // token → { totalCost, totalAmount }
  }

  buy(token, amount, price) {
    if (!this.positions[token]) this.positions[token] = { totalCost: 0, totalAmount: 0 };
    const pos = this.positions[token];
    pos.totalCost   += amount * price;
    pos.totalAmount += amount;
  }

  sell(token, amount, price) {
    const pos = this.positions[token];
    if (!pos || pos.totalAmount <= 0) return 0;
    const avgCost    = pos.totalCost / pos.totalAmount;
    const sellAmount = Math.min(amount, pos.totalAmount);
    const realized   = (price - avgCost) * sellAmount;
    const fraction   = sellAmount / pos.totalAmount;
    pos.totalCost   -= pos.totalCost   * fraction;
    pos.totalAmount -= sellAmount;
    return realized;
  }

  avgCost(token) {
    const pos = this.positions[token];
    if (!pos || pos.totalAmount <= 0) return null;
    return pos.totalCost / pos.totalAmount;
  }

  openPositions() {
    return Object.entries(this.positions)
      .filter(([, p]) => p.totalAmount > 0)
      .map(([token, p]) => ({ token, amount: p.totalAmount, avgCost: p.totalCost / p.totalAmount }));
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const performanceService = {

  // ── Log a trade entry ────────────────────────────────────────────────────────

  logTrade(agentName, { token, side, amountToken, amountUSD, priceUSD = 0,
                        strategyId = null, strategyType = null,
                        txHash = null, dryRun = true, note = '' }) {
    const entries = loadLedger(agentName);
    const entry = {
      id:           `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      timestamp:    new Date().toISOString(),
      type:         'trade',
      token:        token.toUpperCase(),
      side:         side.toUpperCase(),
      amountToken:  parseFloat(amountToken) || 0,
      amountUSD:    parseFloat(amountUSD)   || 0,
      priceUSD:     parseFloat(priceUSD)    || 0,
      pnl:          null, // filled in for SELL
      roi:          null,
      strategyId,
      strategyType,
      txHash,
      dryRun,
      note
    };

    // Calculate realized P&L for sells
    if (side.toUpperCase() === 'SELL') {
      const tracker = this._rebuildTracker(entries);
      entry.pnl = tracker.sell(token.toUpperCase(), entry.amountToken, priceUSD);
      const invested = entry.amountToken * (tracker.avgCost(token.toUpperCase()) || priceUSD);
      entry.roi = invested > 0 ? (entry.pnl / invested) * 100 : 0;
    }

    entries.push(entry);
    saveLedger(agentName, entries);
    log.info('Trade logged', { agentName, side, token, amountUSD: entry.amountUSD });
    return entry;
  },

  // ── Log strategy trigger ─────────────────────────────────────────────────────

  logStrategyTrigger(agentName, { strategyId, strategyType, token, outcome, note = '' }) {
    const entries = loadLedger(agentName);
    const entry = {
      id:           `s_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      timestamp:    new Date().toISOString(),
      type:         'strategy_trigger',
      token:        token?.toUpperCase() || null,
      side:         null,
      amountToken:  null,
      amountUSD:    null,
      priceUSD:     null,
      pnl:          null,
      roi:          null,
      strategyId,
      strategyType,
      txHash:       null,
      dryRun:       true,
      note:         outcome ? `${outcome} — ${note}` : note
    };
    entries.push(entry);
    saveLedger(agentName, entries);
    return entry;
  },

  // ── Log AI decision ──────────────────────────────────────────────────────────

  logAiDecision(agentName, { action, reasoning, token = null, confidence = null }) {
    const entries = loadLedger(agentName);
    const entry = {
      id:        `a_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      timestamp: new Date().toISOString(),
      type:      'ai_decision',
      token, side: null,
      amountToken: null, amountUSD: null, priceUSD: null,
      pnl: null, roi: null,
      strategyId: null, strategyType: null, txHash: null, dryRun: true,
      note: `action=${action} | confidence=${confidence ?? '?'} | ${(reasoning||'').slice(0,120)}`
    };
    entries.push(entry);
    saveLedger(agentName, entries);
    return entry;
  },

  // ── Summary ──────────────────────────────────────────────────────────────────

  getSummary(agentName) {
    const entries  = loadLedger(agentName);
    const trades   = entries.filter(e => e.type === 'trade');
    const sells    = trades.filter(e => e.side === 'SELL' && e.pnl !== null);
    const buys     = trades.filter(e => e.side === 'BUY');

    const totalInvested  = buys.reduce((s, e) => s + (e.amountUSD || 0), 0);
    const totalRealized  = sells.reduce((s, e) => s + (e.pnl || 0), 0);
    const wins           = sells.filter(e => (e.pnl || 0) > 0).length;
    const losses         = sells.filter(e => (e.pnl || 0) < 0).length;
    const winRate        = sells.length > 0 ? (wins / sells.length) * 100 : 0;
    const roi            = totalInvested > 0 ? (totalRealized / totalInvested) * 100 : 0;

    const bestTrade  = sells.reduce((best, e) => (!best || e.pnl > best.pnl) ? e : best, null);
    const worstTrade = sells.reduce((worst, e) => (!worst || e.pnl < worst.pnl) ? e : worst, null);

    // Strategy breakdown
    const byStrategy = {};
    for (const e of entries.filter(e => e.strategyType)) {
      const k = e.strategyType;
      if (!byStrategy[k]) byStrategy[k] = { count: 0, pnl: 0 };
      byStrategy[k].count++;
      byStrategy[k].pnl += e.pnl || 0;
    }

    return {
      agentName,
      totalEntries:    entries.length,
      totalTrades:     trades.length,
      buyCount:        buys.length,
      sellCount:       sells.length,
      winCount:        wins,
      lossCount:       losses,
      winRate:         +winRate.toFixed(2),
      totalInvestedUSD: +totalInvested.toFixed(2),
      totalRealizedPnL: +totalRealized.toFixed(2),
      roi:             +roi.toFixed(2),
      bestTrade:       bestTrade ? { pnl: +bestTrade.pnl.toFixed(2), token: bestTrade.token, ts: bestTrade.timestamp } : null,
      worstTrade:      worstTrade ? { pnl: +worstTrade.pnl.toFixed(2), token: worstTrade.token, ts: worstTrade.timestamp } : null,
      byStrategy,
      openPositions:   this._rebuildTracker(entries).openPositions(),
      lastUpdated:     new Date().toISOString()
    };
  },

  // ── History ──────────────────────────────────────────────────────────────────

  getHistory(agentName, limit = 50, typeFilter = null) {
    const entries = loadLedger(agentName);
    let filtered  = entries.slice().reverse(); // newest first
    if (typeFilter) filtered = filtered.filter(e => e.type === typeFilter);
    return filtered.slice(0, limit);
  },

  // ── Daily P&L breakdown ──────────────────────────────────────────────────────

  getDailyPnL(agentName, days = 30) {
    const entries = loadLedger(agentName);
    const sells   = entries.filter(e => e.type === 'trade' && e.side === 'SELL' && e.pnl !== null);
    const cutoff  = new Date(Date.now() - days * 86400_000);

    const daily = {};
    for (const e of sells) {
      const d = e.timestamp.slice(0, 10);
      if (new Date(d) < cutoff) continue;
      if (!daily[d]) daily[d] = { date: d, pnl: 0, trades: 0 };
      daily[d].pnl    += e.pnl;
      daily[d].trades += 1;
    }

    return Object.values(daily)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, pnl: +d.pnl.toFixed(2) }));
  },

  // ── Reset ────────────────────────────────────────────────────────────────────

  reset(agentName) {
    saveLedger(agentName, []);
    log.info('Performance ledger reset', { agentName });
    return { reset: true };
  },

  // ── Internal: rebuild cost-basis tracker from existing entries ────────────────

  _rebuildTracker(entries) {
    const tracker = new CostBasisTracker();
    for (const e of entries) {
      if (e.type !== 'trade' || !e.token) continue;
      if (e.side === 'BUY')  tracker.buy(e.token, e.amountToken || 0, e.priceUSD || 0);
      if (e.side === 'SELL') tracker.sell(e.token, e.amountToken || 0, e.priceUSD || 0);
    }
    return tracker;
  }
};
