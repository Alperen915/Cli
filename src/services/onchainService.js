/**
 * OnChain Service
 *
 * Maintains in-memory live agent instances with wallets attached.
 * Private keys are NEVER persisted — stored only in process memory.
 * Instances are cleared when the server restarts.
 */
import { AgentManager } from '../agents/agentManager.js';
import { TradingAgent } from '../agents/tradingAgent.js';
import { DeFiAgent } from '../agents/defiAgent.js';
import { OnchainAgent } from '../agents/onchainAgent.js';
import { NFTAgent } from '../agents/nftAgent.js';
import { SocialAgent } from '../agents/socialAgent.js';
import { CustomAgent } from '../agents/customAgent.js';
import { BaseAgent } from '../agents/baseAgent.js';
import { storage } from '../utils/storage.js';

// ── Live agent registry (in-memory, session-only) ─────────────────────────────
const liveAgents = new Map();

function buildLiveAgent(agentData) {
  const opts = { interestFreeMode: agentData.interestFreeMode === true };
  let agent;
  switch (agentData.type) {
    case 'trading':  agent = new TradingAgent(agentData.name, agentData.network, opts); break;
    case 'defi':     agent = new DeFiAgent(agentData.name, agentData.network, opts);    break;
    case 'onchain':  agent = new OnchainAgent(agentData.name, agentData.network, opts); break;
    case 'nft':      agent = new NFTAgent(agentData.name, agentData.network, opts);     break;
    case 'social':   agent = new SocialAgent(agentData.name, agentData.network, opts);  break;
    case 'custom':   agent = new CustomAgent(agentData.name, agentData.network, opts);  break;
    default:         agent = new BaseAgent(agentData.name, agentData.type, agentData.network, opts);
  }
  agent.created = agentData.created;
  return agent;
}

