import { BaseAgent } from './baseAgent.js';
import { TOKEN_SYMBOLS } from '../blockchain/contracts.js';

export class TradingAgent extends BaseAgent {
  constructor(name, network = 'sepolia', options = {}) {
    super(name, 'trading', network, options);
    this.strategies = [];
    this.tradeHistory = [];
  }

  getSystemPrompt() {
    const base = super.getSystemPrompt();
    const modeInfo = this.interestFreeMode
      ? `\nHalal Trading Only:
- Spot swaps on Camelot, Uniswap V3, SushiSwap
- Triangular arbitrage (spot only)
- DCA strategies
- Portfolio rebalancing
EXCLUDED: GMX perpetuals, margin trading, leveraged positions`
      : `\nTrading Capabilities:
- Uniswap V3 swaps (exactInputSingle)
- Camelot DEX native swaps
- Cross-DEX arbitrage detection
- GMX perpetual guidance
- Position sizing & risk management`;

    return `${base}${modeInfo}

When suggesting swaps, always include:
- tokenIn, tokenOut, amountIn, slippageBps (default 50 = 0.5%)
- Risk assessment and price impact estimate`;
  }

  // ── On-Chain Actions ──────────────────────────────────────────────────────

  async swap(tokenIn, tokenOut, amountIn, slippageBps = 50) {
    if (!this.hasWallet()) throw new Error('Wallet not connected. Use attachWallet(privateKey) first.');

    // Interest-free check
    if (this.interestFreeMode) {
      const forbidden = ['GMX', 'PERP'];
      if (forbidden.some(t => tokenIn.toUpperCase().includes(t) || tokenOut.toUpperCase().includes(t))) {
        throw new Error('Interest-Free Mode: This token is excluded from halal trading.');
      }
    }

    return this.executeSwap(tokenIn, tokenOut, amountIn, slippageBps);
  }

  async quote(tokenIn, tokenOut, amountIn) {
    if (!this.executor) throw new Error('No wallet/executor available.');
    return this.getSwapQuote(tokenIn, tokenOut, amountIn);
  }

  async portfolio() {
    if (!this.hasWallet()) throw new Error('Wallet not connected.');
    const data = await this.getPortfolio();

    let total = { ethValue: 0 };
    const rows = [];

    rows.push({ asset: 'ETH', balance: data.ETH.formatted, type: 'native' });
    for (const [sym, info] of Object.entries(data.tokens || {})) {
      rows.push({ asset: sym, balance: info.formatted, type: 'token' });
    }

    return { address: this.getAddress(), network: this.network, holdings: rows };
  }

  async runArbitrageCheck(tokenA, tokenB, amount) {
    if (!this.executor) throw new Error('Executor not available.');

    const [quoteAB, quoteBA] = await Promise.all([
      this.executor.getSwapQuote({ tokenInSymbol: tokenA, tokenOutSymbol: tokenB, amountIn: amount }),
      this.executor.getSwapQuote({ tokenInSymbol: tokenB, tokenOutSymbol: tokenA, amountIn: amount })
    ]);

    const profitPct = (parseFloat(quoteBA.amountOut) / amount - 1) * 100;

    const opportunity = {
      exists:    profitPct > 0.5,
      route:     `${tokenA} → ${tokenB} → ${tokenA}`,
      inputAmt:  amount,
      midAmt:    quoteAB.amountOut,
      outputAmt: quoteBA.amountOut,
      profitPct: profitPct.toFixed(4) + '%',
      profitable: profitPct > 0.5
    };

    if (this.openai) {
      const aiAnalysis = await this.think(
        `Arbitrage check: ${JSON.stringify(opportunity)}. Should I execute? Consider gas costs on Arbitrum (~$0.01-0.05 per swap).`
      );
      opportunity.aiRecommendation = aiAnalysis;
    }

    return opportunity;
  }

  async aiTrade(instruction) {
    if (!this.openai) throw new Error('AI not configured. Set an API key first.');

    const context = this.hasWallet()
      ? `Wallet: ${this.getAddress()} on ${this.network}`
      : 'No wallet connected (analysis only)';

    const decision = await this.think(
      `Trading instruction: "${instruction}"
      ${context}
      Available tokens on ${this.network}: ${TOKEN_SYMBOLS[this.network]?.join(', ')}
      
      If a swap is appropriate, include in parameters: tokenIn, tokenOut, amountIn, slippageBps.
      If no wallet is connected, provide analysis only (action: "analysis").`
    );

    // Execute if wallet connected and AI says swap
    if (decision.action === 'swap' && this.hasWallet() && decision.parameters?.tokenIn) {
      try {
        const result = await this.swap(
          decision.parameters.tokenIn,
          decision.parameters.tokenOut,
          decision.parameters.amountIn,
          decision.parameters.slippageBps || 50
        );
        decision.execution = result;
        this.tradeHistory.push({ ...decision, executedAt: new Date().toISOString() });
      } catch (err) {
        decision.executionError = err.message;
      }
    }

    return decision;
  }

  // ── Strategies ────────────────────────────────────────────────────────────

  addStrategy(strategy) {
    const s = {
      ...strategy,
      id:      this.strategies.length + 1,
      created: new Date().toISOString(),
      status:  'pending'
    };
    this.strategies.push(s);
    return s;
  }

  getStrategies()    { return this.strategies; }
  getTradeHistory()  { return this.tradeHistory; }

  async analyzeToken(tokenAddress) {
    return this.think(`Analyze token on Arbitrum: ${tokenAddress}. Consider: liquidity, volume patterns, holder distribution, and risk factors.`);
  }

  async suggestStrategy(params) {
    return this.think(`Suggest a trading strategy:
    Budget: ${params.budget} ETH
    Risk: ${params.risk}
    Timeframe: ${params.timeframe}
    Goals: ${params.goals || 'maximize returns'}
    Mode: ${this.interestFreeMode ? 'Interest-Free (Halal)' : 'Standard'}`);
  }

  fallbackThink(input) {
    const low = input.toLowerCase();

    if (low.includes('swap') || low.includes('trade')) {
      return {
        thought:  'Token swaps on Arbitrum are fast and cheap.',
        action:   'swap_guide',
        reasoning:'Use Uniswap V3 or Camelot for best rates',
        steps:    [
          '1. attachWallet(privateKey) to connect wallet',
          '2. agent.quote("ETH","USDC","0.01") to get a quote',
          '3. agent.swap("ETH","USDC","0.01") to execute',
          '4. Or: agent.aiTrade("swap 0.01 ETH to USDC") for AI-guided execution'
        ],
        tip: 'Set an AI API key for intelligent trade decisions'
      };
    }

    if (low.includes('arbitrage')) {
      return {
        thought:  'Cross-DEX arbitrage on Arbitrum.',
        action:   'arbitrage_info',
        reasoning:'Low gas fees make small arbitrage profitable',
        method:   'agent.runArbitrageCheck("ETH","ARB","0.1")',
        tip:      'Connect wallet and AI key for automated detection'
      };
    }

    return super.fallbackThink(input);
  }
}
