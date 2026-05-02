const DEFILLAMA_API = 'https://api.llama.fi';
const YIELDS_API = 'https://yields.llama.fi';

const ARBITRUM_PROTOCOLS = {
  'gmx': { name: 'GMX', type: 'Perpetuals DEX', token: 'GMX' },
  'uniswap': { name: 'Uniswap V3', type: 'DEX', token: 'UNI' },
  'aave-v3': { name: 'Aave V3', type: 'Lending', token: 'AAVE' },
  'radiant-v2': { name: 'Radiant V2', type: 'Lending', token: 'RDNT' },
  'camelot': { name: 'Camelot', type: 'DEX', token: 'GRAIL' },
  'pendle': { name: 'Pendle', type: 'Yield', token: 'PENDLE' },
  'sushiswap': { name: 'SushiSwap', type: 'DEX', token: 'SUSHI' },
  'gains-network': { name: 'Gains Network', type: 'Perpetuals', token: 'GNS' },
  'treasure': { name: 'Treasure', type: 'Gaming', token: 'MAGIC' },
  'dopex': { name: 'Dopex', type: 'Options', token: 'DPX' },
  'jones-dao': { name: 'Jones DAO', type: 'Yield', token: 'JONES' },
  'plutus': { name: 'Plutus', type: 'Yield', token: 'PLS' },
  'vesta-finance': { name: 'Vesta Finance', type: 'Stablecoin', token: 'VSTA' },
  'stargate': { name: 'Stargate', type: 'Bridge', token: 'STG' }
};

class ProtocolService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 300000; // 5 minute cache
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
      throw new Error(`Failed to fetch: ${error.message}`);
    }
  }

  async getArbitrumTVL() {
    const url = `${DEFILLAMA_API}/v2/chains`;
    const data = await this.fetchWithCache(url, 'chains');
    const arbitrum = data.find(c => c.name === 'Arbitrum');
    return {
      chain: 'Arbitrum',
      tvl: arbitrum?.tvl || 0,
      change1d: arbitrum?.change_1d || 0,
      change7d: arbitrum?.change_7d || 0
    };
  }

  async getProtocolData(slug) {
    const url = `${DEFILLAMA_API}/protocol/${slug}`;
    const data = await this.fetchWithCache(url, `protocol-${slug}`);
    
    const arbitrumTvl = data.chainTvls?.Arbitrum?.tvl || 
                        data.currentChainTvls?.Arbitrum || 0;
    
    return {
      name: data.name,
      slug: data.slug,
      symbol: data.symbol,
      category: data.category,
      tvl: data.tvl || 0,
      arbitrumTvl,
      change1d: data.change_1d || 0,
      change7d: data.change_7d || 0,
      chains: data.chains || [],
      url: data.url
    };
  }

  async getTopArbitrumProtocols(limit = 15) {
    const url = `${DEFILLAMA_API}/protocols`;
    const data = await this.fetchWithCache(url, 'all-protocols');
    
    const arbitrumProtocols = data
      .filter(p => p.chains?.includes('Arbitrum'))
      .map(p => ({
        name: p.name,
        slug: p.slug,
        symbol: p.symbol,
        category: p.category,
        tvl: p.tvl || 0,
        arbitrumTvl: p.chainTvls?.Arbitrum || 0,
        change1d: p.change_1d || 0,
        change7d: p.change_7d || 0
      }))
      .sort((a, b) => (b.arbitrumTvl || b.tvl) - (a.arbitrumTvl || a.tvl))
      .slice(0, limit);

    return arbitrumProtocols;
  }

  async getYieldPools(minApy = 0, maxApy = 1000) {
    const url = `${YIELDS_API}/pools`;
    const data = await this.fetchWithCache(url, 'yield-pools');
    
    const arbitrumPools = data.data
      .filter(p => p.chain === 'Arbitrum' && p.apy >= minApy && p.apy <= maxApy && p.tvlUsd > 100000)
      .map(p => ({
        pool: p.pool,
        project: p.project,
        symbol: p.symbol,
        apy: p.apy || 0,
        apyBase: p.apyBase || 0,
        apyReward: p.apyReward || 0,
        tvl: p.tvlUsd || 0,
        rewardTokens: p.rewardTokens || []
      }))
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 20);

    return arbitrumPools;
  }

  async getDexVolume() {
    const url = `${DEFILLAMA_API}/overview/dexs/Arbitrum`;
    try {
      const data = await this.fetchWithCache(url, 'dex-volume');
      return {
        total24h: data.total24h || 0,
        total7d: data.total7d || 0,
        change24h: data.change_1d || 0,
        protocols: (data.protocols || []).slice(0, 10).map(p => ({
          name: p.name,
          volume24h: p.total24h || 0,
          change24h: p.change_1d || 0
        }))
      };
    } catch (e) {
      return { total24h: 0, total7d: 0, protocols: [], error: e.message };
    }
  }

  async getStablecoinData() {
    const url = `${DEFILLAMA_API}/stablecoins`;
    const data = await this.fetchWithCache(url, 'stablecoins');
    
    const arbitrumStables = data.peggedAssets
      .filter(s => s.chains?.includes('Arbitrum'))
      .map(s => ({
        name: s.name,
        symbol: s.symbol,
        pegType: s.pegType,
        circulating: s.circulating?.peggedUSD || 0
      }))
      .sort((a, b) => b.circulating - a.circulating)
      .slice(0, 10);

    return arbitrumStables;
  }

  formatTVL(tvl) {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`;
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`;
    return `$${tvl.toFixed(2)}`;
  }

  getKnownProtocols() {
    return Object.entries(ARBITRUM_PROTOCOLS).map(([slug, data]) => ({
      slug,
      ...data
    }));
  }
}

export const protocolService = new ProtocolService();
export { ARBITRUM_PROTOCOLS };
