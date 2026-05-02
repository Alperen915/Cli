/**
 * EventService — manages per-agent EventListener instances.
 * Persists watcher configs to disk, keeps listeners in memory.
 */
import path     from 'path';
import fs       from 'fs';
import { ethers } from 'ethers';
import { EventListener, KNOWN_POOLS, AAVE_POOL, TOKEN_ADDRS } from '../blockchain/eventListener.js';
import { config }      from '../utils/config.js';
import { storage }     from '../utils/storage.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('eventService');

// ── Persistence ───────────────────────────────────────────────────────────────

function watcherFile(agentName) {
  const home    = process.env.HOME || process.cwd();
  const dir     = path.join(home, '.arb-agent', 'events');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${agentName}.json`);
}

function loadWatchers(agentName) {
  const file = watcherFile(agentName);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch(e) {
    log.warn('Failed to load watcher file', { file, err: e.message });
    return [];
  }
}

function saveWatchers(agentName, watchers) {
  const file = watcherFile(agentName);
  const tmp  = file + '.tmp';
  const serialisable = watchers.map(w => {
    const { iface, ...rest } = w; // strip non-serialisable Interface instance
    return rest;
  });
  fs.writeFileSync(tmp, JSON.stringify(serialisable, null, 2));
  fs.renameSync(tmp, file);
}

// ── In-memory registry ────────────────────────────────────────────────────────

const listeners = new Map(); // agentName → EventListener

function getProvider(network = 'sepolia') {
  const netCfg = config.arbitrum[network];
  if (!netCfg?.rpcUrl) throw new Error(`Unknown network: ${network}`);
  return new ethers.JsonRpcProvider(netCfg.rpcUrl);
}

function getAgentNetwork(agentName) {
  const agents = storage.loadAgents();
  const agent  = agents.find(a => a.name === agentName);
  return agent?.network || 'sepolia';
}

function getOrCreateListener(agentName) {
  if (listeners.has(agentName)) return listeners.get(agentName);

  const network  = getAgentNetwork(agentName);
  const provider = getProvider(network);
  const listener = new EventListener(provider, network);

  // Restore persisted watchers
  const saved = loadWatchers(agentName);
  for (const w of saved) {
    try { listener.addWatcher(w); } catch(e) {
      log.warn(`Skipped invalid saved watcher`, { id: w.id, err: e.message });
    }
  }

  listeners.set(agentName, listener);
  log.info(`EventListener created for agent "${agentName}" (${network})`);
  return listener;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const eventService = {

  // Start listening
  startListener(agentName, intervalMs = 15_000) {
    const listener = getOrCreateListener(agentName);
    if (!listener.running) listener.start(intervalMs);
    return listener.getStatus();
  },

  // Stop listening
  stopListener(agentName) {
    const listener = listeners.get(agentName);
    if (listener) listener.stop();
    return { stopped: true };
  },

  // Status
  getStatus(agentName) {
    const listener = listeners.get(agentName);
    if (!listener) return { running: false, watcherCount: 0, eventCount: 0 };
    return listener.getStatus();
  },

  // Add watcher
  addWatcher(agentName, cfg) {
    const listener = getOrCreateListener(agentName);
    const watcher  = listener.addWatcher(cfg);
    // Persist (save all watchers)
    saveWatchers(agentName, [...listener.watchers.values()]);
    return watcher;
  },

  // Remove watcher
  removeWatcher(agentName, watcherId) {
    const listener = getOrCreateListener(agentName);
    const ok       = listener.removeWatcher(watcherId);
    if (ok) saveWatchers(agentName, [...listener.watchers.values()]);
    return { removed: ok };
  },

  // Toggle watcher enable/disable
  toggleWatcher(agentName, watcherId, enabled) {
    const listener = getOrCreateListener(agentName);
    const watcher  = listener.toggleWatcher(watcherId, enabled);
    saveWatchers(agentName, [...listener.watchers.values()]);
    return watcher;
  },

  // List watchers
  listWatchers(agentName) {
    const listener = getOrCreateListener(agentName);
    return listener.listWatchers();
  },

  // Event history
  getHistory(agentName, limit = 100) {
    const listener = listeners.get(agentName);
    if (!listener) return [];
    return listener.getHistory(limit);
  },

  // Get raw listener (for SSE streaming)
  getRawListener(agentName) {
    return getOrCreateListener(agentName);
  },

  // ── Preset watcher helpers ────────────────────────────────────────────────

  addLargeTransferWatcher(agentName, tokenSymbol, thresholdEther, action = 'alert') {
    const network = getAgentNetwork(agentName);
    const tokens  = TOKEN_ADDRS[network] || TOKEN_ADDRS.mainnet;
    const addr    = tokens[tokenSymbol.toUpperCase()];
    if (!addr || addr === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Token ${tokenSymbol} not available on ${network}`);
    }
    const thresholdWei = ethers.parseEther(String(thresholdEther)).toString();
    const cfg = EventListener.makeLargeTransferWatcher(addr, thresholdWei, action,
      `${tokenSymbol} Transfer ≥${thresholdEther}`);
    return this.addWatcher(agentName, cfg);
  },

  addWhaleSwapWatcher(agentName, poolKey, action = 'alert') {
    const network = getAgentNetwork(agentName);
    const pools   = KNOWN_POOLS[network] || KNOWN_POOLS.mainnet;
    const addr    = pools[poolKey];
    if (!addr) {
      throw new Error(`Pool "${poolKey}" not known. Available: ${Object.keys(pools).join(', ')}`);
    }
    const cfg = EventListener.makeWhaleSwapWatcher(addr, poolKey, action);
    return this.addWatcher(agentName, cfg);
  },

  addLiquidationWatcher(agentName, action = 'alert') {
    const network = getAgentNetwork(agentName);
    const pool    = AAVE_POOL[network];
    if (!pool) throw new Error(`Aave not available on ${network}`);
    const cfg = EventListener.makeLiquidationWatcher(pool, action);
    return this.addWatcher(agentName, cfg);
  },

  addCustomWatcher(agentName, address, abiFragment, eventName, label, action = 'alert', threshold = null) {
    const cfg = EventListener.makeCustomWatcher(address, abiFragment, eventName, label, action, threshold);
    return this.addWatcher(agentName, cfg);
  },

  // Known pools & tokens for the agent's network
  getKnownOptions(agentName) {
    const network = getAgentNetwork(agentName);
    return {
      pools:  KNOWN_POOLS[network]  || KNOWN_POOLS.mainnet,
      tokens: TOKEN_ADDRS[network]  || TOKEN_ADDRS.mainnet,
      aavePool: AAVE_POOL[network]  || null
    };
  }
};
