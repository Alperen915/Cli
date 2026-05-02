import { BaseAgent } from './baseAgent.js';

export class NFTAgent extends BaseAgent {
  constructor(name, network = 'sepolia', options = {}) {
    super(name, 'nft', network, options);
    this.collections = [];
  }

  getSystemPrompt() {
    return `${super.getSystemPrompt()}

As an NFT Agent, you specialize in:
- NFT minting and collection management on Arbitrum
- Analyzing NFT collections and floor prices
- Identifying trending and undervalued NFTs
- Managing NFT portfolios and trading
- Understanding NFT metadata and rarity

Key Arbitrum NFT Marketplaces:
- Treasure Marketplace (native Arbitrum)
- OpenSea (Arbitrum support)
- Stratos NFT
- tofuNFT

Popular Arbitrum NFT Collections:
- Smol Brains
- Realm
- Tales of Elleria
- Battlefly
- The Lost Donkeys

When analyzing NFTs, consider:
1. Floor price trends
2. Trading volume
3. Holder distribution
4. Utility and roadmap
5. Community strength`;
  }

  fallbackThink(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('mint') || lowerInput.includes('create')) {
      return {
        thought: 'To mint NFTs, you need a connected wallet and the collection contract.',
        action: 'mint_guide',
        reasoning: 'NFT minting requires: 1) Wallet connection, 2) ETH for gas, 3) Collection contract address',
        steps: [
          '1. Use "arb wallet connect" to connect your wallet',
          '2. Ensure you have ETH on Arbitrum for gas fees',
          '3. Get the NFT collection contract address',
          '4. Use the mint function with appropriate parameters'
        ],
        tip: 'Popular minting sites: Treasure Marketplace, OpenSea on Arbitrum'
      };
    }
    
    if (lowerInput.includes('collection') || lowerInput.includes('floor')) {
      return {
        thought: 'I can help you analyze NFT collections on Arbitrum.',
        action: 'collection_info',
        reasoning: 'Top Arbitrum collections include Smol Brains, Realm, Tales of Elleria',
        marketplaces: [
          'Treasure Marketplace: https://marketplace.treasure.lol',
          'OpenSea Arbitrum: https://opensea.io/collection/arbitrum',
          'Stratos: https://stratosnft.io'
        ],
        tip: 'Enable OPENAI_API_KEY for detailed collection analysis and price predictions'
      };
    }
    
    if (lowerInput.includes('buy') || lowerInput.includes('sell') || lowerInput.includes('trade')) {
      return {
        thought: 'NFT trading on Arbitrum has low gas fees compared to Ethereum mainnet.',
        action: 'trade_guide',
        reasoning: 'Trading requires wallet connection and marketplace approval',
        steps: [
          '1. Connect wallet with "arb wallet connect"',
          '2. Visit Treasure Marketplace or OpenSea',
          '3. Approve the marketplace to handle your NFTs',
          '4. List for sale or make offers'
        ],
        tip: 'Arbitrum gas fees are typically under $0.10 for NFT transactions'
      };
    }
    
    return {
      thought: `I am ${this.name}, an NFT agent on ${this.network}.`,
      action: 'info',
      reasoning: `My capabilities: ${this.capabilities.join(', ')}`,
      features: [
        'Analyze NFT collections and trends',
        'Guide you through minting process',
        'Track floor prices and volume',
        'Manage your NFT portfolio'
      ],
      tip: 'Enable OPENAI_API_KEY for AI-powered NFT analysis and recommendations'
    };
  }

  trackCollection(collection) {
    this.collections.push({
      ...collection,
      id: this.collections.length + 1,
      tracked: new Date().toISOString()
    });
    return this.collections[this.collections.length - 1];
  }

  getCollections() {
    return this.collections;
  }
}
