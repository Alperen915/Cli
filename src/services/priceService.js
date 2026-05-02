import chalk from 'chalk';

const DEFILLAMA_BASE = 'https://coins.llama.fi';
const DEFILLAMA_API = 'https://api.llama.fi';

const ARBITRUM_TOKENS = {
  ETH: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum' },
  WETH: { address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', symbol: 'WETH', name: 'Wrapped Ether' },
  ARB: { address: '0x912ce59144191c1204e64559fe8253a0e49e6548', symbol: 'ARB', name: 'Arbitrum' },
  GMX: { address: '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a', symbol: 'GMX', name: 'GMX' },
  USDC: { address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', symbol: 'USDC', name: 'USD Coin' },
  USDT: { address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', symbol: 'USDT', name: 'Tether' },
  WBTC: { address: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', symbol: 'WBTC', name: 'Wrapped Bitcoin' },
  LINK: { address: '0xf97f4df75117a78c1a5a0dbb814af92458539fb4', symbol: 'LINK', name: 'Chainlink' },
  UNI: { address: '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0', symbol: 'UNI', name: 'Uniswap' },
  RDNT: { address: '0x3082cc23568ea640225c2467653db90e9250aaa0', symbol: 'RDNT', name: 'Radiant' },
  MAGIC: { address: '0x539bde0d7dbd336b79148aa742883198bbf60342', symbol: 'MAGIC', name: 'Magic' },
  GRAIL: { address: '0x3d9907f9a368ad0a51be60f7da3b97cf940982d8', symbol: 'GRAIL', name: 'Camelot' },
  PENDLE: { address: '0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8', symbol: 'PENDLE', name: 'Pendle' },
  GNS: { address: '0x18c11fd286c5ec11c3b683caa813b77f5163a122', symbol: 'GNS', name: 'Gains Network' },
  SUSHI: { address: '0xd4d42f0b6def4ce0383636770ef773390d85c61a', symbol: 'SUSHI', name: 'SushiSwap' }
};

class PriceService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 60000; // 1 minute cache
  }

  async fetchWithCache(url, cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }

  async getTokenPrice(symbol) {
    const token = ARBITRUM_TOKENS[symbol.toUpperCase()];
    if (!token) {
      throw new Error(`Unknown token: ${symbol}. Supported: ${Object.keys(ARBITRUM_TOKENS).join(', ')}`);
    }

    if (symbol.toUpperCase() === 'ETH') {
      const url = `${DEFILLAMA_BASE}/prices/current/coingecko:ethereum`;
      const data = await this.fetchWithCache(url, 'eth-price');
      return {
        symbol: 'ETH',
        name: 'Ethereum',
        price: data.coins['coingecko:ethereum']?.price || 0,
        change24h: data.coins['coingecko:ethereum']?.change24h || 0
      };
    }

    const coinId = `arbitrum:${token.address}`;
    const url = `${DEFILLAMA_BASE}/prices/current/${coinId}`;
    const data = await this.fetchWithCache(url, `price-${symbol}`);
    
    const coinData = data.coins[coinId];
    return {
      symbol: token.symbol,
      name: token.name,
      price: coinData?.price || 0,
      change24h: coinData?.change24h || 0,
      confidence: coinData?.confidence || 0
    };
  }

  async getMultiplePrices(symbols = ['ETH', 'ARB', 'GMX', 'USDC']) {
    const results = [];
    for (const symbol of symbols) {
      try {
        const price = await this.getTokenPrice(symbol);
        results.push(price);
      } catch (e) {
        results.push({ symbol, price: 0, error: e.message });
      }
    }
    return results;
  }

  async getAllPrices() {
    const symbols = Object.keys(ARBITRUM_TOKENS);
    const coinIds = symbols.map(s => {
      if (s === 'ETH') return 'coingecko:ethereum';
      return `arbitrum:${ARBITRUM_TOKENS[s].address}`;
    }).join(',');

    const url = `${DEFILLAMA_BASE}/prices/current/${coinIds}`;
    const data = await this.fetchWithCache(url, 'all-prices');

    return symbols.map(symbol => {
      const token = ARBITRUM_TOKENS[symbol];
      const coinId = symbol === 'ETH' ? 'coingecko:ethereum' : `arbitrum:${token.address}`;
      const coinData = data.coins[coinId];
      return {
        symbol: token.symbol,
        name: token.name,
        price: coinData?.price || 0,
        change24h: coinData?.change24h || 0
      };
    });
  }

  async getHistoricalPrice(symbol, timestamp) {
    const token = ARBITRUM_TOKENS[symbol.toUpperCase()];
    if (!token) throw new Error(`Unknown token: ${symbol}`);

    const coinId = symbol === 'ETH' ? 'coingecko:ethereum' : `arbitrum:${token.address}`;
    const url = `${DEFILLAMA_BASE}/prices/historical/${timestamp}/${coinId}`;
    const data = await this.fetchWithCache(url, `hist-${symbol}-${timestamp}`);
    
    return {
      symbol: token.symbol,
      price: data.coins[coinId]?.price || 0,
      timestamp: timestamp
    };
  }

  async getPriceChart(symbol, days = 7) {
    const token = ARBITRUM_TOKENS[symbol.toUpperCase()];
    if (!token) throw new Error(`Unknown token: ${symbol}`);

    const coinId = symbol === 'ETH' ? 'coingecko:ethereum' : `arbitrum:${token.address}`;
    const end = Math.floor(Date.now() / 1000);
    const start = end - (days * 24 * 60 * 60);
    const span = days <= 7 ? 4 : (days <= 30 ? 24 : 168);

    const url = `${DEFILLAMA_BASE}/chart/${coinId}?start=${start}&end=${end}&span=${span}`;
    
    try {
      const data = await this.fetchWithCache(url, `chart-${symbol}-${days}`);
      return {
        symbol: token.symbol,
        prices: data.coins[coinId]?.prices || [],
        period: `${days} days`
      };
    } catch (e) {
      return { symbol: token.symbol, prices: [], error: e.message };
    }
  }

  getTokenList() {
    return Object.entries(ARBITRUM_TOKENS).map(([symbol, data]) => ({
      symbol,
      name: data.name,
      address: data.address
    }));
  }

  formatPrice(price, change24h) {
    const priceStr = price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(6)}`;
    const changeStr = change24h >= 0 
      ? chalk.green(`+${change24h.toFixed(2)}%`)
      : chalk.red(`${change24h.toFixed(2)}%`);
    return { priceStr, changeStr };
  }
}

export const priceService = new PriceService();
export { ARBITRUM_TOKENS };
