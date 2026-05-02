import { BaseAgent } from './baseAgent.js';

export class SocialAgent extends BaseAgent {
  constructor(name, network = 'sepolia', options = {}) {
    super(name, 'social', network, options);
    this.signals = [];
    this.following = [];
  }

  getSystemPrompt() {
    return `${super.getSystemPrompt()}

As a Social Agent, you specialize in:
- Monitoring Arbitrum ecosystem news and updates
- Tracking influential traders and wallets
- Analyzing social sentiment around tokens
- Providing trading signals based on social data
- Community engagement and alpha hunting

Social Data Sources:
- Twitter/X crypto communities
- Discord servers (Arbitrum, DeFi projects)
- Telegram groups
- On-chain whale tracking
- Dune Analytics dashboards

When providing signals, consider:
1. Source credibility
2. Historical accuracy
3. Risk level
4. Time sensitivity
5. Correlation with on-chain data`;
  }

  fallbackThink(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('signal') || lowerInput.includes('alpha')) {
      return {
        thought: 'Trading signals should be combined with your own research.',
        action: 'signal_info',
        reasoning: 'Social signals can indicate market sentiment but carry risk',
        sources: [
          'Follow @arbitrum on Twitter for official updates',
          'Join Arbitrum Discord for community insights',
          'Monitor whale wallets on Arbiscan',
          'Check Dune dashboards for on-chain metrics'
        ],
        warning: 'Never invest based solely on social signals. DYOR (Do Your Own Research)',
        tip: 'Enable OPENAI_API_KEY for AI-powered sentiment analysis'
      };
    }
    
    if (lowerInput.includes('news') || lowerInput.includes('update')) {
      return {
        thought: 'Staying updated on Arbitrum ecosystem is crucial for informed decisions.',
        action: 'news_sources',
        reasoning: 'Multiple reliable sources provide Arbitrum updates',
        resources: [
          'Arbitrum Blog: https://arbitrum.io/blog',
          'Twitter: @arbitrum, @OffchainLabs',
          'Discord: discord.gg/arbitrum',
          'Medium: medium.com/offchainlabs',
          'DeFiLlama: defillama.com/chain/Arbitrum'
        ],
        tip: 'Enable OPENAI_API_KEY for summarized news and analysis'
      };
    }
    
    if (lowerInput.includes('whale') || lowerInput.includes('track')) {
      return {
        thought: 'Whale tracking can reveal significant market movements.',
        action: 'whale_tracking',
        reasoning: 'Large wallet movements often precede price action',
        tools: [
          'Arbiscan: https://arbiscan.io (search large transactions)',
          'Arkham Intelligence: arkham.intelligence.xyz',
          'Nansen: nansen.ai (premium)',
          'DeBank: debank.com (portfolio tracking)'
        ],
        tip: 'Enable OPENAI_API_KEY for automated whale analysis'
      };
    }
    
    return {
      thought: `I am ${this.name}, a social agent monitoring ${this.network}.`,
      action: 'info',
      reasoning: `My capabilities: ${this.capabilities.join(', ')}`,
      features: [
        'Monitor ecosystem news and updates',
        'Track influential wallets and traders',
        'Analyze social sentiment',
        'Provide trading signals'
      ],
      tip: 'Enable OPENAI_API_KEY for AI-powered social analysis'
    };
  }

  addSignal(signal) {
    this.signals.push({
      ...signal,
      id: this.signals.length + 1,
      created: new Date().toISOString()
    });
    return this.signals[this.signals.length - 1];
  }

  getSignals() {
    return this.signals;
  }

  follow(address, label) {
    this.following.push({
      address,
      label,
      added: new Date().toISOString()
    });
  }

  getFollowing() {
    return this.following;
  }
}
