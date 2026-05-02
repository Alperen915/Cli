#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { agentService } from '../services/agentService.js';
import { analyticsService } from '../services/analyticsService.js';
import { onchainService } from '../services/onchainService.js';
import { config, SUPPORTED_PROVIDERS, reloadConfig } from '../utils/config.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.API_PORT || 3000;
const ENV_FILE = path.join(process.cwd(), '.env');

app.use(cors());
app.use(express.json());

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function extractAiOptions(req) {
  const apiKey = req.headers['x-openai-key'] || req.headers['x-api-key'] || null;
  const provider = req.headers['x-ai-provider'] || null;
  const model = req.headers['x-ai-model'] || null;
  return { apiKey, provider, model };
}

function updateEnvFile(key, value) {
  let content = '';
  if (fs.existsSync(ENV_FILE)) {
    content = fs.readFileSync(ENV_FILE, 'utf-8');
  }
  const lines = content.split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return value ? `${key}=${value}` : null;
    }
    return line;
  }).filter(Boolean);
  if (!found && value) updated.push(`${key}=${value}`);
  fs.writeFileSync(ENV_FILE, updated.join('\n') + '\n');
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'Arbitrum AI Agent Platform', version: '1.0.0' });
});

// ── Config / API Keys ─────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  reloadConfig();
  const providers = Object.entries(SUPPORTED_PROVIDERS).map(([id, p]) => {
    const key = config.getApiKey(id);
    return {
      id,
      name: p.name,
      connected: !!key,
      maskedKey: key ? key.slice(0, 8) + '...' + key.slice(-4) : null,
      models: p.models,
      defaultModel: p.defaultModel,
      envVar: p.envVar,
      docsUrl: p.docsUrl
    };
  });

  res.json({
    success: true,
    activeProvider: config.getActiveProvider(),
    aiEnabled: config.hasAnyKey(),
    providers,
    defaultNetwork: config.defaultNetwork
  });
});

app.post('/api/config/apikey', asyncHandler(async (req, res) => {
  const { provider = 'openai', apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ success: false, error: 'apiKey is required' });
  }
  if (!SUPPORTED_PROVIDERS[provider]) {
    return res.status(400).json({
      success: false,
      error: `Unsupported provider. Choose from: ${Object.keys(SUPPORTED_PROVIDERS).join(', ')}`
    });
  }

  const providerInfo = SUPPORTED_PROVIDERS[provider];
  const envVar = providerInfo.envVar;

  updateEnvFile(envVar, apiKey.trim());
  reloadConfig();

  res.json({
    success: true,
    provider,
    providerName: providerInfo.name,
    message: `${providerInfo.name} API key saved successfully.`,
    aiEnabled: config.hasAnyKey()
  });
}));

app.delete('/api/config/apikey/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  if (!SUPPORTED_PROVIDERS[provider]) {
    return res.status(400).json({
      success: false,
      error: `Unknown provider: ${provider}`
    });
  }
  const envVar = SUPPORTED_PROVIDERS[provider].envVar;
  updateEnvFile(envVar, null);
  reloadConfig();

  res.json({
    success: true,
    provider,
    message: `${SUPPORTED_PROVIDERS[provider].name} API key removed.`
  });
}));

app.get('/api/config/providers', (req, res) => {
  res.json({
    success: true,
    providers: Object.entries(SUPPORTED_PROVIDERS).map(([id, p]) => ({
      id,
      name: p.name,
      models: p.models,
      defaultModel: p.defaultModel,
      keyPrefix: p.keyPrefix,
      envVar: p.envVar,
      docsUrl: p.docsUrl
    }))
  });
});

// ── Agents ────────────────────────────────────────────────────────────────────

app.get('/api/agents', asyncHandler(async (req, res) => {
  const agents = agentService.listAgents();
  res.json({ success: true, agents });
}));

app.get('/api/agents/active', asyncHandler(async (req, res) => {
  const agent = agentService.getActiveAgent();
  res.json({ success: true, agent });
}));

app.get('/api/agents/:name', asyncHandler(async (req, res) => {
  const agent = agentService.getAgent(req.params.name);
  res.json({ success: true, agent });
}));

