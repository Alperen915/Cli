/**
 * Strategy Engine for Autonomous Agents
 *
 * Strategies define automated rules:
 *   - DCA (Dollar Cost Average)      → buy X every N hours
 *   - Stop-Loss                       → sell if price drops Y%
 *   - Take-Profit                     → sell if price rises Z%
 *   - Price Alert + Action            → do X when price reaches threshold
 *   - Portfolio Rebalance             → maintain target allocations
 *   - Yield Optimizer                 → move funds to best yield protocol
 *   - Liquidation Guard               → repay debt if health factor < threshold
 */

export const STRATEGY_TYPES = {
  DCA:         'dca',
  STOP_LOSS:   'stop_loss',
  TAKE_PROFIT: 'take_profit',
  PRICE_ALERT: 'price_alert',
  REBALANCE:   'rebalance',
  COMPOUND:    'compound',
  CUSTOM:      'custom'
};

export const TRIGGER_CONDITIONS = {
  ABOVE:        'above',
  BELOW:        'below',
  CHANGE_UP:    'change_pct_up',
  CHANGE_DOWN:  'change_pct_down',
  SCHEDULE:     'schedule'
};

export class Strategy {
  constructor(config) {
    this.id          = config.id || `strat_${Date.now()}`;
    this.name        = config.name;
    this.type        = config.type;
    this.description = config.description || '';
    this.enabled     = config.enabled !== false;
    this.trigger     = config.trigger;   // { type, token?, condition?, value?, intervalMs? }
    this.action      = config.action;   // { type, tokenIn?, tokenOut?, amount?, amountPct? }
    this.conditions  = config.conditions || [];  // extra conditions (AND logic)
    this.maxRuns     = config.maxRuns || Infinity;
    this.runCount    = 0;
    this.lastRun     = null;
    this.lastPrice   = null;
    this.basePrice   = config.basePrice || null;  // price when strategy was created
    this.created     = config.created || new Date().toISOString();
    this.dryRun      = config.dryRun !== false;   // safe by default
    this.status      = 'active';
    this.executions  = config.executions || 0;
  }

  shouldTrigger(currentPrices) {
    if (!this.enabled) return false;
    if (this.runCount >= this.maxRuns) return false;

    const trigger = this.trigger;

    // Schedule-based trigger
    if (trigger.type === TRIGGER_CONDITIONS.SCHEDULE) {
      if (!this.lastRun) return true;
      const elapsed = Date.now() - new Date(this.lastRun).getTime();
      return elapsed >= (trigger.intervalMs || 3600_000);
    }

    // Price-based triggers
    const token = trigger.token?.toUpperCase();
    const price = currentPrices?.[token];
    if (!price) return false;

    this.lastPrice = price;

    if (trigger.type === TRIGGER_CONDITIONS.ABOVE)  return price >= trigger.value;
    if (trigger.type === TRIGGER_CONDITIONS.BELOW)  return price <= trigger.value;

    if (!this.basePrice) return false;

    if (trigger.type === TRIGGER_CONDITIONS.CHANGE_UP) {
      const changePct = ((price - this.basePrice) / this.basePrice) * 100;
      return changePct >= trigger.value;
    }
    if (trigger.type === TRIGGER_CONDITIONS.CHANGE_DOWN) {
      const changePct = ((this.basePrice - price) / this.basePrice) * 100;
      return changePct >= trigger.value;
    }

    return false;
  }

  record(result) {
    this.runCount++;
    this.executions++;
    this.lastRun = new Date().toISOString();
    if (this.runCount >= this.maxRuns) this.status = 'completed';
    return result;
  }

  toJSON() {
    return {
      id:          this.id,
      name:        this.name,
      type:        this.type,
      description: this.description,
      enabled:     this.enabled,
      status:      this.status,
      trigger:     this.trigger,
      action:      this.action,
      maxRuns:     this.maxRuns === Infinity ? null : this.maxRuns,
      runCount:    this.runCount,
      executions:  this.executions,
      lastRun:     this.lastRun,
      lastPrice:   this.lastPrice,
      basePrice:   this.basePrice,
      dryRun:      this.dryRun,
      created:     this.created
    };
  }
}

