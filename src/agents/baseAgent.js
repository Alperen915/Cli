import OpenAI from 'openai';
import { ethers } from 'ethers';
import { config, SUPPORTED_PROVIDERS } from '../utils/config.js';
import { display } from '../utils/display.js';
import { ArbitrumWallet } from '../blockchain/wallet.js';
import { OnChainExecutor } from '../blockchain/executor.js';
import { AutonomousLoop } from './autonomousLoop.js';
import { BrianAPI, LiFiRouter } from '../blockchain/brianAPI.js';
import { StrategyEngine } from './strategies.js';
import { PolicyEngine } from './policyEngine.js';
import { storage } from '../utils/storage.js';

export class BaseAgent {
  constructor(name, type, network = 'sepolia', options = {}) {
    this.name    = name;
    this.type    = type;
    this.network = network;
    this.status  = 'initialized';
    this.memory  = [];
    this.interestFreeMode = options.interestFreeMode || false;
    this.capabilities = this.filterCapabilities(config.agentTypes[type]?.capabilities || []);

    // Wallet / executor (null until attachWallet() is called)
    this.signer   = null;
    this.executor = null;
    this._wallet  = new ArbitrumWallet(network);

    // Autonomous loop
    this._loop = null;

    // Brian API (natural language → tx calldata)
    this._brian = null;
    this._lifi  = new LiFiRouter(network);
    this._initBrian(options.brianApiKey || process.env.BRIAN_API_KEY);

    // Strategy engine (use strategyEngine to avoid conflict with subclass .strategies arrays)
    this.strategyEngine = new StrategyEngine(this);
    // Load persisted strategies async (non-blocking)
    this.strategyEngine.loadPersistedStrategies().catch(() => {});

    // Load persisted memory (non-blocking)
    try { this.memory = storage.loadMemory(name); } catch { this.memory = []; }

    // Policy engine (spending limits & safety)
    this.policy = new PolicyEngine({
      maxTxSizeEth:     options.maxTxSizeEth    ?? 0.1,
      maxDailySpendEth: options.maxDailySpendEth ?? 1.0,
      interestFreeMode: options.interestFreeMode ?? false,
      allowedTokens:    options.allowedTokens    ?? null,
      blockedTokens:    options.blockedTokens    ?? []
    });

    // AI client — pick key from active provider automatically
    const provider = options.provider || config.getActiveProvider() || 'openai';
    const apiKey   = options.apiKey || config.getApiKey(provider);
    this._initAI(provider, apiKey, options);
  }

  // ── AI Setup ──────────────────────────────────────────────────────────────

  _initAI(provider, apiKey, options = {}) {
    this.aiProvider = null;
    this.aiModel    = null;
    this.openai     = null;

    if (!apiKey) return;

    try {
      if (provider === 'openai') {
        this.openai     = new OpenAI({ apiKey });
        this.aiProvider = 'openai';
        this.aiModel    = options.model || SUPPORTED_PROVIDERS.openai.defaultModel;

      } else if (provider === 'anthropic') {
        this.openai = new OpenAI({
          apiKey,
          baseURL: 'https://api.anthropic.com/v1',
          defaultHeaders: { 'anthropic-version': '2023-06-01', 'x-api-key': apiKey }
        });
        this.aiProvider = 'anthropic';
        this.aiModel    = options.model || SUPPORTED_PROVIDERS.anthropic.defaultModel;

      } else if (provider === 'gemini') {
        this.openai = new OpenAI({
          apiKey,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai'
        });
        this.aiProvider = 'gemini';
        this.aiModel    = options.model || SUPPORTED_PROVIDERS.gemini.defaultModel;
      }
    } catch {
      this.openai = null;
    }
  }

  // ── Brian API ─────────────────────────────────────────────────────────────

  _initBrian(apiKey) {
    if (apiKey) {
      this._brian = new BrianAPI(apiKey);
    }
  }

  hasBrian() { return this._brian !== null; }

  /**
   * Natural language → real on-chain transaction
   * "Swap 0.01 ETH to USDC" → builds calldata → signs → broadcasts
   */
  async intend(prompt) {
    if (!this._brian) throw new Error('Brian API key not set. Add BRIAN_API_KEY env var or pass brianApiKey option.');
    if (!this.signer)  throw new Error('Wallet not connected. Call attachWallet(privateKey) first.');
    return this._brian.intend(prompt, this.signer, this.network);
  }

