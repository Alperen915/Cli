#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { agentService } from '../services/agentService.js';
import { analyticsService } from '../services/analyticsService.js';
import { onchainService } from '../services/onchainService.js';
import { config, SUPPORTED_PROVIDERS, reloadConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';
import {
  ValidationError,
  validateAgentName, validateAgentType, validateNetwork,
  validatePrivateKey, validateToken, validateAmount, validateSlippage,
  validateStrategyBody, validateLoopConfig, validatePolicyUpdate,
  validateQueryInt, sanitizeString, requireString
} from '../utils/validator.js';
import 'dotenv/config';

const log = createLogger('api');
const app = express();
const PORT = process.env.API_PORT || 3000;
const ENV_FILE = path.join(process.cwd(), '.env');
const VERSION  = '1.2.0';

// ── Security Middleware ───────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['*'];

app.use(cors({
  origin: ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-OpenAI-Key',
                   'X-AI-Provider', 'X-AI-Model', 'X-Brian-Api-Key']
}));

// Body size limit — prevent large payload attacks
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — try again in a minute' }
});

const strictLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded for sensitive operations' }
});

const txLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Transaction rate limit exceeded' }
});

app.use('/api', globalLimiter);
app.use('/api/agents/:name/wallet/attach', strictLimiter);
app.use('/api/config/apikey', strictLimiter);
app.use('/api/agents/:name/swap', txLimiter);
app.use('/api/agents/:name/intent/execute', txLimiter);

// ── Optional API Secret Auth ──────────────────────────────────────────────────

const API_SECRET = process.env.API_SECRET;

function authMiddleware(req, res, next) {
  if (!API_SECRET) return next();
  const provided = req.headers['authorization']?.replace('Bearer ', '') ||
                   req.headers['x-api-secret'];
  if (provided !== API_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized — invalid API secret' });
  }
  next();
}

// Apply auth to all mutation routes
app.use([
  '/api/agents',
  '/api/config/apikey'
], authMiddleware);

// ── Helpers ───────────────────────────────────────────────────────────────────

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function extractAiOptions(req) {
  return {
    apiKey:   sanitizeString(req.headers['x-openai-key'] || req.headers['x-api-key'], 256) || null,
    provider: sanitizeString(req.headers['x-ai-provider'], 32) || null,
    model:    sanitizeString(req.headers['x-ai-model'], 64) || null
  };
}

function updateEnvFile(key, value) {
  let content = '';
  if (fs.existsSync(ENV_FILE)) content = fs.readFileSync(ENV_FILE, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map(line => {
    if (line.startsWith(`${key}=`)) { found = true; return value ? `${key}=${value}` : null; }
    return line;
  }).filter(Boolean);
  if (!found && value) updated.push(`${key}=${value}`);
  fs.writeFileSync(ENV_FILE, updated.join('\n') + '\n');
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const agents = agentService.listAgents();
  res.json({
    status:    'ok',
    platform:  'Arbitrum AI Agent Platform',
    version:   VERSION,
    timestamp: new Date().toISOString(),
    agents:    agents.length,
    aiEnabled: config.hasAnyKey(),
    uptime:    Math.floor(process.uptime())
  });
});

// ── Config / API Keys ─────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  reloadConfig();
  const providers = Object.entries(SUPPORTED_PROVIDERS).map(([id, p]) => {
    const key = config.getApiKey(id);
    return {
      id,
      name:         p.name,
      connected:    !!key,
      maskedKey:    key ? key.slice(0, 8) + '...' + key.slice(-4) : null,
      models:       p.models,
      defaultModel: p.defaultModel,
      envVar:       p.envVar,
      docsUrl:      p.docsUrl
    };
  });
  res.json({
    success: true,
    activeProvider: config.getActiveProvider(),
    aiEnabled:      config.hasAnyKey(),
    providers,
    defaultNetwork: config.defaultNetwork,
    version:        VERSION
  });
});