export class StrategyEngine {
  constructor(agent) {
    this.agent      = agent;
    this.strategies = new Map();
    this.running    = false;
    this._timer     = null;
    this.handlers   = {};
    this.logs       = [];
    this._storage   = null;
    this._notif     = null;
    this._perf      = null;
  }

  // ── Lazy service imports (avoid circular deps) ────────────────────────────

  async _getStorage() {
    if (!this._storage) {
      const { storage } = await import('../utils/storage.js');
      this._storage = storage;
    }
    return this._storage;
  }

  async _getNotif() {
    if (!this._notif) {
      const { notificationService } = await import('../services/notificationService.js');
      this._notif = notificationService;
    }
    return this._notif;
  }

  async _getPerf() {
    if (!this._perf) {
      const { performanceService } = await import('../services/performanceService.js');
      this._perf = performanceService;
    }
    return this._perf;
  }

  async persistStrategies() {
    try {
      const store = await this._getStorage();
      store.saveStrategies(this.agent.name, this.strategies);
    } catch (err) {
      this._emit('engine_error', { error: `Failed to persist strategies: ${err.message}` });
    }
  }

  async loadPersistedStrategies() {
    try {
      const store = await this._getStorage();
      const saved = store.loadStrategies(this.agent.name);
      if (!saved || saved.length === 0) return;
      for (const s of saved) {
        if (!this.strategies.has(s.id)) {
          const strategy = new Strategy({
            ...s,
            status: s.status === 'active' ? 'active' : 'active'
          });
          strategy.runCount  = s.executions || s.runCount || 0;
          strategy.lastRun   = s.lastRun || null;
          strategy.basePrice = s.basePrice || null;
          this.strategies.set(strategy.id, strategy);
        }
      }
      this._emit('strategies_loaded', { count: saved.length, agent: this.agent.name });
    } catch (err) {
      this._emit('engine_error', { error: `Failed to load strategies: ${err.message}` });
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  add(config) {
    const s = new Strategy(config);
    this.strategies.set(s.id, s);
    this._emit('strategy_added', { id: s.id, name: s.name, type: s.type });
    this.persistStrategies();
    return s;
  }

  remove(id) {
    this.strategies.delete(id);
    this._emit('strategy_removed', { id });
    this.persistStrategies();
  }

  get(id)   { return this.strategies.get(id); }
  list()    { return Array.from(this.strategies.values()).map(s => s.toJSON()); }
  enable(id)  { const s = this.strategies.get(id); if (s) { s.enabled = true; }  }
  disable(id) { const s = this.strategies.get(id); if (s) { s.enabled = false; } }

  // ── Built-in strategy templates ───────────────────────────────────────────

  addDCA({ token, quoteToken = 'USDC', amount, intervalHours = 24, maxRuns, dryRun = true }) {
    return this.add({
      name:    `DCA ${token}/${quoteToken} every ${intervalHours}h`,
      type:    STRATEGY_TYPES.DCA,
      description: `Buy ${amount} worth of ${token} every ${intervalHours} hours`,
      trigger: { type: TRIGGER_CONDITIONS.SCHEDULE, intervalMs: intervalHours * 3600_000 },
      action:  { type: 'swap', tokenIn: quoteToken, tokenOut: token, amount },
      maxRuns,
      dryRun
    });
  }

  addStopLoss({ token, quoteToken = 'USDC', lossPercent, amountPct = 100, currentPrice, dryRun = true }) {
    return this.add({
      name:       `Stop-Loss ${token} -${lossPercent}%`,
      type:       STRATEGY_TYPES.STOP_LOSS,
      description:`Sell ${amountPct}% of ${token} if price drops ${lossPercent}%`,
      trigger:    { type: TRIGGER_CONDITIONS.CHANGE_DOWN, token, value: lossPercent },
      action:     { type: 'swap', tokenIn: token, tokenOut: quoteToken, amountPct },
      basePrice:  currentPrice,
      maxRuns:    1,
      dryRun
    });
  }

  addTakeProfit({ token, quoteToken = 'USDC', profitPercent, amountPct = 100, currentPrice, dryRun = true }) {
    return this.add({
      name:       `Take-Profit ${token} +${profitPercent}%`,
      type:       STRATEGY_TYPES.TAKE_PROFIT,
      description:`Sell ${amountPct}% of ${token} if price rises ${profitPercent}%`,
      trigger:    { type: TRIGGER_CONDITIONS.CHANGE_UP, token, value: profitPercent },
      action:     { type: 'swap', tokenIn: token, tokenOut: quoteToken, amountPct },
      basePrice:  currentPrice,
      maxRuns:    1,
      dryRun
    });
  }

  addPriceAlert({ token, condition, targetPrice, action, dryRun = true }) {
    const condType = condition === 'above' ? TRIGGER_CONDITIONS.ABOVE : TRIGGER_CONDITIONS.BELOW;
    return this.add({
      name:       `Alert: ${token} ${condition} $${targetPrice}`,
      type:       STRATEGY_TYPES.PRICE_ALERT,
      description:`${action?.description || 'Alert'} when ${token} is ${condition} $${targetPrice}`,
      trigger:    { type: condType, token, value: targetPrice },
      action:     action || { type: 'notify' },
      maxRuns:    1,
      dryRun
    });
  }

  addRebalance({ targets, intervalHours = 168, dryRun = true }) {
    // targets: { ETH: 50, USDC: 30, ARB: 20 } (percentages)
    return this.add({
      name:       `Portfolio Rebalance weekly`,
      type:       STRATEGY_TYPES.REBALANCE,
      description:`Rebalance to: ${Object.entries(targets).map(([t,p]) => `${t}:${p}%`).join(', ')}`,
      trigger:    { type: TRIGGER_CONDITIONS.SCHEDULE, intervalMs: intervalHours * 3600_000 },
      action:     { type: 'rebalance', targets },
      dryRun
    });
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  start(intervalMs = 60_000) {
    if (this.running) return;
    this.running = true;
    this._emit('engine_start', { strategies: this.strategies.size });
    this._schedule(intervalMs);
    return this;
  }

  stop() {
    this.running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._emit('engine_stop', {});
  }

  async runNow(currentPrices) {
    const triggered = [];
    for (const strategy of this.strategies.values()) {
      if (strategy.shouldTrigger(currentPrices)) {
        triggered.push(strategy);
      }
    }

    for (const strategy of triggered) {
      await this._executeStrategy(strategy, currentPrices);
    }

    return triggered.length;
  }

  async _executeStrategy(strategy, currentPrices) {
    strategy.status = 'executing';
    const action = strategy.action;
    this._emit('strategy_triggered', {
      id:     strategy.id,
      name:   strategy.name,
      type:   strategy.type,
      action: action.type,
      dryRun: strategy.dryRun,
      price:  strategy.lastPrice
    });

    if (strategy.dryRun) {
      const result = {
        mode:   'simulation',
        action: action.type,
        note:   'DRY RUN — no real transaction',
        params: action
      };
      strategy.record(result);
      strategy.status = 'active';
      this._emit('strategy_executed', { id: strategy.id, result });
      this.persistStrategies();
      // Notify (fire-and-forget)
      this._getNotif().then(n => n.notifyStrategyTrigger(
        this.agent.name, strategy.toJSON(), result
      ).catch(() => {})).catch(() => {});
      return result;
    }

    if (!this.agent.hasWallet() || !this.agent.executor) {
      const err = 'No wallet connected for live strategy execution';
      this._emit('strategy_error', { id: strategy.id, error: err });
      return { error: err };
    }

    try {
      let result;

      if (action.type === 'swap') {
        // Calculate amount from portfolio if amountPct set
        let amountIn = action.amount;
        if (action.amountPct && action.tokenIn) {
          const bal = await this.agent.getTokenBalance(action.tokenIn).catch(() => null);
          if (bal) {
            const decimals = bal.decimals ?? 6;
            const safeDecimals = Math.min(decimals, 8);
            amountIn = (parseFloat(bal.formatted) * action.amountPct / 100).toFixed(safeDecimals);
          }
        }
        result = await this.agent.executeSwap(
          action.tokenIn, action.tokenOut, amountIn
        );
        // Auto-log trade to performance tracker
        if (result && !result.error) {
          this._getPerf().then(p => p.logTrade(this.agent.name, {
            token:        action.tokenOut || action.tokenIn,
            side:         strategy.type === STRATEGY_TYPES.DCA ? 'BUY' : 'SELL',
            amountToken:  parseFloat(amountIn) || 0,
            amountUSD:    strategy.lastPrice ? parseFloat(amountIn) * strategy.lastPrice : 0,
            priceUSD:     strategy.lastPrice || 0,
            strategyType: strategy.type,
            txHash:       result.txHash || result.hash || null
          })).catch(() => {});
        }

      } else if (action.type === 'notify') {
        result = {
          type:    'notification',
          message: strategy.description,
          price:   strategy.lastPrice,
          token:   strategy.trigger.token
        };

      } else if (action.type === 'rebalance') {
        result = await this._executeRebalance(action.targets);

      } else {
        result = { note: `Action type "${action.type}" requires custom implementation` };
      }

      strategy.record(result);
      this._emit('strategy_executed', { id: strategy.id, result });
      // Notify (fire-and-forget)
      this._getNotif().then(n => n.notifyStrategyTrigger(
        this.agent.name, strategy.toJSON(), result
      ).catch(() => {})).catch(() => {});
      return result;

    } catch (err) {
      this._emit('strategy_error', { id: strategy.id, error: err.message });
      return { error: err.message };
    }
  }

  async _executeRebalance(targets) {
    if (!this.agent.hasWallet()) return { error: 'No wallet' };
    const portfolio = await this.agent.getPortfolio();

    const totalValueEth = Object.values(portfolio.tokens || {}).reduce((sum, t) => {
      return sum + parseFloat(t.formatted || 0);
    }, parseFloat(portfolio.ETH?.formatted || 0));

    const swapPlan = [];
    for (const [token, targetPct] of Object.entries(targets)) {
      const currentFormatted = portfolio.tokens?.[token]?.formatted
        || (token === 'ETH' ? portfolio.ETH?.formatted : null)
        || '0';
      const currentPct = totalValueEth > 0
        ? (parseFloat(currentFormatted) / totalValueEth) * 100
        : 0;
      const diff = targetPct - currentPct;
      if (Math.abs(diff) > 2) {
        swapPlan.push({ token, currentPct: currentPct.toFixed(2), targetPct, diffPct: diff.toFixed(2) });
      }
    }

    if (swapPlan.length === 0) {
      return { type: 'rebalance', status: 'balanced', note: 'Portfolio is within 2% of targets, no swaps needed' };
    }

    return {
      type:       'rebalance',
      status:     'plan_ready',
      swapPlan,
      portfolio,
      note:       'Rebalance plan computed. Set dryRun=false and connect wallet to execute swaps.'
    };
  }

  _schedule(intervalMs) {
    this._timer = setTimeout(async () => {
      try {
        const prices = await this._fetchPrices();
        await this.runNow(prices);
      } catch (err) {
        this._emit('engine_error', { error: err.message });
      }
      if (this.running) this._schedule(intervalMs);
    }, intervalMs);
  }

  async _fetchPrices() {
    const prices = {};
    try {
      const ids = 'coingecko:ethereum,coingecko:arbitrum,coingecko:usd-coin,coingecko:wrapped-bitcoin,coingecko:chainlink,coingecko:gmx';
      const res = await fetch(`https://coins.llama.fi/prices/current/${ids}`);
      const data = await res.json();
      const MAP = {
        'coingecko:ethereum':        'ETH',
        'coingecko:arbitrum':        'ARB',
        'coingecko:usd-coin':        'USDC',
        'coingecko:wrapped-bitcoin': 'WBTC',
        'coingecko:chainlink':       'LINK',
        'coingecko:gmx':             'GMX'
      };
      for (const [id, sym] of Object.entries(MAP)) {
        if (data.coins?.[id]) prices[sym] = data.coins[id].price;
      }
    } catch {}
    return prices;
  }

  // ── Events ────────────────────────────────────────────────────────────────

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

  getLogs(limit = 50) { return this.logs.slice(-limit); }
}
