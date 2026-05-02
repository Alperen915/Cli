import { EventEmitter } from 'events';
import { ethers }       from 'ethers';
import { createLogger } from '../utils/logger.js';

const log = createLogger('eventListener');

// ── Well-known pools / contracts ──────────────────────────────────────────────

export const KNOWN_POOLS = {
  mainnet: {
    'ETH/USDC-0.05%':  '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
    'ETH/USDC-0.3%':   '0x17c14D2c404D167802b16C450d3c99F88F2c4F4d',
    'ETH/ARB-0.3%':    '0x431402e8b9dE9aa016C743880e04E517074D8cEC',
    'ETH/USDT-0.05%':  '0x641C00A822e8b671738d32a431a4Fb6074E5c79d',
    'ARB/USDC-0.05%':  '0xb0f6cA40411360c03d41C5fFa5d6E6825A746b3c',
  },
  sepolia: {}
};

export const AAVE_POOL = {
  mainnet: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  sepolia: null
};

// Canonical token addresses (Arbitrum)
export const TOKEN_ADDRS = {
  mainnet: {
    WETH:  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC:  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    ARB:   '0x912CE59144191C1204E64559FE8253a0e49E6548',
    USDT:  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  sepolia: {
    WETH:  '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    USDC:  '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  }
};

// ── EventListener ─────────────────────────────────────────────────────────────

/**
 * Block-polling based on-chain event listener.
 * Uses provider.getLogs() — no WebSocket required.
 *
 * Watcher config shape:
 *   { id, type, label, address, abi, eventName,
 *     threshold, thresholdUnit, action, actionParams,
 *     enabled, createdAt, triggerCount }
 *
 * Emits:
 *   'event'  — { id, watcherId, type, txHash, blockNumber, decoded, timestamp }
 *   'poll'   — { fromBlock, toBlock, ts }
 *   'error'  — { message, ts }
 */
export class EventListener extends EventEmitter {
  constructor(provider, network = 'sepolia') {
    super();
    this.provider    = provider;
    this.network     = network;
    this.watchers    = new Map();
    this.history     = [];
    this.MAX_HISTORY = 500;
    this.running     = false;
    this.intervalMs  = 15_000;
    this._timer      = null;
    this._lastBlock  = null;
  }

  // ── Watcher CRUD ─────────────────────────────────────────────────────────────

  addWatcher(cfg) {
    const id = cfg.id || `w_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

    let iface  = null;
    let topic0 = null;

    if (cfg.abi) {
      try {
        iface = new ethers.Interface(cfg.abi);
      } catch(e) {
        throw new Error(`Invalid ABI: ${e.message}`);
      }
    }

    if (iface && cfg.eventName) {
      try {
        const frag = iface.getEvent(cfg.eventName);
        topic0 = frag.topicHash;
      } catch(e) { /* skip */ }
    }

    const watcher = {
      id,
      type:          cfg.type         || 'custom',
      label:         cfg.label        || `Watcher ${id.slice(-4)}`,
      address:       cfg.address      || null,
      abi:           cfg.abi          || null,
      eventName:     cfg.eventName    || null,
      iface,
      topic0,
      threshold:     cfg.threshold    != null ? cfg.threshold.toString() : null,
      thresholdUnit: cfg.thresholdUnit || 'wei',
      action:        cfg.action       || 'alert',
      actionParams:  cfg.actionParams || {},
      enabled:       cfg.enabled      !== false,
      createdAt:     cfg.createdAt    || new Date().toISOString(),
      triggerCount:  cfg.triggerCount || 0
    };

    this.watchers.set(id, watcher);
    log.info(`Watcher added: ${id} [${watcher.type}] "${watcher.label}"`);
    return watcher;
  }

  removeWatcher(id) {
    const ok = this.watchers.delete(id);
    if (ok) log.info(`Watcher removed: ${id}`);
    return ok;
  }

  toggleWatcher(id, enabled) {
    const w = this.watchers.get(id);
    if (!w) throw new Error(`Watcher not found: ${id}`);
    w.enabled = enabled;
    return w;
  }

  listWatchers() {
    return [...this.watchers.values()].map(w => ({
      id: w.id, type: w.type, label: w.label,
      address: w.address, eventName: w.eventName,
      threshold: w.threshold, action: w.action,
      enabled: w.enabled, triggerCount: w.triggerCount,
      createdAt: w.createdAt
    }));
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  start(intervalMs = 15_000) {
    if (this.running) return this;
    this.intervalMs = intervalMs;
    this.running    = true;
    log.info(`EventListener started — poll every ${intervalMs}ms on ${this.network}`);
    this._schedule(0);
    return this;
  }

  stop() {
    this.running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    log.info('EventListener stopped');
  }

  _schedule(delayMs) {
    this._timer = setTimeout(() => this._poll(), delayMs ?? this.intervalMs);
  }

  // ── Poll ─────────────────────────────────────────────────────────────────────

  async _poll() {
    if (!this.running) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();

      if (this._lastBlock === null) {
        this._lastBlock = Math.max(0, currentBlock - 5);
      }

      if (currentBlock <= this._lastBlock) {
        this._schedule();
        return;
      }

      const fromBlock = this._lastBlock + 1;
      const toBlock   = currentBlock;

      this.emit('poll', { fromBlock, toBlock, ts: new Date().toISOString() });

      for (const watcher of this.watchers.values()) {
        if (!watcher.enabled) continue;
        await this._pollWatcher(watcher, fromBlock, toBlock);
      }

      this._lastBlock = currentBlock;
    } catch (err) {
      log.error('Poll error', { message: err.message });
      this.emit('error', { message: err.message, ts: new Date().toISOString() });
    }

    this._schedule();
  }

  async _pollWatcher(watcher, fromBlock, toBlock) {
    try {
      const filter = { fromBlock, toBlock };

      const addr = watcher.address;
      if (addr && addr !== '0x0000000000000000000000000000000000000000') {
        filter.address = addr;
      }
      if (watcher.topic0) {
        filter.topics = [watcher.topic0];
      }

      // Must have at least address or topic to avoid overly broad queries
      if (!filter.address && !filter.topics) return;

      const logs = await this.provider.getLogs(filter);

      for (const rawLog of logs) {
        await this._handleLog(rawLog, watcher);
      }
    } catch (err) {
      log.warn(`Watcher "${watcher.id}" poll error`, { message: err.message });
    }
  }

  // ── Log handling ─────────────────────────────────────────────────────────────

  async _handleLog(rawLog, watcher) {
    let decoded = null;

    if (watcher.iface && watcher.eventName) {
      try {
        decoded = watcher.iface.parseLog(rawLog);
      } catch(e) {
        return; // Unrelated event (different topic) — skip
      }
    }

    // Threshold gate
    if (watcher.threshold !== null && decoded) {
      if (!this._meetsThreshold(decoded, watcher)) return;
    }

    const record = {
      id:           `evt_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      watcherId:    watcher.id,
      watcherLabel: watcher.label,
      type:         watcher.type,
      action:       watcher.action,
      contract:     rawLog.address,
      txHash:       rawLog.transactionHash,
      blockNumber:  rawLog.blockNumber,
      logIndex:     rawLog.index ?? rawLog.logIndex ?? 0,
      decoded:      decoded ? this._serializeDecoded(decoded) : null,
      timestamp:    new Date().toISOString()
    };

    this.history.unshift(record);
    if (this.history.length > this.MAX_HISTORY) this.history.pop();

    watcher.triggerCount++;

    this.emit('event', record);
    log.info(`[${watcher.type}] "${watcher.label}" triggered`, {
      tx:    rawLog.transactionHash?.slice(0, 14),
      block: rawLog.blockNumber
    });

    this._executeAction(record, watcher).catch(e =>
      log.warn('Action error', { message: e.message })
    );
  }

  _meetsThreshold(decoded, watcher) {
    try {
      const threshold = BigInt(watcher.threshold);
      const args = decoded.args;

      // ERC-20 Transfer: value
      if (args.value !== undefined) {
        return BigInt(args.value.toString()) >= threshold;
      }
      // Uniswap Swap: abs(amount0)
      if (args.amount0 !== undefined) {
        const a = BigInt(args.amount0.toString());
        return (a < 0n ? -a : a) >= threshold;
      }
      // Aave LiquidationCall: debtToCover
      if (args.debtToCover !== undefined) {
        return BigInt(args.debtToCover.toString()) >= threshold;
      }
    } catch(e) { /* ignore */ }
    return true;
  }

  _serializeDecoded(decoded) {
    const args = {};
    if (decoded?.args) {
      for (const [key, val] of Object.entries(decoded.args)) {
        if (!isNaN(Number(key))) continue; // skip positional numeric keys
        args[key] = typeof val === 'bigint' ? val.toString() : val;
      }
    }
    return { name: decoded.name, args };
  }

  async _executeAction(record, watcher) {
    switch (watcher.action) {
      case 'alert':
        break; // already emitted

      case 'webhook': {
        const url = watcher.actionParams?.url;
        if (url) {
          await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(record),
            signal:  AbortSignal.timeout(5000)
          });
        }
        break;
      }

      default:
        this.emit('action_needed', { action: watcher.action, params: watcher.actionParams, record });
    }
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  getHistory(limit = 100) {
    return this.history.slice(0, Math.min(limit, this.MAX_HISTORY));
  }

  getStatus() {
    return {
      running:      this.running,
      network:      this.network,
      watcherCount: this.watchers.size,
      eventCount:   this.history.length,
      lastBlock:    this._lastBlock,
      intervalMs:   this.intervalMs
    };
  }

  // ── Static factory helpers ───────────────────────────────────────────────────

  static makeLargeTransferWatcher(tokenAddress, thresholdWei, action = 'alert', label = null) {
    const thr = BigInt(thresholdWei);
    const eth = ethers.formatEther(thr);
    return {
      type:      'large_transfer',
      label:     label || `Large Transfer ≥${eth} (token ${tokenAddress.slice(0,8)}…)`,
      address:   tokenAddress,
      abi:       ['event Transfer(address indexed from, address indexed to, uint256 value)'],
      eventName: 'Transfer',
      threshold: thresholdWei.toString(),
      action
    };
  }

  static makeWhaleSwapWatcher(poolAddress, poolLabel = null, action = 'alert') {
    return {
      type:      'whale_swap',
      label:     poolLabel ? `Swap: ${poolLabel}` : `Swap: ${poolAddress.slice(0,10)}…`,
      address:   poolAddress,
      abi:       ['event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'],
      eventName: 'Swap',
      threshold: null,
      action
    };
  }

  static makeLiquidationWatcher(aavePool, action = 'alert') {
    return {
      type:      'liquidation',
      label:     'Aave V3 Liquidation',
      address:   aavePool,
      abi:       ['event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)'],
      eventName: 'LiquidationCall',
      threshold: null,
      action
    };
  }

  static makeCustomWatcher(address, abiFragment, eventName, label, action = 'alert', threshold = null) {
    return {
      type:      'custom',
      label:     label || `Custom: ${eventName} on ${address.slice(0,10)}…`,
      address,
      abi:       [abiFragment],
      eventName,
      threshold,
      action
    };
  }
}