app.post('/api/config/apikey', asyncHandler(async (req, res) => {
  const { provider = 'openai', apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return res.status(400).json({ success: false, error: 'Valid apiKey is required' });
  }
  if (!SUPPORTED_PROVIDERS[provider]) {
    return res.status(400).json({
      success: false,
      error: `Unsupported provider. Choose from: ${Object.keys(SUPPORTED_PROVIDERS).join(', ')}`
    });
  }
  const providerInfo = SUPPORTED_PROVIDERS[provider];
  updateEnvFile(providerInfo.envVar, apiKey.trim());
  reloadConfig();
  res.json({
    success:      true,
    provider,
    providerName: providerInfo.name,
    message:      `${providerInfo.name} API key saved successfully.`,
    aiEnabled:    config.hasAnyKey()
  });
}));

app.delete('/api/config/apikey/:provider', asyncHandler(async (req, res) => {
  const provider = sanitizeString(req.params.provider, 32);
  if (!SUPPORTED_PROVIDERS[provider]) {
    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  }
  updateEnvFile(SUPPORTED_PROVIDERS[provider].envVar, null);
  reloadConfig();
  res.json({ success: true, provider, message: `${SUPPORTED_PROVIDERS[provider].name} API key removed.` });
}));

app.get('/api/config/providers', (req, res) => {
  res.json({
    success: true,
    providers: Object.entries(SUPPORTED_PROVIDERS).map(([id, p]) => ({
      id, name: p.name, models: p.models, defaultModel: p.defaultModel,
      keyPrefix: p.keyPrefix, envVar: p.envVar, docsUrl: p.docsUrl
    }))
  });
});

// ── Agents ────────────────────────────────────────────────────────────────────

app.get('/api/agents', asyncHandler(async (req, res) => {
  res.json({ success: true, agents: agentService.listAgents() });
}));

app.get('/api/agents/active', asyncHandler(async (req, res) => {
  res.json({ success: true, agent: agentService.getActiveAgent() });
}));

app.get('/api/agents/:name', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  res.json({ success: true, agent: agentService.getAgent(name) });
}));

app.post('/api/agents', asyncHandler(async (req, res) => {
  const name    = validateAgentName(req.body.name);
  const type    = validateAgentType(req.body.type);
  const network = validateNetwork(req.body.network);
  const agent   = agentService.createAgent(name, type, network, {
    interestFreeMode: req.body.interestFreeMode === true
  });
  log.info('Agent created', { name, type, network });
  res.status(201).json({ success: true, agent });
}));

app.delete('/api/agents/:name', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  const result = agentService.deleteAgent(name);
  log.info('Agent deleted', { name });
  res.json(result);
}));

app.post('/api/agents/:name/activate', asyncHandler(async (req, res) => {
  const name  = validateAgentName(req.params.name);
  const agent = agentService.setActiveAgent(name);
  res.json({ success: true, agent });
}));

app.post('/api/agents/:name/chat', asyncHandler(async (req, res) => {
  const name    = validateAgentName(req.params.name);
  const message = requireString(req.body.message, 'message', 4096);
  const response = await agentService.chat(name, message, extractAiOptions(req));
  res.json({ success: true, ...response });
}));

// ── Wallet ────────────────────────────────────────────────────────────────────

app.post('/api/agents/:name/wallet/attach', asyncHandler(async (req, res) => {
  const name       = validateAgentName(req.params.name);
  const privateKey = validatePrivateKey(req.body.privateKey);
  const result     = onchainService.attachWallet(name, privateKey);
  log.info('Wallet attached', { name, address: result.address });
  res.json({ success: true, ...result });
}));

app.post('/api/agents/:name/wallet/detach', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  onchainService.detachWallet(name);
  log.info('Wallet detached', { name });
  res.json({ success: true, message: 'Wallet detached' });
}));

app.get('/api/agents/:name/wallet', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  res.json({ success: true, ...onchainService.getWalletInfo(name) });
}));

app.get('/api/agents/:name/portfolio', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  res.json({ success: true, portfolio: await onchainService.getPortfolio(name) });
}));

// ── Swap / Quote ──────────────────────────────────────────────────────────────

app.get('/api/agents/:name/quote', asyncHandler(async (req, res) => {
  const name     = validateAgentName(req.params.name);
  const tokenIn  = validateToken(req.query.tokenIn, 'tokenIn');
  const tokenOut = validateToken(req.query.tokenOut, 'tokenOut');
  const amount   = validateAmount(req.query.amountIn, 'amountIn');
  res.json({ success: true, quote: await onchainService.getQuote(name, tokenIn, tokenOut, amount) });
}));