function getOrCreateLiveAgent(name) {
  if (liveAgents.has(name)) return liveAgents.get(name);

  // Try to load from storage
  const saved = storage.loadAgents().find(a => a.name === name);
  if (!saved) throw new Error(`Agent "${name}" not found`);

  const agent = buildLiveAgent(saved);
  liveAgents.set(name, agent);
  return agent;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const onchainService = {

  getLiveAgent(name) {
    return liveAgents.get(name) || null;
  },

  // ── Wallet ────────────────────────────────────────────────────────────────

  attachWallet(name, privateKey) {
    const agent = getOrCreateLiveAgent(name);
    const result = agent.attachWallet(privateKey);
    liveAgents.set(name, agent);
    return {
      address:  result.address,
      network:  result.network,
      message:  'Wallet attached (session-only, not persisted)'
    };
  },

  detachWallet(name) {
    const agent = liveAgents.get(name);
    if (agent) {
      if (agent._loop?.running) agent.stopAutonomousLoop();
      agent.detachWallet();
    }
  },

  getWalletInfo(name) {
    const agent = liveAgents.get(name);
    if (!agent || !agent.hasWallet()) {
      return { connected: false };
    }
    return {
      connected: true,
      address:   agent.getAddress(),
      network:   agent.network
    };
  },

  async getPortfolio(name) {
    const agent = getOrCreateLiveAgent(name);
    if (!agent.hasWallet()) throw new Error('Wallet not connected. POST /wallet/attach first.');
    return agent.getPortfolio();
  },

  // ── Quotes & Swaps ────────────────────────────────────────────────────────

  async getQuote(name, tokenIn, tokenOut, amountIn) {
    // Quote doesn't need a wallet, just an executor — but we need the network
    const agent = getOrCreateLiveAgent(name);

    // If no wallet, still build executor just for reading
    if (!agent.executor) {
      const { OnChainExecutor } = await import('../blockchain/executor.js');
      const { ArbitrumWallet }  = await import('../blockchain/wallet.js');
      const w = new ArbitrumWallet(agent.network);
      agent.executor = new OnChainExecutor(w.provider, agent.network);
    }

    return agent.executor.getSwapQuote({ tokenInSymbol: tokenIn, tokenOutSymbol: tokenOut, amountIn });
  },

  async executeSwap(name, tokenIn, tokenOut, amountIn, slippageBps = 50) {
    const agent = getOrCreateLiveAgent(name);
    if (!agent.hasWallet()) throw new Error('Wallet not connected. POST /wallet/attach first.');
    return agent.executeSwap(tokenIn, tokenOut, amountIn, slippageBps);
  },

  async aiTrade(name, instruction, aiOptions = {}) {
    const agent = getOrCreateLiveAgent(name);
    if (aiOptions.apiKey || aiOptions.provider) {
      agent._initAI(aiOptions.provider || 'openai', aiOptions.apiKey, { model: aiOptions.model });
    }
    if (typeof agent.aiTrade === 'function') return agent.aiTrade(instruction);
    if (typeof agent.aiDefi  === 'function') return agent.aiDefi(instruction);
    return agent.think(instruction);
  },

  // ── Autonomous Loop ───────────────────────────────────────────────────────

  startLoop(name, loopConfig = {}) {
    const agent = getOrCreateLiveAgent(name);
    const loop  = agent.startAutonomousLoop(loopConfig);

    loop.on('decision', d => {
      process.stdout.write(`[${name}][Loop] Cycle ${d.cycle}: ${d.action} — ${d.thought?.slice(0,80)}\n`);
    });
    loop.on('error', e => {
      process.stderr.write(`[${name}][Loop Error] ${e.error}\n`);
    });

    return {
      started:  true,
      dryRun:   loopConfig.dryRun !== false,
      strategy: loopConfig.strategy || 'balanced',
      intervalMs: loopConfig.intervalMs || 30000,
      message:  loopConfig.dryRun !== false
        ? 'Loop started in SIMULATION mode (dryRun: true). Set dryRun: false for real trades.'
        : 'Loop started in LIVE mode. Real transactions will be executed!'
    };
  },

  stopLoop(name) {
    const agent = liveAgents.get(name);
    if (agent) agent.stopAutonomousLoop();
  },

  getLoopStatus(name) {
    const agent = liveAgents.get(name);
    if (!agent) return { running: false, message: 'No live agent instance' };
    return agent.getLoopStatus();
  },

  // ── Brian API — Natural Language → Tx ────────────────────────────────────

  async buildIntent(name, prompt, brianApiKey) {
    const agent = getOrCreateLiveAgent(name);
    if (brianApiKey) agent._initBrian(brianApiKey);
    return agent.buildIntent(prompt);
  },

  async executeIntent(name, prompt, brianApiKey) {
    const agent = getOrCreateLiveAgent(name);
    if (!agent.hasWallet()) throw new Error('Wallet not connected. POST /wallet/attach first.');
    if (brianApiKey) agent._initBrian(brianApiKey);
    return agent.intend(prompt);
  },

  // ── LiFi Aggregator ───────────────────────────────────────────────────────

  async lifiQuote(name, fromToken, toToken, fromAmountWei) {
    const agent = getOrCreateLiveAgent(name);
    return agent.lifiQuote(fromToken, toToken, fromAmountWei);
  },

  // ── Strategy Engine ───────────────────────────────────────────────────────

  addStrategy(name, config) {
    const agent = getOrCreateLiveAgent(name);
    return agent.strategyEngine.add(config).toJSON();
  },

  addDCA(name, config) {
    const agent = getOrCreateLiveAgent(name);
    return agent.strategyEngine.addDCA(config).toJSON();
  },

  addStopLoss(name, config) {
    const agent = getOrCreateLiveAgent(name);
    return agent.strategyEngine.addStopLoss(config).toJSON();
  },

  addTakeProfit(name, config) {
    const agent = getOrCreateLiveAgent(name);
    return agent.strategyEngine.addTakeProfit(config).toJSON();
  },

  addPriceAlert(name, config) {
    const agent = getOrCreateLiveAgent(name);
    return agent.strategyEngine.addPriceAlert(config).toJSON();
  },

  addRebalance(name, config) {
    const agent = getOrCreateLiveAgent(name);
    return agent.strategyEngine.addRebalance(config).toJSON();
  },

  listStrategies(name) {
    const agent = getOrCreateLiveAgent(name);
    return agent.strategyEngine.list();
  },

  removeStrategy(name, strategyId) {
    const agent = getOrCreateLiveAgent(name);
    agent.strategyEngine.remove(strategyId);
  },

  enableStrategy(name, strategyId) {
    const agent = getOrCreateLiveAgent(name);
    agent.strategyEngine.enable(strategyId);
  },

  disableStrategy(name, strategyId) {
    const agent = getOrCreateLiveAgent(name);
    agent.strategyEngine.disable(strategyId);
  },

  startStrategyEngine(name, intervalMs = 60000) {
    const agent = getOrCreateLiveAgent(name);
    agent.strategyEngine.start(intervalMs);
    return { started: true, intervalMs };
  },

  stopStrategyEngine(name) {
    const agent = liveAgents.get(name);
    if (agent) agent.strategyEngine.stop();
  },

  async runStrategiesNow(name) {
    const agent = getOrCreateLiveAgent(name);
    const prices = await agent.strategyEngine._fetchPrices();
    const triggered = await agent.strategyEngine.runNow(prices);
    return { triggered, prices };
  },

  // ── Policy Engine ─────────────────────────────────────────────────────────

  getPolicy(name) {
    const agent = getOrCreateLiveAgent(name);
    return agent.policy.getStatus();
  },

  updatePolicy(name, updates) {
    const agent = getOrCreateLiveAgent(name);
    agent.policy.update(updates);
    return agent.policy.getStatus();
  },

  pausePolicy(name) {
    const agent = getOrCreateLiveAgent(name);
    agent.policy.pause();
    return { paused: true };
  },

  resumePolicy(name) {
    const agent = getOrCreateLiveAgent(name);
    agent.policy.resume();
    return { paused: false };
  },

  // ── Serialize ─────────────────────────────────────────────────────────────

  serializeAgent(agent) {
    const info = agent.getInfo();
    return {
      name:            info.name,
      type:            info.type,
      network:         info.network,
      status:          info.status,
      walletConnected: info.walletConnected,
      walletAddress:   info.walletAddress,
      loopRunning:     info.loopRunning,
      aiEnabled:       info.aiEnabled,
      aiProvider:      info.aiProvider,
      interestFreeMode:info.interestFreeMode
    };
  }
};
