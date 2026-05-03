/**
 * NetworkService — Arbitrum network management service layer.
 *
 * Wraps networkMonitor + persists custom RPC configs.
 * Config stored at ~/.arb-agent/network_config.json
 */
import path from 'path';
import fs   from 'fs';
import os   from 'os';
import {
  getNetworkHealth,
  getAllNetworksHealth,
  getSequencerStatus,
  getTransactionLifecycle,
  inspectAddress,
  testCustomRpc,
  getSepoliaFaucets,
  KNOWN_TOKENS_MAP,
} from '../blockchain/networkMonitor.js';
import { NETWORKS } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('networkService');

function cfgDir() {
  const d = path.join(os.homedir(), '.arb-agent');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}
function cfgFile() { return path.join(cfgDir(), 'network_config.json'); }

function loadCfg() {
  try {
    if (fs.existsSync(cfgFile())) return JSON.parse(fs.readFileSync(cfgFile(), 'utf-8'));
  } catch(_) {}
  return { customRpcs: {}, healthCache: {}, txHistory: [] };
}
function saveCfg(cfg) {
  const tmp = cfgFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, cfgFile());
}

// ── Public API ────────────────────────────────────────────────────────────────

export const networkService = {

  // ── Health ──────────────────────────────────────────────────────────────

  async getHealth(network) {
    const cfg   = loadCfg();
    const rpc   = cfg.customRpcs[network] || null;
    const result = await getNetworkHealth(network, rpc);

    // Cache result
    cfg.healthCache[network] = result;
    saveCfg(cfg);
    return result;
  },

  async getAllHealth() {
    const networks = Object.keys(NETWORKS);
    const cfg      = loadCfg();

    const results = await Promise.allSettled(
      networks.map(n => {
        const rpc = cfg.customRpcs[n] || null;
        return getNetworkHealth(n, rpc);
      })
    );

    const health = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { network: networks[i], status: 'error', error: r.reason?.message }
    );

    // Update cache
    health.forEach(h => { if (h.network) cfg.healthCache[h.network] = h; });
    saveCfg(cfg);
    return health;
  },

  async getSequencerStatus(network) {
    return getSequencerStatus(network);
  },

  // ── Custom RPC ──────────────────────────────────────────────────────────

  async setCustomRpc(network, rpcUrl) {
    if (!NETWORKS[network]) throw new Error(`Unknown network: ${network}`);

    // Test before saving
    log.info(`Testing custom RPC for ${network}: ${rpcUrl.slice(0, 50)}…`);
    const test = await testCustomRpc(network, rpcUrl);
    if (!test.ok) throw new Error(`RPC test failed: ${test.error}`);
    if (!test.chainMatch) throw new Error(test.warning);

    const cfg = loadCfg();
    cfg.customRpcs[network] = rpcUrl;
    saveCfg(cfg);
    return test;
  },

  removeCustomRpc(network) {
    const cfg = loadCfg();
    const had = !!cfg.customRpcs[network];
    delete cfg.customRpcs[network];
    saveCfg(cfg);
    return { removed: had, network };
  },

  listCustomRpcs() {
    const cfg = loadCfg();
    return Object.entries(cfg.customRpcs).map(([network, url]) => ({
      network,
      url:     url.slice(0, 50) + (url.length > 50 ? '…' : ''),
      fullUrl: url,
    }));
  },

  async testRpc(network, rpcUrl) {
    return testCustomRpc(network, rpcUrl);
  },

  // ── Transaction Tracker ─────────────────────────────────────────────────

  async trackTransaction(txHash, network = 'mainnet') {
    const result = await getTransactionLifecycle(txHash, network);

    // Save to history
    if (result.found) {
      const cfg = loadCfg();
      const existing = cfg.txHistory.findIndex(t => t.txHash === txHash);
      const entry = {
        txHash,
        network,
        status:    result.status,
        l2Stage:   result.l2Stage,
        from:      result.from,
        to:        result.to,
        value:     result.value,
        trackedAt: new Date().toISOString(),
      };
      if (existing >= 0) cfg.txHistory[existing] = entry;
      else cfg.txHistory.unshift(entry);
      if (cfg.txHistory.length > 100) cfg.txHistory = cfg.txHistory.slice(0, 100);
      saveCfg(cfg);
    }
    return result;
  },

  getTxHistory(limit = 20) {
    return loadCfg().txHistory.slice(0, limit);
  },

  // ── Address Inspector ───────────────────────────────────────────────────

  async inspectAddress(address, network = 'mainnet') {
    return inspectAddress(address, network);
  },

  // ── Faucets ─────────────────────────────────────────────────────────────

  getSepoliaFaucets() {
    return getSepoliaFaucets();
  },

  // ── Known tokens ────────────────────────────────────────────────────────

  getKnownTokens(network) {
    return KNOWN_TOKENS_MAP[network] || {};
  },

  // ── Network info ─────────────────────────────────────────────────────────

  getNetworkList() {
    const cfg = loadCfg();
    return Object.entries(NETWORKS).map(([id, n]) => ({
      id,
      name:        n.name,
      chainId:     n.chainId,
      rpc:         n.rpc,
      customRpc:   cfg.customRpcs[id] ? cfg.customRpcs[id].slice(0, 50) + '…' : null,
      explorer:    n.explorer,
      isTestnet:   id === 'sepolia',
      isDefault:   id === 'mainnet',
    }));
  },

  getCachedHealth() {
    return loadCfg().healthCache;
  },
};
