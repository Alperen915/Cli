/**
 * Centralized Input Validator
 * Sanitize and validate all user inputs before processing.
 */

const AGENT_NAME_RE  = /^[a-zA-Z0-9_-]{1,64}$/;
const ETH_ADDR_RE    = /^0x[0-9a-fA-F]{40}$/;
const PRIVATE_KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;
const VALID_NETWORKS  = ['mainnet', 'sepolia', 'nova'];
const VALID_TYPES     = ['trading', 'defi', 'onchain', 'nft', 'social', 'custom'];
const VALID_TOKENS    = ['ETH', 'WETH', 'USDC', 'USDT', 'ARB', 'WBTC', 'GMX', 'LINK', 'PENDLE', 'GRAIL', 'DAI'];

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name  = 'ValidationError';
    this.field = field;
    this.status = 400;
  }
}

// ── String helpers ─────────────────────────────────────────────────────────────

export function sanitizeString(val, maxLen = 256) {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

export function requireString(val, field, maxLen = 256) {
  const s = sanitizeString(val, maxLen);
  if (!s) throw new ValidationError(field, `${field} is required`);
  return s;
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export function validateAgentName(name) {
  const n = sanitizeString(name, 64);
  if (!n) throw new ValidationError('name', 'Agent name is required');
  if (!AGENT_NAME_RE.test(n)) {
    throw new ValidationError('name', 'Agent name must be 1-64 alphanumeric characters, hyphens or underscores');
  }
  return n;
}

export function validateAgentType(type) {
  const t = sanitizeString(type).toLowerCase();
  if (!VALID_TYPES.includes(t)) {
    throw new ValidationError('type', `Invalid agent type. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  return t;
}

export function validateNetwork(network) {
  if (!network) return 'sepolia';
  const n = sanitizeString(network).toLowerCase();
  if (!VALID_NETWORKS.includes(n)) {
    throw new ValidationError('network', `Invalid network. Must be one of: ${VALID_NETWORKS.join(', ')}`);
  }
  return n;
}

// ── Wallet / Keys ──────────────────────────────────────────────────────────────

export function validatePrivateKey(key) {
  if (!key || typeof key !== 'string') {
    throw new ValidationError('privateKey', 'Private key is required');
  }
  const k = key.trim();
  if (!PRIVATE_KEY_RE.test(k)) {
    throw new ValidationError('privateKey', 'Invalid private key format — must be 64 hex characters (0x prefix optional)');
  }
  return k.startsWith('0x') ? k : `0x${k}`;
}

export function validateEthAddress(addr, field = 'address') {
  if (!addr) throw new ValidationError(field, `${field} is required`);
  const a = sanitizeString(addr).trim();
  if (!ETH_ADDR_RE.test(a)) {
    throw new ValidationError(field, `Invalid Ethereum address format`);
  }
  return a;
}

// ── Trading ────────────────────────────────────────────────────────────────────

export function validateToken(sym, field = 'token') {
  if (!sym) throw new ValidationError(field, `${field} is required`);
  const t = sanitizeString(sym, 20).toUpperCase();
  return t;
}

export function validateAmount(val, field = 'amount') {
  const n = parseFloat(val);
  if (!val && val !== 0) throw new ValidationError(field, `${field} is required`);
  if (isNaN(n) || !isFinite(n)) throw new ValidationError(field, `${field} must be a valid number`);
  if (n <= 0) throw new ValidationError(field, `${field} must be greater than 0`);
  if (n > 1_000_000) throw new ValidationError(field, `${field} value too large`);
  return n;
}

export function validateSlippage(bps) {
  if (bps === undefined || bps === null) return 50;
  const n = parseInt(bps);
  if (isNaN(n)) throw new ValidationError('slippageBps', 'slippageBps must be an integer');
  if (n < 1 || n > 5000) throw new ValidationError('slippageBps', 'slippageBps must be between 1 and 5000 (0.01%–50%)');
  return n;
}

// ── Strategy ───────────────────────────────────────────────────────────────────

const VALID_STRATEGY_TYPES = ['dca', 'stop-loss', 'take-profit', 'price-alert', 'rebalance', 'custom'];

export function validateStrategyBody(body) {
  const type = sanitizeString(body?.type, 32).toLowerCase();
  if (!VALID_STRATEGY_TYPES.includes(type)) {
    throw new ValidationError('type', `Invalid strategy type. Must be one of: ${VALID_STRATEGY_TYPES.join(', ')}`);
  }
  return { ...body, type };
}

// ── Limits ─────────────────────────────────────────────────────────────────────

export function validateLoopConfig(cfg = {}) {
  const out = {};
  if (cfg.intervalMs !== undefined) {
    const ms = parseInt(cfg.intervalMs);
    if (isNaN(ms) || ms < 5000 || ms > 86_400_000) {
      throw new ValidationError('intervalMs', 'intervalMs must be between 5000ms (5s) and 86400000ms (24h)');
    }
    out.intervalMs = ms;
  }
  if (cfg.maxTradeSizeEth !== undefined) {
    const v = parseFloat(cfg.maxTradeSizeEth);
    if (isNaN(v) || v <= 0 || v > 10) {
      throw new ValidationError('maxTradeSizeEth', 'maxTradeSizeEth must be between 0 and 10');
    }
    out.maxTradeSizeEth = v;
  }
  if (cfg.maxCycles !== undefined) {
    const v = parseInt(cfg.maxCycles);
    if (isNaN(v) || v < 1 || v > 100000) {
      throw new ValidationError('maxCycles', 'maxCycles must be between 1 and 100000');
    }
    out.maxCycles = v;
  }
  out.dryRun   = cfg.dryRun !== false;
  out.strategy = sanitizeString(cfg.strategy, 64) || 'balanced';
  out.tokens   = Array.isArray(cfg.tokens)
    ? cfg.tokens.map(t => validateToken(t)).slice(0, 10)
    : ['ETH', 'ARB', 'USDC'];
  return out;
}

// ── Policy ─────────────────────────────────────────────────────────────────────

export function validatePolicyUpdate(body) {
  const out = {};
  const numericFields = ['maxTxSizeEth', 'maxDailySpendEth', 'maxHourlySpendEth', 'maxSlippageBps'];
  for (const f of numericFields) {
    if (body[f] !== undefined) {
      const v = parseFloat(body[f]);
      if (isNaN(v) || v < 0) throw new ValidationError(f, `${f} must be a non-negative number`);
      out[f] = v;
    }
  }
  if (body.allowedTokens !== undefined) {
    if (!Array.isArray(body.allowedTokens)) throw new ValidationError('allowedTokens', 'allowedTokens must be an array');
    out.allowedTokens = body.allowedTokens.map(t => validateToken(t));
  }
  if (body.blockedTokens !== undefined) {
    if (!Array.isArray(body.blockedTokens)) throw new ValidationError('blockedTokens', 'blockedTokens must be an array');
    out.blockedTokens = body.blockedTokens.map(t => validateToken(t));
  }
  return out;
}

// ── Limit helpers ──────────────────────────────────────────────────────────────

export function validateQueryInt(val, field, min = 1, max = 100, def = 15) {
  if (val === undefined || val === null) return def;
  const n = parseInt(val);
  if (isNaN(n) || n < min || n > max) {
    throw new ValidationError(field, `${field} must be between ${min} and ${max}`);
  }
  return n;
}
