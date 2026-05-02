import { ethers } from 'ethers';

const LOOP_EVENTS = ['start', 'stop', 'decision', 'action', 'error', 'cycle'];

export class AutonomousLoop {
  constructor(agent) {
    this.agent   = agent;
    this.running = false;
    this.paused  = false;
    this.cycleCount = 0;
    this.logs    = [];
    this.handlers = {};
    this._timer  = null;
  }

  on(event, fn) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(fn);
    return this;
  }

  _emit(event, data) {
    const entry = { event, ts: new Date().toISOString(), ...data };
    this.logs.push(entry);
    (this.handlers[event] || []).forEach(fn => fn(entry));
    (this.handlers['*'] || []).forEach(fn => fn(entry));
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  start(config = {}) {
    if (this.running) throw new Error('Loop already running');

    this.config = {
      intervalMs:    config.intervalMs    || 30_000,   // 30s default
      maxCycles:     config.maxCycles     || Infinity,
      maxTradeSizeEth: config.maxTradeSizeEth || 0.01, // Safety limit
      stopLossPct:   config.stopLossPct   || 5,        // 5% stop-loss
      takeProfitPct: config.takeProfitPct || 10,       // 10% take-profit
      dryRun:        config.dryRun !== false,           // DRY RUN by default
      tokens:        config.tokens        || ['ETH', 'ARB', 'USDC'],
      strategy:      config.strategy      || 'balanced'
    };

    this.running = true;
    this.paused  = false;
    this.cycleCount = 0;
    this._emit('start', {
      config: this.config,
      agent:  this.agent.name,
      dryRun: this.config.dryRun
    });

    this._schedule();
    return this;
  }

  stop() {
    this.running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._emit('stop', { cycles: this.cycleCount });
  }

  pause()  { this.paused = true;  this._emit('cycle', { type: 'paused' }); }
  resume() { this.paused = false; this._emit('cycle', { type: 'resumed' }); this._schedule(); }

  getStatus() {
    return {
      running:    this.running,
      paused:     this.paused,
      cycles:     this.cycleCount,
      dryRun:     this.config?.dryRun ?? true,
      strategy:   this.config?.strategy,
      recentLogs: this.logs.slice(-10)
    };
  }

  // ── Main Cycle ────────────────────────────────────────────────────────────

  async _cycle() {
    if (!this.running || this.paused) return;

    this.cycleCount++;
    this._emit('cycle', { count: this.cycleCount, dryRun: this.config.dryRun });

    try {
      const marketData = await this._gatherMarketData();
      const walletData = await this._gatherWalletData();
      const decision   = await this._think(marketData, walletData);

      this._emit('decision', {
        cycle:     this.cycleCount,
        thought:   decision.thought,
        action:    decision.action,
        reasoning: decision.reasoning,
        dryRun:    this.config.dryRun
      });

      if (decision.action && decision.action !== 'wait' && decision.action !== 'error') {
        await this._executeDecision(decision, marketData);
      }

    } catch (err) {
      this._emit('error', { cycle: this.cycleCount, error: err.message });
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

  // ── Market Data ───────────────────────────────────────────────────────────

  async _gatherMarketData() {
    const data = { prices: {}, timestamp: new Date().toISOString() };
    try {
      const tokenIds = {
        ETH:   'coingecko:ethereum',
        ARB:   'coingecko:arbitrum',
        USDC:  'coingecko:usd-coin',
        WBTC:  'coingecko:wrapped-bitcoin',
        GMX:   'coingecko:gmx',
        LINK:  'coingecko:chainlink'
      };
      const ids = this.config.tokens
        .filter(t => tokenIds[t])
        .map(t => tokenIds[t])
        .join(',');

      const res  = await fetch(`https://coins.llama.fi/prices/current/${ids}`);
      const json = await res.json();
      for (const [sym, id] of Object.entries(tokenIds)) {
        const coin = json.coins?.[id];
        if (coin) data.prices[sym] = { price: coin.price, change24h: coin.confidence };
      }
    } catch (err) {
      this._emit('error', { type: 'market_data_fetch', error: err.message, note: 'Proceeding with empty price data' });
    }
    return data;
  }

  async _gatherWalletData() {
    const data = { connected: false, balances: {} };
    if (!this.agent.signer) return data;

    try {
      const exec = this.agent.executor;
      if (!exec) return data;
      const address  = await this.agent.signer.getAddress();
      const portfolio = await exec.getPortfolio(address);
      data.connected = true;
      data.address   = address;
      data.balances.ETH = portfolio.ETH?.formatted || '0';
      for (const [sym, info] of Object.entries(portfolio.tokens || {})) {
        data.balances[sym] = info.formatted;
      }
    } catch (err) {
      this._emit('error', { type: 'wallet_data_fetch', error: err.message, note: 'Proceeding without wallet balances' });
    }
    return data;
  }

  // ── AI Decision Making ────────────────────────────────────────────────────

  async _think(marketData, walletData) {
    const prompt = `You are running an autonomous ${this.agent.type} agent on Arbitrum.
Strategy: ${this.config.strategy}
DRY RUN: ${this.config.dryRun} (${this.config.dryRun ? 'simulation only, no real transactions' : 'LIVE - real transactions'})
Max trade size: ${this.config.maxTradeSizeEth} ETH
Stop loss: ${this.config.stopLossPct}%
Take profit: ${this.config.takeProfitPct}%

Current market data:
${JSON.stringify(marketData.prices, null, 2)}

Wallet balances:
${JSON.stringify(walletData.balances, null, 2)}
Wallet connected: ${walletData.connected}

Analyze the market and decide what action to take.

Respond with JSON:
{
  "thought": "analysis of current market state",
  "action": "wait|swap|transfer|info",
  "reasoning": "why this action",
  "parameters": {
    "tokenIn": "ETH",
    "tokenOut": "USDC",
    "amountIn": "0.001",
    "slippageBps": 50
  },
  "risk": "low|medium|high",
  "confidence": 0.0-1.0
}

IMPORTANT RULES:
- Only suggest swap if amountIn <= ${this.config.maxTradeSizeEth} ETH equivalent
- If unsure, action = "wait"
- If dryRun is true, still decide as if real but mark as simulation`;

    return await this.agent.think(prompt);
  }

  // ── Action Execution ──────────────────────────────────────────────────────

  async _executeDecision(decision, marketData) {
    const params = decision.parameters || {};

    if (decision.action === 'swap') {
      await this._handleSwap(params, decision);
    } else if (decision.action === 'transfer') {
      await this._handleTransfer(params, decision);
    } else if (decision.action === 'info') {
      this._emit('action', { type: 'info', message: decision.reasoning });
    }
  }

  async _handleSwap(params, decision) {
    if (!params.tokenIn || !params.tokenOut || !params.amountIn) {
      this._emit('error', { message: 'Swap parameters incomplete', params });
      return;
    }

    if (this.config.dryRun) {
      this._emit('action', {
        type:      'swap',
        mode:      'simulation',
        tokenIn:   params.tokenIn,
        tokenOut:  params.tokenOut,
        amountIn:  params.amountIn,
        reasoning: decision.reasoning,
        note:      'DRY RUN - no real transaction executed'
      });
      return;
    }

    if (!this.agent.signer || !this.agent.executor) {
      this._emit('error', { message: 'No wallet connected for live trading' });
      return;
    }

    try {
      const result = await this.agent.executor.executeSwap(this.agent.signer, {
        tokenInSymbol:  params.tokenIn,
        tokenOutSymbol: params.tokenOut,
        amountIn:       params.amountIn,
        slippageBps:    params.slippageBps || 50
      });

      this._emit('action', {
        type:    'swap',
        mode:    'live',
        result,
        reasoning: decision.reasoning
      });
    } catch (err) {
      this._emit('error', { type: 'swap_failed', error: err.message });
    }
  }

  async _handleTransfer(params, decision) {
    if (this.config.dryRun) {
      this._emit('action', {
        type:  'transfer',
        mode:  'simulation',
        note:  'DRY RUN - no real transaction',
        params
      });
      return;
    }
    this._emit('action', { type: 'transfer', mode: 'live', params });
  }
}
