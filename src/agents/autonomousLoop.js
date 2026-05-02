import { ethers } from 'ethers';
import { createLogger } from '../utils/logger.js';

const log = createLogger('autonomous-loop');

// Token ID map for DefiLlama price API
const TOKEN_IDS = {
  ETH:   'coingecko:ethereum',
  ARB:   'coingecko:arbitrum',
  USDC:  'coingecko:usd-coin',
  USDT:  'coingecko:tether',
  WBTC:  'coingecko:wrapped-bitcoin',
  GMX:   'coingecko:gmx',
  LINK:  'coingecko:chainlink',
  PENDLE:'coingecko:pendle',
  DAI:   'coingecko:dai'
};

export class AutonomousLoop {
  constructor(agent) {
    this.agent      = agent;
    this.running    = false;
    this.paused     = false;
    this.cycleCount = 0;
    this.logs       = [];
    this.handlers   = {};
    this._timer     = null;

    // Circuit breaker
    this._consecutiveErrors = 0;
    this._maxConsecutiveErrors = 5;

    // Price history for volatility
    this._priceHistory = {};
  }

  on(event, fn) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(fn);
    return this;
  }

  off(event, fn) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== fn);
    }
  }

  _emit(event, data) {
    const entry = { event, ts: new Date().toISOString(), ...data };
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs = this.logs.slice(-200);
    (this.handlers[event] || []).forEach(fn => { try { fn(entry); } catch {} });
    (this.handlers['*']   || []).forEach(fn => { try { fn(entry); } catch {} });
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  start(config = {}) {
    if (this.running) throw new Error('Loop already running');

    this.config = {
      intervalMs:         config.intervalMs         || 30_000,
      maxCycles:          config.maxCycles          || Infinity,
      maxTradeSizeEth:    config.maxTradeSizeEth    || 0.01,
      stopLossPct:        config.stopLossPct        || 5,
      takeProfitPct:      config.takeProfitPct      || 10,
      dryRun:             config.dryRun !== false,
      tokens:             config.tokens             || ['ETH', 'ARB', 'USDC'],
      strategy:           config.strategy           || 'balanced',
      maxConsecutiveErrors: config.maxConsecutiveErrors || 5,
      dynamicSlippage:    config.dynamicSlippage !== false
    };

    this._maxConsecutiveErrors = this.config.maxConsecutiveErrors;
    this._consecutiveErrors    = 0;
    this.running    = true;
    this.paused     = false;
    this.cycleCount = 0;

    this._emit('start', { config: this.config, agent: this.agent.name, dryRun: this.config.dryRun });
    log.info('Autonomous loop started', { agent: this.agent.name, dryRun: this.config.dryRun });
    this._schedule();
    return this;
  }

  stop() {
    this.running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._emit('stop', { cycles: this.cycleCount, errors: this._consecutiveErrors });
    log.info('Autonomous loop stopped', { agent: this.agent.name, cycles: this.cycleCount });
  }

  pause()  {
    this.paused = true;
    this._emit('cycle', { type: 'paused' });
    log.info('Loop paused', { agent: this.agent.name });
  }

  resume() {
    this.paused = false;
    this._consecutiveErrors = 0;
    this._emit('cycle', { type: 'resumed' });
    log.info('Loop resumed', { agent: this.agent.name });
    this._schedule();
  }

  getStatus() {
    return {
      running:           this.running,
      paused:            this.paused,
      cycles:            this.cycleCount,
      dryRun:            this.config?.dryRun ?? true,
      strategy:          this.config?.strategy,
      tokens:            this.config?.tokens,
      consecutiveErrors: this._consecutiveErrors,
      circuitBreaker:    this._consecutiveErrors >= this._maxConsecutiveErrors,
      recentLogs:        this.logs.slice(-20)
    };
  }

  // ── Main Cycle ────────────────────────────────────────────────────────────

  async _cycle() {
    if (!this.running || this.paused) return;

    // Circuit breaker
    if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
      this._emit('error', {
        type:    'circuit_breaker',
        message: `Circuit breaker tripped after ${this._consecutiveErrors} consecutive errors. Loop paused.`,
        note:    'Call resume() to reset and continue'
      });
      log.warn('Circuit breaker tripped', { agent: this.agent.name, errors: this._consecutiveErrors });
      this.paused = true;
      return;
    }

    this.cycleCount++;
    this._emit('cycle', { count: this.cycleCount, dryRun: this.config.dryRun });

    try {
      const [marketData, walletData] = await Promise.all([
        this._gatherMarketData(),
        this._gatherWalletData()
      ]);

      this._updatePriceHistory(marketData.prices);

      const volatility = this._computeVolatility();
      const decision   = await this._think(marketData, walletData, volatility);

      this._emit('decision', {
        cycle:      this.cycleCount,
        thought:    decision.thought,
        action:     decision.action,
        reasoning:  decision.reasoning,
        risk:       decision.risk,
        confidence: decision.confidence,
        dryRun:     this.config.dryRun
      });

      if (decision.action && !['wait', 'error'].includes(decision.action)) {
        await this._executeDecision(decision, marketData, volatility);
      }

      this._consecutiveErrors = 0;

    } catch (err) {
      this._consecutiveErrors++;
      this._emit('error', {
        cycle:  this.cycleCount,
        error:  err.message,
        consecutiveErrors: this._consecutiveErrors
      });
      log.error('Cycle error', { agent: this.agent.name, error: err.message });
    }

    if (this.running && this.cycleCount < this.config.maxCycles) {
      this._schedule();
    } else if (this.cycleCount >= this.config.maxCycles) {
      this.stop();
    }
  }

  _schedule() {
    this._timer = setTimeout(() => this._cycle(), this.config?.intervalMs || 30_000);
  }

  // ── Price History & Volatility ────────────────────────────────────────────

  _updatePriceHistory(prices) {
    const now = Date.now();
    for (const [sym, data] of Object.entries(prices)) {
      if (!this._priceHistory[sym]) this._priceHistory[sym] = [];
      this._priceHistory[sym].push({ ts: now, price: data.price });
      // Keep last 20 data points
      if (this._priceHistory[sym].length > 20) {
        this._priceHistory[sym] = this._priceHistory[sym].slice(-20);
      }
    }
  }

  _computeVolatility() {
    const result = {};
    for (const [sym, history] of Object.entries(this._priceHistory)) {
      if (history.length < 2) { result[sym] = 'unknown'; continue; }
      const prices = history.map(h => h.price);
      const avg   = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
      const stdDev   = Math.sqrt(variance);
      const cv       = avg > 0 ? (stdDev / avg) * 100 : 0;
      result[sym] = cv < 1 ? 'low' : cv < 3 ? 'medium' : 'high';
    }
    return result;
  }

  _dynamicSlippage(volatility, tokenIn) {
    if (!this.config.dynamicSlippage) return 50;
    const vol = volatility[tokenIn] || 'medium';
    if (vol === 'low')    return 30;
    if (vol === 'medium') return 60;
    return 100; // high volatility — wider slippage tolerance
  }

  // ── Market Data ───────────────────────────────────────────────────────────

  async _gatherMarketData() {
    const data = { prices: {}, timestamp: new Date().toISOString() };
    try {
      const tokens = this.config.tokens.filter(t => TOKEN_IDS[t]);
      if (tokens.length === 0) return data;

      const ids = tokens.map(t => TOKEN_IDS[t]).join(',');
      const res  = await fetch(`https://coins.llama.fi/prices/current/${ids}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error(`DefiLlama responded with ${res.status}`);
      const json = await res.json();

      for (const sym of tokens) {
        const coin = json.coins?.[TOKEN_IDS[sym]];
        if (coin) data.prices[sym] = { price: coin.price, confidence: coin.confidence };
      }
    } catch (err) {
      this._emit('error', {
        type:  'market_data_fetch',
        error: err.message,
        note:  'Proceeding with empty price data'
      });
    }
    return data;
  }

  async _gatherWalletData() {
    const data = { connected: false, balances: {}, address: null };
    if (!this.agent.signer) return data;

    try {
      const exec = this.agent.executor;
      if (!exec) return data;

      const address   = await this.agent.signer.getAddress();
      const portfolio = await exec.getPortfolio(address);

      data.connected    = true;
      data.address      = address;
      data.balances.ETH = portfolio.ETH?.formatted || '0';
      for (const [sym, info] of Object.entries(portfolio.tokens || {})) {
        data.balances[sym] = info.formatted;
      }
    } catch (err) {
      this._emit('error', {
        type:  'wallet_data_fetch',
        error: err.message,
        note:  'Proceeding without wallet balances'
      });
    }
    return data;
  }

  // ── AI Decision ───────────────────────────────────────────────────────────

  async _think(marketData, walletData, volatility) {
    const strategyContext = this._buildStrategyContext();
    const prompt = `You are running an autonomous ${this.agent.type} agent on Arbitrum.
Strategy: ${this.config.strategy}
DRY RUN: ${this.config.dryRun}
Max trade size: ${this.config.maxTradeSizeEth} ETH
Stop loss: ${this.config.stopLossPct}%  |  Take profit: ${this.config.takeProfitPct}%

Market prices (${marketData.timestamp}):
${JSON.stringify(marketData.prices, null, 2)}

Market volatility: ${JSON.stringify(volatility)}

Wallet balances: ${JSON.stringify(walletData.balances)}
Wallet connected: ${walletData.connected}

${strategyContext}

Based on the market state and strategy, decide what action to take.

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "thought": "concise market analysis (max 200 chars)",
  "action": "wait|swap|rebalance|info",
  "reasoning": "why this decision (max 200 chars)",
  "parameters": {
    "tokenIn": "ETH",
    "tokenOut": "USDC",
    "amountIn": "0.001"
  },
  "risk": "low|medium|high",
  "confidence": 0.85
}

RULES:
- Only suggest swap if amountIn <= ${this.config.maxTradeSizeEth} ETH equivalent
- If confidence < 0.5 or data is incomplete → action = "wait"
- NEVER suggest more than ${this.config.maxTradeSizeEth} ETH in a single trade
- Interest-free mode: ${this.agent.interestFreeMode} — if true, never suggest lending/borrowing`;

    return await this.agent.think(prompt);
  }

  _buildStrategyContext() {
    const engine = this.agent.strategyEngine;
    if (!engine || engine.strategies.size === 0) return '';
    const strategies = [...engine.strategies.values()];
    const active = strategies.filter(s => s.status === 'active');
    if (active.length === 0) return '';
    return `Active strategies (${active.length}):
${active.map(s => `- ${s.type}: ${JSON.stringify(s.trigger)}`).join('\n')}`;
  }

  // ── Decision Execution ────────────────────────────────────────────────────

  async _executeDecision(decision, marketData, volatility) {
    const params = decision.parameters || {};

    if (decision.action === 'swap') {
      await this._handleSwap(params, decision, volatility);
    } else if (decision.action === 'rebalance') {
      await this._handleRebalance(params, decision);
    } else if (decision.action === 'info') {
      this._emit('action', { type: 'info', message: decision.reasoning, thought: decision.thought });
    }
  }

  async _handleSwap(params, decision, volatility = {}) {
    if (!params.tokenIn || !params.tokenOut || !params.amountIn) {
      this._emit('error', { message: 'Swap parameters incomplete', params });
      return;
    }

    const slippageBps = params.slippageBps || this._dynamicSlippage(volatility, params.tokenIn);

    if (this.config.dryRun) {
      this._emit('action', {
        type:       'swap',
        mode:       'simulation',
        tokenIn:    params.tokenIn,
        tokenOut:   params.tokenOut,
        amountIn:   params.amountIn,
        slippageBps,
        reasoning:  decision.reasoning,
        risk:       decision.risk,
        confidence: decision.confidence,
        note:       'DRY RUN — no real transaction executed'
      });
      return;
    }

    if (!this.agent.signer || !this.agent.executor) {
      this._emit('error', { message: 'No wallet connected for live trading' });
      return;
    }

    // Policy check
    try {
      this.agent.policy?.check({
        type: 'swap',
        tokenIn:  params.tokenIn,
        tokenOut: params.tokenOut,
        amountEth: parseFloat(params.amountIn),
        slippageBps
      });
    } catch (policyErr) {
      this._emit('error', { type: 'policy_violation', code: policyErr.code, error: policyErr.message });
      return;
    }

    try {
      const result = await this.agent.executor.executeSwap(this.agent.signer, {
        tokenInSymbol:  params.tokenIn,
        tokenOutSymbol: params.tokenOut,
        amountIn:       params.amountIn,
        slippageBps
      });

      this.agent.policy?.record(params.amountIn);

      this._emit('action', {
        type:       'swap',
        mode:       'live',
        result,
        reasoning:  decision.reasoning,
        risk:       decision.risk,
        confidence: decision.confidence,
        slippageBps
      });
    } catch (err) {
      this._emit('error', { type: 'swap_failed', error: err.message });
    }
  }

  async _handleRebalance(params, decision) {
    const targets = params.targets || {};
    if (Object.keys(targets).length === 0) {
      this._emit('action', { type: 'rebalance', mode: 'no_targets', note: 'No rebalance targets set' });
      return;
    }

    if (this.config.dryRun) {
      this._emit('action', { type: 'rebalance', mode: 'simulation', targets, reasoning: decision.reasoning, note: 'DRY RUN' });
      return;
    }

    try {
      const result = await this.agent.strategyEngine._executeRebalance(targets);
      this._emit('action', { type: 'rebalance', mode: 'live', result, reasoning: decision.reasoning });
    } catch (err) {
      this._emit('error', { type: 'rebalance_failed', error: err.message });
    }
  }
}