app.post('/api/agents', asyncHandler(async (req, res) => {
  const { name, type, network, interestFreeMode } = req.body;
  const agent = agentService.createAgent(name, type, network, { interestFreeMode });
  res.status(201).json({ success: true, agent });
}));

app.delete('/api/agents/:name', asyncHandler(async (req, res) => {
  const result = agentService.deleteAgent(req.params.name);
  res.json(result);
}));

app.post('/api/agents/:name/activate', asyncHandler(async (req, res) => {
  const agent = agentService.setActiveAgent(req.params.name);
  res.json({ success: true, agent });
}));

app.post('/api/agents/:name/chat', asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }
  const aiOptions = extractAiOptions(req);
  const response = await agentService.chat(req.params.name, message, aiOptions);
  res.json({ success: true, ...response });
}));

// ── On-Chain: Wallet ──────────────────────────────────────────────────────────

// Attach wallet (private key session-only, never persisted)
app.post('/api/agents/:name/wallet/attach', asyncHandler(async (req, res) => {
  const { privateKey } = req.body;
  if (!privateKey) return res.status(400).json({ success: false, error: 'privateKey is required' });
  const result = onchainService.attachWallet(req.params.name, privateKey);
  res.json({ success: true, ...result });
}));

// Detach wallet
app.post('/api/agents/:name/wallet/detach', asyncHandler(async (req, res) => {
  onchainService.detachWallet(req.params.name);
  res.json({ success: true, message: 'Wallet detached' });
}));

// Wallet status
app.get('/api/agents/:name/wallet', asyncHandler(async (req, res) => {
  const info = onchainService.getWalletInfo(req.params.name);
  res.json({ success: true, ...info });
}));

// Portfolio
app.get('/api/agents/:name/portfolio', asyncHandler(async (req, res) => {
  const portfolio = await onchainService.getPortfolio(req.params.name);
  res.json({ success: true, portfolio });
}));

// ── On-Chain: Swap / Quote ────────────────────────────────────────────────────

// Get swap quote (no tx)
app.get('/api/agents/:name/quote', asyncHandler(async (req, res) => {
  const { tokenIn, tokenOut, amountIn } = req.query;
  if (!tokenIn || !tokenOut || !amountIn) {
    return res.status(400).json({ success: false, error: 'tokenIn, tokenOut, amountIn are required' });
  }
  const quote = await onchainService.getQuote(req.params.name, tokenIn, tokenOut, amountIn);
  res.json({ success: true, quote });
}));

// Execute swap
app.post('/api/agents/:name/swap', asyncHandler(async (req, res) => {
  const { tokenIn, tokenOut, amountIn, slippageBps } = req.body;
  if (!tokenIn || !tokenOut || !amountIn) {
    return res.status(400).json({ success: false, error: 'tokenIn, tokenOut, amountIn are required' });
  }
  const result = await onchainService.executeSwap(req.params.name, tokenIn, tokenOut, amountIn, slippageBps);
  res.json({ success: true, result });
}));

// AI-guided trade
app.post('/api/agents/:name/ai-trade', asyncHandler(async (req, res) => {
  const { instruction } = req.body;
  if (!instruction) return res.status(400).json({ success: false, error: 'instruction is required' });
  const aiOptions = extractAiOptions(req);
  const result = await onchainService.aiTrade(req.params.name, instruction, aiOptions);
  res.json({ success: true, result });
}));

// ── Autonomous Loop ───────────────────────────────────────────────────────────

// Start loop
app.post('/api/agents/:name/loop/start', asyncHandler(async (req, res) => {
  const loopConfig = req.body || {};
  const result = onchainService.startLoop(req.params.name, loopConfig);
  res.json({ success: true, ...result });
}));

// Stop loop
app.post('/api/agents/:name/loop/stop', asyncHandler(async (req, res) => {
  onchainService.stopLoop(req.params.name);
  res.json({ success: true, message: 'Loop stopped' });
}));

// Loop status
app.get('/api/agents/:name/loop', asyncHandler(async (req, res) => {
  const status = onchainService.getLoopStatus(req.params.name);
  res.json({ success: true, status });
}));

