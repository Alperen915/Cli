import dotenv from 'dotenv';
dotenv.config();

// GOOGLE_API_KEY is an alias for GEMINI_API_KEY
function _geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

export function reloadConfig() {
  dotenv.config({ override: true });
  config.openaiApiKey    = process.env.OPENAI_API_KEY || '';
  config.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
  config.geminiApiKey    = _geminiKey();
  config.defaultProvider = process.env.AI_PROVIDER || _detectProvider();
}

function _detectProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (_geminiKey()) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'openai';
}

export const NETWORKS = {
  mainnet: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io'
  },
  sepolia: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io'
  },
  nova: {
    name: 'Arbitrum Nova',
    chainId: 42170,
    rpc: 'https://nova.arbitrum.io/rpc',
    explorer: 'https://nova.arbiscan.io'
  }
};

export const SUPPORTED_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
    keyPrefix: 'sk-',
    envVar: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-5',
    keyPrefix: 'sk-ant-',
    envVar: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://console.anthropic.com/settings/keys'
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    defaultModel: 'gemini-2.0-flash',
    keyPrefix: 'AIza',
    envVar: 'GEMINI_API_KEY',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  }
};

export const config = {
  openaiApiKey:    process.env.OPENAI_API_KEY    || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey:    _geminiKey(),
  defaultProvider: process.env.AI_PROVIDER || _detectProvider(),

  getActiveProvider() {
    if (this.anthropicApiKey) return 'anthropic';
    if (this.geminiApiKey) return 'gemini';
    if (this.openaiApiKey) return 'openai';
    return null;
  },

  getApiKey(provider) {
    const p = provider || this.defaultProvider;
    if (p === 'anthropic') return this.anthropicApiKey;
    if (p === 'gemini') return this.geminiApiKey;
    return this.openaiApiKey;
  },

  hasAnyKey() {
    return !!(this.openaiApiKey || this.anthropicApiKey || this.geminiApiKey);
  },

  arbitrum: {
    mainnet: {
      name: 'Arbitrum One',
      chainId: 42161,
      rpcUrl: 'https://arb1.arbitrum.io/rpc',
      explorer: 'https://arbiscan.io'
    },
    sepolia: {
      name: 'Arbitrum Sepolia',
      chainId: 421614,
      rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
      explorer: 'https://sepolia.arbiscan.io'
    },
    nova: {
      name: 'Arbitrum Nova',
      chainId: 42170,
      rpcUrl: 'https://nova.arbitrum.io/rpc',
      explorer: 'https://nova.arbiscan.io'
    }
  },

  defaultNetwork: 'sepolia',

  agentTypes: {
    trading: {
      name: 'Trading Agent',
      description: 'Autonomous DeFi trading strategies on Arbitrum',
      capabilities: ['swap', 'liquidity', 'arbitrage', 'portfolio']
    },
    defi: {
      name: 'DeFi Agent',
      description: 'Yield farming, staking, and lending optimization',
      capabilities: ['stake', 'lend', 'farm', 'compound']
    },
    onchain: {
      name: 'On-Chain Agent',
      description: 'Deploy and manage smart contracts on Arbitrum',
      capabilities: ['deploy', 'interact', 'verify', 'execute']
    },
    nft: {
      name: 'NFT Agent',
      description: 'NFT minting, trading, and collection management',
      capabilities: ['mint', 'list', 'buy', 'analyze']
    },
    social: {
      name: 'Social Agent',
      description: 'Community engagement and social trading signals',
      capabilities: ['monitor', 'alert', 'engage', 'report']
    },
    custom: {
      name: 'Custom Agent',
      description: 'Build your own agent with custom capabilities',
      capabilities: ['execute', 'analyze', 'interact']
    }
  }
};