  /**
   * Build tx calldata from natural language without executing
   */
  async buildIntent(prompt) {
    if (!this._brian) throw new Error('Brian API key not set.');
    const address = this.signer?.address || '0x0000000000000000000000000000000000000001';
    return this._brian.buildTransaction(prompt, address, this.network);
  }

  /**
   * LiFi multi-DEX quote (free, no key required)
   * Better routing than direct Uniswap V3
   */
  async lifiQuote(fromToken, toToken, fromAmountWei, fromAddress) {
    return this._lifi.getQuote({
      fromToken, toToken,
      fromAmount: fromAmountWei,
      fromAddress: fromAddress || this.signer?.address
    });
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  attachWallet(privateKey) {
    const provider = this._wallet.provider;
    this.signer   = new ethers.Wallet(privateKey, provider);
    this.executor = new OnChainExecutor(provider, this.network);
    this.status   = 'wallet_connected';
    return { address: this.signer.address, network: this.network };
  }

  detachWallet() {
    this.signer   = null;
    this.executor = null;
    this.status   = 'initialized';
  }

  hasWallet()  { return this.signer !== null; }
  getAddress() { return this.signer?.address || null; }

  async getEthBalance() {
    if (!this.executor || !this.signer) throw new Error('No wallet connected');
    return this.executor.getEthBalance(this.signer.address);
  }

  async getTokenBalance(symbol) {
    if (!this.executor || !this.signer) throw new Error('No wallet connected');
    const { getTokenAddress } = await import('../blockchain/contracts.js');
    const addr = getTokenAddress(symbol, this.network);
    if (!addr || addr === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Token ${symbol} not available on ${this.network}`);
    }
    return this.executor.getTokenBalance(addr, this.signer.address);
  }

  async getPortfolio() {
    if (!this.executor || !this.signer) throw new Error('No wallet connected');
    return this.executor.getPortfolio(this.signer.address);
  }

  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    if (!this.executor) throw new Error('No wallet connected');
    return this.executor.getSwapQuote({ tokenInSymbol: tokenIn, tokenOutSymbol: tokenOut, amountIn });
  }

  async executeSwap(tokenIn, tokenOut, amountIn, slippageBps = 50) {
    if (!this.executor || !this.signer) throw new Error('No wallet connected');

    // Policy check
    this.policy.check({ type: 'swap', tokenIn, tokenOut, amountEth: parseFloat(amountIn), slippageBps });

    const result = await this.executor.executeSwap(this.signer, {
      tokenInSymbol: tokenIn, tokenOutSymbol: tokenOut, amountIn, slippageBps
    });

    // Record spend
    this.policy.record(amountIn);
    return result;
  }

  async transferToken(symbol, to, amount) {
    if (!this.executor || !this.signer) throw new Error('No wallet connected');
    return this.executor.transferToken(this.signer, symbol, to, amount);
  }

  async transferETH(to, amount) {
    if (!this.executor || !this.signer) throw new Error('No wallet connected');
    return this.executor.transferETH(this.signer, to, amount);
  }

  // ── Autonomous Loop ───────────────────────────────────────────────────────

  startAutonomousLoop(loopConfig = {}) {
    if (this._loop?.running) throw new Error('Autonomous loop is already running');
    this._loop = new AutonomousLoop(this);
    this._loop.start(loopConfig);
    this.status = loopConfig.dryRun !== false ? 'autonomous_simulation' : 'autonomous_live';
    return this._loop;
  }

  stopAutonomousLoop() {
    if (this._loop) {
      this._loop.stop();
      this._loop = null;
    }
    this.status = this.signer ? 'wallet_connected' : 'initialized';
  }

  getLoopStatus() {
    if (!this._loop) return { running: false };
    return this._loop.getStatus();
  }

  // ── AI Think ─────────────────────────────────────────────────────────────

  filterCapabilities(caps) {
    if (!this.interestFreeMode) return caps;
    const interestBased = ['lending', 'borrowing', 'margin trading', 'leveraged trading', 'interest'];
    return caps.filter(c => !interestBased.some(ib => c.toLowerCase().includes(ib)));
  }

  async initialize() {
    this.status = 'active';
    return this;
  }

  hasAI() { return this.openai !== null; }

  async think(input) {
    if (!this.openai) return this.fallbackThink(input);

    this.memory.push({ role: 'user', content: input });

    try {
      const response = await this.openai.chat.completions.create({
        model: this.aiModel || 'gpt-4o',
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          ...this.memory.slice(-10)
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content);
      this.memory.push({ role: 'assistant', content: JSON.stringify(result) });
      storage.saveMemory(this.name, this.memory);
      return result;

    } catch (error) {
      return { thought: `Error: ${error.message}`, action: 'error', reasoning: 'AI error.' };
    }
  }

  async *thinkStream(input) {
    if (!this.openai) {
      yield JSON.stringify(this.fallbackThink(input));
      return;
    }

    this.memory.push({ role: 'user', content: input });

    try {
      const stream = await this.openai.chat.completions.create({
        model:  this.aiModel || 'gpt-4o',
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          ...this.memory.slice(-10)
        ],
        stream: true
      });

      let full = '';
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) { full += token; yield token; }
      }
      this.memory.push({ role: 'assistant', content: full });
      storage.saveMemory(this.name, this.memory);
    } catch (error) {
      yield JSON.stringify({ thought: `Error: ${error.message}`, action: 'error' });
    }
  }

  getSystemPrompt() {
    const walletInfo = this.signer
      ? `\nWallet connected: ${this.signer.address} on ${this.network}`
      : '\nNo wallet connected (read-only mode)';

    const interestFreeNotice = this.interestFreeMode
      ? `\n\nIMPORTANT: INTEREST-FREE MODE (Halal-compliant).
NEVER suggest: lending, borrowing, margin trading, leveraged trading, interest-bearing yield.
FOCUS ON: spot trading, staking for governance, LP fee earnings, NFT trading.`
      : '';

    return `You are ${this.name}, an autonomous AI agent on the Arbitrum blockchain.
Type: ${this.type} | Network: ${this.network}${walletInfo}${interestFreeNotice}
Capabilities: ${this.capabilities.join(', ')}

You can execute REAL on-chain transactions when a wallet is connected:
- Token swaps (Uniswap V3, Camelot)
- Portfolio management
- Balance checks
- Gas-optimized execution

Respond in JSON:
{
  "thought": "your analysis",
  "action": "what to do",
  "reasoning": "why",
  "parameters": {}
}`;
  }

  async chat(message)   { return this.think(message); }
  async analyze(params) { return this.think(`Analyze: ${JSON.stringify(params)}`); }
  async recommend(params){ return this.think(`Recommend for: ${JSON.stringify(params)}`); }

  fallbackThink(input) {
    const low = input.toLowerCase();
    if (low.includes('help') || low.includes('what can')) {
      return {
        thought:   `I am ${this.name}, a ${this.type} agent on ${this.network}.`,
        action:    'info',
        reasoning: `Capabilities: ${this.capabilities.join(', ')}. Connect an AI key for full intelligence.`,
        tip:       'Use "config set" to connect OpenAI, Anthropic or Gemini.'
      };
    }
    return {
      thought:   'AI capabilities limited without API key.',
      action:    'setup_recommended',
      reasoning: 'Set an AI API key (OpenAI, Anthropic, or Gemini) for intelligent responses.',
      tip:       `node index.js config set`
    };
  }

  getInfo() {
    return {
      name:            this.name,
      type:            this.type,
      status:          this.status,
      network:         this.network,
      interestFreeMode:this.interestFreeMode,
      capabilities:    this.capabilities,
      memorySize:      this.memory.length,
      aiEnabled:       this.hasAI(),
      aiProvider:      this.aiProvider,
      aiModel:         this.aiModel,
      brianEnabled:    this.hasBrian(),
      walletConnected: this.hasWallet(),
      walletAddress:   this.getAddress(),
      loopRunning:     this._loop?.running || false,
      strategyCount:   this.strategyEngine?.strategies?.size ?? 0,
      policyStatus:    this.policy?.getStatus?.() ?? null,
      created:         this.created
    };
  }

  clearMemory() {
    this.memory = [];
    storage.deleteMemory(this.name);
  }

  getMemory() { return this.memory; }
}