// Loop events (SSE stream)
app.get('/api/agents/:name/loop/stream', (req, res) => {
  const agentName = req.params.name;
  const agent = onchainService.getLiveAgent(agentName);
  if (!agent) return res.status(404).json({ success: false, error: 'Agent not found or no live instance' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const handler = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (agent._loop) {
    agent._loop.on('*', handler);
    res.on('close', () => {
      if (agent._loop?.handlers['*']) {
        agent._loop.handlers['*'] = agent._loop.handlers['*'].filter(h => h !== handler);
      }
    });
  } else {
    res.write(`data: ${JSON.stringify({ event: 'error', message: 'No loop running' })}\n\n`);
    res.end();
  }
});

// ── Brian API — Natural Language Intent ───────────────────────────────────────

// Build tx from natural language (no wallet needed, returns calldata)
app.post('/api/agents/:name/intent/build', asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });
  const brianKey = req.headers['x-brian-api-key'] || process.env.BRIAN_API_KEY;
  const result = await onchainService.buildIntent(req.params.name, prompt, brianKey);
  res.json({ success: true, result });
}));

// Build + sign + broadcast from natural language (wallet required)
app.post('/api/agents/:name/intent/execute', asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });
  const brianKey = req.headers['x-brian-api-key'] || process.env.BRIAN_API_KEY;
  const result = await onchainService.executeIntent(req.params.name, prompt, brianKey);
  res.json({ success: true, result });
}));

// LiFi multi-DEX quote (free, no auth)
app.get('/api/agents/:name/lifi-quote', asyncHandler(async (req, res) => {
  const { fromToken, toToken, fromAmount } = req.query;
  if (!fromToken || !toToken || !fromAmount) {
    return res.status(400).json({ success: false, error: 'fromToken, toToken, fromAmount required' });
  }
  const quote = await onchainService.lifiQuote(req.params.name, fromToken, toToken, fromAmount);
  res.json({ success: true, quote });
}));

// ── Strategy Engine ───────────────────────────────────────────────────────────

app.get('/api/agents/:name/strategies', asyncHandler(async (req, res) => {
  const strategies = onchainService.listStrategies(req.params.name);
  res.json({ success: true, strategies });
}));