app.post('/api/agents/:name/swap', asyncHandler(async (req, res) => {
  const name       = validateAgentName(req.params.name);
  const tokenIn    = validateToken(req.body.tokenIn, 'tokenIn');
  const tokenOut   = validateToken(req.body.tokenOut, 'tokenOut');
  const amount     = validateAmount(req.body.amountIn, 'amountIn');
  const slippage   = validateSlippage(req.body.slippageBps);
  log.info('Swap requested', { name, tokenIn, tokenOut, amount });
  const result = await onchainService.executeSwap(name, tokenIn, tokenOut, amount, slippage);
  res.json({ success: true, result });
}));

app.post('/api/agents/:name/ai-trade', asyncHandler(async (req, res) => {
  const name        = validateAgentName(req.params.name);
  const instruction = requireString(req.body.instruction, 'instruction', 1024);
  const result      = await onchainService.aiTrade(name, instruction, extractAiOptions(req));
  res.json({ success: true, result });
}));

// ── Autonomous Loop ───────────────────────────────────────────────────────────

app.post('/api/agents/:name/loop/start', asyncHandler(async (req, res) => {
  const name       = validateAgentName(req.params.name);
  const loopConfig = validateLoopConfig(req.body || {});
  const result     = onchainService.startLoop(name, loopConfig);
  log.info('Autonomous loop started', { name, dryRun: loopConfig.dryRun });
  res.json({ success: true, ...result });
}));

app.post('/api/agents/:name/loop/stop', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  onchainService.stopLoop(name);
  log.info('Autonomous loop stopped', { name });
  res.json({ success: true, message: 'Loop stopped' });
}));

app.get('/api/agents/:name/loop', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  res.json({ success: true, status: onchainService.getLoopStatus(name) });
}));

app.get('/api/agents/:name/loop/stream', (req, res) => {
  const name  = validateAgentName(req.params.name);
  const agent = onchainService.getLiveAgent(name);
  if (!agent) return res.status(404).json({ success: false, error: 'Agent not found or no live instance' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  if (agent._loop) {
    send({ event: 'connected', agent: name, ts: new Date().toISOString() });
    agent._loop.on('*', send);
    req.on('close', () => {
      if (agent._loop?.handlers['*']) {
        agent._loop.handlers['*'] = agent._loop.handlers['*'].filter(h => h !== send);
      }
    });
  } else {
    send({ event: 'error', message: 'No loop running' });
    res.end();
  }
});

// ── Brian API ─────────────────────────────────────────────────────────────────

app.post('/api/agents/:name/intent/build', asyncHandler(async (req, res) => {
  const name    = validateAgentName(req.params.name);
  const prompt  = requireString(req.body.prompt, 'prompt', 512);
  const brianKey = sanitizeString(req.headers['x-brian-api-key'], 256) || process.env.BRIAN_API_KEY;
  const result  = await onchainService.buildIntent(name, prompt, brianKey);
  res.json({ success: true, result });
}));

app.post('/api/agents/:name/intent/execute', asyncHandler(async (req, res) => {
  const name    = validateAgentName(req.params.name);
  const prompt  = requireString(req.body.prompt, 'prompt', 512);
  const brianKey = sanitizeString(req.headers['x-brian-api-key'], 256) || process.env.BRIAN_API_KEY;
  log.info('Intent execute', { name, prompt: prompt.slice(0, 80) });
  const result  = await onchainService.executeIntent(name, prompt, brianKey);
  res.json({ success: true, result });
}));

app.get('/api/agents/:name/lifi-quote', asyncHandler(async (req, res) => {
  const name       = validateAgentName(req.params.name);
  const fromToken  = validateToken(req.query.fromToken, 'fromToken');
  const toToken    = validateToken(req.query.toToken, 'toToken');
  const fromAmount = validateAmount(req.query.fromAmount, 'fromAmount');
  const quote = await onchainService.lifiQuote(name, fromToken, toToken, fromAmount);
  res.json({ success: true, quote });
}));

// Global LiFi quote (no agent needed)
app.get('/api/lifi-quote', asyncHandler(async (req, res) => {
  const fromToken  = validateToken(req.query.tokenIn || req.query.fromToken, 'tokenIn');
  const toToken    = validateToken(req.query.tokenOut || req.query.toToken, 'tokenOut');
  const fromAmount = validateAmount(req.query.amountIn || req.query.fromAmount, 'amountIn');
  const network    = validateNetwork(req.query.network);
  const { LiFiRouter } = await import('../blockchain/brianAPI.js');
  const router = new LiFiRouter(network);
  const quote  = await router.getQuote({ fromToken, toToken, fromAmount: String(fromAmount) });
  res.json({ success: true, quote });
}));

// ── Strategy Engine ───────────────────────────────────────────────────────────

app.get('/api/agents/:name/strategies', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  res.json({ success: true, strategies: onchainService.listStrategies(name) });
}));

