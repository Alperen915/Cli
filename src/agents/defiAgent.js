import { BaseAgent } from './baseAgent.js';

export class DeFiAgent extends BaseAgent {
  constructor(name, network = 'sepolia', options = {}) {
    super(name, 'defi', network, options);
    this.positions = [];
  }

  getSystemPrompt() {
    const base = super.getSystemPrompt();
    const modeInfo = this.interestFreeMode
      ? `\nHalal DeFi Only:
- LP positions earning trading FEES (not interest)
- Staking for governance/network security
- Spot token swaps
EXCLUDED: lending, borrowing, interest-bearing farms, margin positions`
      : `\nDeFi Capabilities:
- Yield optimization (Radiant, Pendle, Camelot, GMX)
- Liquidity provision guidance
- Lending/borrowing strategy
- Auto-compound recommendations
- Protocol risk analysis`;

    return `${base}${modeInfo}

When recommending DeFi actions, provide:
- Protocol name, APY, risk level
- Step-by-step execution guide
- Smart contract addresses where applicable`;
  }

  // ── Portfolio ─────────────────────────────────────────────────────────────

  async portfolio() {
    if (!this.hasWallet()) throw new Error('Wallet not connected.');
    const data = await this.getPortfolio();
    const holdings = [
      { asset: 'ETH', balance: data.ETH.formatted, type: 'native' },
      ...Object.entries(data.tokens || {}).map(([sym, info]) => ({
        asset: sym, balance: info.formatted, type: 'token'
      }))
    ];
    return { address: this.getAddress(), network: this.network, holdings };
  }

  // ── Swap (DeFi route) ─────────────────────────────────────────────────────

  async swap(tokenIn, tokenOut, amountIn, slippageBps = 50) {
    if (!this.hasWallet()) throw new Error('Wallet not connected.');
    if (this.interestFreeMode) {
      const forbidden = ['RDNT', 'AAVE'];
      if (forbidden.some(t => tokenOut.toUpperCase() === t)) {
        throw new Error('Interest-Free Mode: This token is excluded (lending protocol).');
      }
    }
    return this.executeSwap(tokenIn, tokenOut, amountIn, slippageBps);
  }

  async quote(tokenIn, tokenOut, amountIn) {
    if (!this.executor) throw new Error('Executor not available.');
    return this.getSwapQuote(tokenIn, tokenOut, amountIn);
  }

  // ── AI DeFi Advisor ───────────────────────────────────────────────────────

  async findYield(params) {
    return this.think(`Find the best ${this.interestFreeMode ? 'halal ' : ''}yield on Arbitrum:
    Amount: ${params.amount} ETH equivalent
    Risk: ${params.risk || 'medium'}
    Lock period: ${params.lockPeriod || 'flexible'}
    Tokens: ${params.tokens || 'any'}
    Mode: ${this.interestFreeMode ? 'Interest-Free (no lending/interest)' : 'All protocols'}`);
  }

  async analyzeProtocol(protocolName) {
    return this.think(`Analyze ${protocolName} on Arbitrum:
    TVL, security audits, team, tokenomics, risks, opportunities.
    ${this.interestFreeMode ? 'Note: exclude any interest/lending mechanics.' : ''}`);
  }

  async optimizePositions() {
    if (!this.hasWallet()) {
      return this.think(`General DeFi portfolio optimization advice for ${this.network}.`);
    }
    const portfolio = await this.getPortfolio();
    return this.think(`Optimize these DeFi positions: ${JSON.stringify(portfolio)}
    Suggest rebalancing, compounding strategies, or exit recommendations.
    Mode: ${this.interestFreeMode ? 'Interest-Free only' : 'All strategies'}`);
  }

  async aiDefi(instruction) {
    if (!this.openai) throw new Error('AI not configured.');

    const decision = await this.think(
      `DeFi instruction: "${instruction}"
      ${this.hasWallet() ? `Wallet: ${this.getAddress()} on ${this.network}` : 'No wallet (analysis only)'}
      Mode: ${this.interestFreeMode ? 'Interest-Free (Halal)' : 'Standard'}
      
      For swaps: include tokenIn, tokenOut, amountIn, slippageBps in parameters.
      For yield advice: include protocol, strategy, estimatedApy.`
    );

    if (decision.action === 'swap' && this.hasWallet() && decision.parameters?.tokenIn) {
      try {
        const result = await this.swap(
          decision.parameters.tokenIn,
          decision.parameters.tokenOut,
          decision.parameters.amountIn,
          decision.parameters.slippageBps || 50
        );
        decision.execution = result;
        this.positions.push({ ...decision, executedAt: new Date().toISOString() });
      } catch (err) {
        decision.executionError = err.message;
      }
    }

    return decision;
  }

  trackPosition(position) {
    const p = { ...position, id: this.positions.length + 1, tracked: new Date().toISOString() };
    this.positions.push(p);
    return p;
  }

  getPositions() { return this.positions; }

  fallbackThink(input) {
    const low = input.toLowerCase();

    if (low.includes('yield') || low.includes('apy') || low.includes('farm')) {
      return this.interestFreeMode
        ? {
          thought:     'Halal yield sources on Arbitrum.',
          action:      'halal_yield_guide',
          reasoning:   'Trading fees and governance rewards are permissible',
          options:     [
            'Camelot LP: Trading fee earnings (not interest)',
            'GMX GLP: Platform trading fee share',
            'Uniswap V3 LP: Swap fee earnings',
            'ARB Staking: Governance rewards'
          ],
          method:      'agent.findYield({ amount: "1", risk: "medium" })',
          excluded:    ['Radiant/Aave (lending = interest)', 'Pendle (yield derivatives)']
        }
        : {
          thought:   'Arbitrum DeFi yield opportunities.',
          action:    'yield_guide',
          reasoning: 'Multiple protocols provide competitive APYs',
          protocols: [
            'Camelot DEX: LP + GRAIL rewards',
            'GMX/GLP: Trading fee share (10-30% APY)',
            'Radiant Capital: Lending/borrowing with RDNT rewards',
            'Pendle: Trade future yield tokens'
          ],
          method:    'agent.findYield({ amount: "1", risk: "low" })'
        };
    }

    if (low.includes('swap') || low.includes('trade')) {
      return {
        thought:   'Swap tokens to rebalance your DeFi portfolio.',
        action:    'swap_guide',
        reasoning: 'Connect wallet to execute on-chain',
        method:    'agent.swap("ETH","USDC","0.01")',
        tip:       'Connect AI key for intelligent routing'
      };
    }

    return super.fallbackThink(input);
  }
}