app.post('/api/agents/:name/strategies', asyncHandler(async (req, res) => {
  const strategy = onchainService.addStrategy(req.params.name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/dca', asyncHandler(async (req, res) => {
  const strategy = onchainService.addDCA(req.params.name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/stop-loss', asyncHandler(async (req, res) => {
  const strategy = onchainService.addStopLoss(req.params.name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/take-profit', asyncHandler(async (req, res) => {
  const strategy = onchainService.addTakeProfit(req.params.name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/price-alert', asyncHandler(async (req, res) => {
  const strategy = onchainService.addPriceAlert(req.params.name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.post('/api/agents/:name/strategies/rebalance', asyncHandler(async (req, res) => {
  const strategy = onchainService.addRebalance(req.params.name, req.body);
  res.status(201).json({ success: true, strategy });
}));

app.delete('/api/agents/:name/strategies/:id', asyncHandler(async (req, res) => {
  onchainService.removeStrategy(req.params.name, req.params.id);
  res.json({ success: true });
}));

app.post('/api/agents/:name/strategies/engine/start', asyncHandler(async (req, res) => {
  const { intervalMs } = req.body || {};
  const result = onchainService.startStrategyEngine(req.params.name, intervalMs);
  res.json({ success: true, ...result });
}));

app.post('/api/agents/:name/strategies/engine/stop', asyncHandler(async (req, res) => {
  onchainService.stopStrategyEngine(req.params.name);
  res.json({ success: true });
}));

app.post('/api/agents/:name/strategies/run', asyncHandler(async (req, res) => {
  const result = await onchainService.runStrategiesNow(req.params.name);
  res.json({ success: true, ...result });
}));

// ── Policy Engine ─────────────────────────────────────────────────────────────

app.get('/api/agents/:name/policy', asyncHandler(async (req, res) => {
  const policy = onchainService.getPolicy(req.params.name);
  res.json({ success: true, policy });
}));

app.patch('/api/agents/:name/policy', asyncHandler(async (req, res) => {
  const policy = onchainService.updatePolicy(req.params.name, req.body);
  res.json({ success: true, policy });
}));

app.post('/api/agents/:name/policy/pause', asyncHandler(async (req, res) => {
  const result = onchainService.pausePolicy(req.params.name);
  res.json({ success: true, ...result });
}));

app.post('/api/agents/:name/policy/resume', asyncHandler(async (req, res) => {
  const result = onchainService.resumePolicy(req.params.name);
  res.json({ success: true, ...result });
}));

// ── Analytics ─────────────────────────────────────────────────────────────────

app.get('/api/analytics/prices', asyncHandler(async (req, res) => {
  const prices = await analyticsService.getPrices();
  res.json({ success: true, prices, timestamp: new Date().toISOString() });
}));

app.get('/api/analytics/protocols', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 15;
  const protocols = await analyticsService.getProtocols(limit);
  res.json({ success: true, protocols, timestamp: new Date().toISOString() });
}));

app.get('/api/analytics/yields', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const yields = await analyticsService.getYields(limit);
  res.json({ success: true, yields, timestamp: new Date().toISOString() });
}));

app.get('/api/analytics/gas', asyncHandler(async (req, res) => {
  const network = req.query.network || 'mainnet';
  const gas = await analyticsService.getGasEstimates(network);
  res.json({ success: true, ...gas, timestamp: new Date().toISOString() });
}));

// ── Networks ──────────────────────────────────────────────────────────────────

app.get('/api/networks', asyncHandler(async (req, res) => {
  const networks = analyticsService.getNetworks();
  res.json({ success: true, networks });
}));

app.get('/api/networks/:network', asyncHandler(async (req, res) => {
  const info = await analyticsService.getNetworkInfo(req.params.network);
  res.json({ success: true, ...info });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('API Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`
    _       _    _ _                      _                _   
   /_\\  _ _| |__(_) |_ _ _ _  _ _ __     /_\\  __ _ ___ _ _| |_ 
  / _ \\| '_| '_ \\ |  _| '_| || | '  \\   / _ \\/ _\` / -_) ' \\  _|
 /_/ \\_\\_| |_.__/_|\\__|_|  \\_,_|_|_|_| /_/ \\_\\__, \\___|_||_\\__|
                                             |___/             
  REST API Server — Port ${port}

Available Endpoints:
  GET    /api/health                      Health check
  GET    /api/config                      Current AI provider config
  POST   /api/config/apikey               Save API key  { provider, apiKey }
  DELETE /api/config/apikey/:provider     Remove API key
  GET    /api/config/providers            List supported AI providers

  GET    /api/agents                      List agents
  POST   /api/agents                      Create agent
  GET    /api/agents/:name                Get agent
  DELETE /api/agents/:name                Delete agent
  POST   /api/agents/:name/chat           Chat with agent
  POST   /api/agents/:name/activate       Set active agent
  GET    /api/agents/active               Get active agent

  POST   /api/agents/:name/wallet/attach  Attach wallet { privateKey }
  POST   /api/agents/:name/wallet/detach  Detach wallet
  GET    /api/agents/:name/wallet         Wallet status
  GET    /api/agents/:name/portfolio      On-chain portfolio
  GET    /api/agents/:name/quote          Swap quote ?tokenIn=ETH&tokenOut=USDC&amountIn=0.01
  POST   /api/agents/:name/swap           Execute swap { tokenIn, tokenOut, amountIn, slippageBps }
  POST   /api/agents/:name/ai-trade       AI-guided trade { instruction }
  POST   /api/agents/:name/loop/start     Start autonomous loop { dryRun, intervalMs, strategy }
  POST   /api/agents/:name/loop/stop      Stop loop
  GET    /api/agents/:name/loop           Loop status
  GET    /api/agents/:name/loop/stream    SSE stream of loop events

  GET    /api/analytics/prices            Live token prices
  GET    /api/analytics/protocols         Top protocols by TVL
  GET    /api/analytics/yields            Best yield opportunities
  GET    /api/analytics/gas               Gas estimates
  GET    /api/networks                    Available networks
  GET    /api/networks/:network           Network info

Per-request AI key headers:
  X-OpenAI-Key   or  X-Api-Key           Override API key for this request
  X-AI-Provider                           openai | anthropic | gemini
  X-AI-Model                              Override model for this request
      `);
      resolve(server);
    });
  });
}

if (process.argv[1].includes('server.js')) {
  startServer();
}

export { app };