app.post('/api/agents/:name/strategies', asyncHandler(async (req, res) => {
  const name     = validateAgentName(req.params.name);
  const body     = validateStrategyBody(req.body);
  const strategy = onchainService.addStrategy(name, body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/dca', asyncHandler(async (req, res) => {
  const name     = validateAgentName(req.params.name);
  const strategy = onchainService.addDCA(name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/stop-loss', asyncHandler(async (req, res) => {
  const name     = validateAgentName(req.params.name);
  const strategy = onchainService.addStopLoss(name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/take-profit', asyncHandler(async (req, res) => {
  const name     = validateAgentName(req.params.name);
  const strategy = onchainService.addTakeProfit(name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/price-alert', asyncHandler(async (req, res) => {
  const name     = validateAgentName(req.params.name);
  const strategy = onchainService.addPriceAlert(name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/rebalance', asyncHandler(async (req, res) => {
  const name     = validateAgentName(req.params.name);
  const strategy = onchainService.addRebalance(name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.delete('/api/agents/:name/strategies/:id', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  const id   = sanitizeString(req.params.id, 64);
  onchainService.removeStrategy(name, id);
  res.json({ success: true });
}));

app.post('/api/agents/:name/strategies/engine/start', asyncHandler(async (req, res) => {
  const name       = validateAgentName(req.params.name);
  const intervalMs = req.body?.intervalMs ? parseInt(req.body.intervalMs) : undefined;
  const result     = onchainService.startStrategyEngine(name, intervalMs);
  res.json({ success: true, ...result });
}));

app.post('/api/agents/:name/strategies/engine/stop', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  onchainService.stopStrategyEngine(name);
  res.json({ success: true });
}));

app.post('/api/agents/:name/strategies/run', asyncHandler(async (req, res) => {
  const name   = validateAgentName(req.params.name);
  const result = await onchainService.runStrategiesNow(name);
  res.json({ success: true, ...result });
}));

// ── Policy Engine ─────────────────────────────────────────────────────────────

app.get('/api/agents/:name/policy', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  res.json({ success: true, policy: onchainService.getPolicy(name) });
}));

app.patch('/api/agents/:name/policy', asyncHandler(async (req, res) => {
  const name    = validateAgentName(req.params.name);
  const updates = validatePolicyUpdate(req.body);
  const policy  = onchainService.updatePolicy(name, updates);
  log.info('Policy updated', { name, updates });
  res.json({ success: true, policy });
}));

app.post('/api/agents/:name/policy/pause', asyncHandler(async (req, res) => {
  const name = validateAgentName(req.params.name);
  const result = onchainService.pausePolicy(name);
  log.warn('Policy paused (emergency)', { name });
  res.json({ success: true, ...result });
}));

app.post('/api/agents/:name/policy/resume', asyncHandler(async (req, res) => {
  const name   = validateAgentName(req.params.name);
  const result = onchainService.resumePolicy(name);
  log.info('Policy resumed', { name });
  res.json({ success: true, ...result });
}));

// ── Analytics ─────────────────────────────────────────────────────────────────

app.get('/api/analytics/prices', asyncHandler(async (req, res) => {
  const prices = await analyticsService.getPrices();
  res.json({ success: true, prices, timestamp: new Date().toISOString() });
}));

app.get('/api/analytics/protocols', asyncHandler(async (req, res) => {
  const limit = validateQueryInt(req.query.limit, 'limit', 1, 50, 15);
  const protocols = await analyticsService.getProtocols(limit);
  res.json({ success: true, protocols, timestamp: new Date().toISOString() });
}));

app.get('/api/analytics/yields', asyncHandler(async (req, res) => {
  const limit = validateQueryInt(req.query.limit, 'limit', 1, 100, 20);
  const yields = await analyticsService.getYields(limit);
  res.json({ success: true, yields, timestamp: new Date().toISOString() });
}));

app.get('/api/analytics/gas', asyncHandler(async (req, res) => {
  const network = validateNetwork(req.query.network || 'mainnet');
  const gas = await analyticsService.getGasEstimates(network);
  res.json({ success: true, ...gas, timestamp: new Date().toISOString() });
}));

// ── Networks ──────────────────────────────────────────────────────────────────

app.get('/api/networks', asyncHandler(async (req, res) => {
  res.json({ success: true, networks: analyticsService.getNetworks() });
}));

app.get('/api/networks/:network', asyncHandler(async (req, res) => {
  const network = validateNetwork(req.params.network);
  res.json({ success: true, ...await analyticsService.getNetworkInfo(network) });
}));

// ── Error Handler ─────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ success: false, error: err.message, field: err.field });
  }
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  log.error('API error', { path: req.path, method: req.method, error: message, status });
  // Never leak stack traces to clients in production
  res.status(status).json({
    success: false,
    error:   status === 500 && process.env.NODE_ENV === 'production'
               ? 'Internal server error'
               : message
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

function gracefulShutdown(server, signal) {
  log.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    log.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => { log.error('Forced shutdown after timeout'); process.exit(1); }, 10_000);
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    const server = app.listen(port, '0.0.0.0', () => {
      log.info(`REST API Server running on port ${port}`);
      console.log(`
    _       _    _ _                      _                _   
   /_\\  _ _| |__(_) |_ _ _ _  _ _ __     /_\\  __ _ ___ _ _| |_ 
  / _ \\| '_| '_ \\ |  _| '_| || | '  \\   / _ \\/ _\` / -_) ' \\  _|
 /_/ \\_\\_| |_.__/_|\\__|_|  \\_,_|_|_|_| /_/ \\_\\__, \\___|_||_\\__|
                                             |___/             
  REST API v${VERSION} — Port ${port}
  Security: Helmet ✓ | Rate Limiting ✓ | Input Validation ✓${API_SECRET ? ' | Auth ✓' : ''}

Available Endpoints:
  GET    /api/health
  GET    /api/config                      GET /api/config/providers
  POST   /api/config/apikey              DELETE /api/config/apikey/:provider

  GET    /api/agents                      POST   /api/agents
  GET    /api/agents/:name               DELETE /api/agents/:name
  POST   /api/agents/:name/chat          POST   /api/agents/:name/activate
  GET    /api/agents/active

  POST   /api/agents/:name/wallet/attach  POST   /api/agents/:name/wallet/detach
  GET    /api/agents/:name/wallet         GET    /api/agents/:name/portfolio
  GET    /api/agents/:name/quote          POST   /api/agents/:name/swap
  POST   /api/agents/:name/ai-trade

  POST   /api/agents/:name/loop/start    POST   /api/agents/:name/loop/stop
  GET    /api/agents/:name/loop          GET    /api/agents/:name/loop/stream (SSE)

  POST   /api/agents/:name/intent/build  POST   /api/agents/:name/intent/execute
  GET    /api/agents/:name/lifi-quote    GET    /api/lifi-quote

  GET    /api/agents/:name/strategies    POST   /api/agents/:name/strategies
  POST   /api/agents/:name/strategies/dca          (+ stop-loss, take-profit, price-alert, rebalance)
  DELETE /api/agents/:name/strategies/:id
  POST   /api/agents/:name/strategies/engine/start
  POST   /api/agents/:name/strategies/engine/stop
  POST   /api/agents/:name/strategies/run

  GET    /api/agents/:name/policy        PATCH  /api/agents/:name/policy
  POST   /api/agents/:name/policy/pause  POST   /api/agents/:name/policy/resume

  GET    /api/analytics/prices           GET    /api/analytics/protocols
  GET    /api/analytics/yields           GET    /api/analytics/gas
  GET    /api/networks                   GET    /api/networks/:network
      `);
      resolve(server);
    });

    process.once('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
    process.once('SIGINT',  () => gracefulShutdown(server, 'SIGINT'));
  });
}

if (process.argv[1].includes('server.js')) {
  startServer();
}

export { app };
