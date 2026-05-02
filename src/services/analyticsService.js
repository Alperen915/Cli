import { ethers } from 'ethers';
import { config } from '../utils/config.js';

const DEFILLAMA_API = 'https://api.llama.fi';
const YIELDS_API = 'https://yields.llama.fi';
const COINS_API = 'https://coins.llama.fi';

export const analyticsService = {
  async getPrices() {
    const tokens = [
      'arbitrum:0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
      'arbitrum:0x912CE59144191C1204E64559FE8253a0e49E6548', // ARB
      'arbitrum:0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', // GMX
      'arbitrum:0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      'arbitrum:0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
      'arbitrum:0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', // WBTC
      'arbitrum:0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', // LINK
      'arbitrum:0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', // UNI
      'arbitrum:0x3082CC23568eA640225c2467653dB90e9250AaA0', // RDNT
      'arbitrum:0x539bdE0d7Dbd336b79148AA742883198BBF60342', // MAGIC
      'arbitrum:0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8', // GRAIL
      'arbitrum:0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8', // PENDLE
      'arbitrum:0x18c11FD286C5EC11c3b683Caa813B77f5163A122', // GNS
      'arbitrum:0xd4d42F0b6DEF4CE0383636770eF773390d85c61A'  // SUSHI
    ];

    try {
      const response = await fetch(`${COINS_API}/prices/current/${tokens.join(',')}`);
      const data = await response.json();
      
      const tokenNames = ['WETH', 'ARB', 'GMX', 'USDC', 'USDT', 'WBTC', 'LINK', 'UNI', 'RDNT', 'MAGIC', 'GRAIL', 'PENDLE', 'GNS', 'SUSHI'];
      
      return tokens.map((token, i) => ({
        symbol: tokenNames[i],
        price: data.coins[token]?.price || 0,
        change24h: data.coins[token]?.change24h || 0
      }));
    } catch (error) {
      throw new Error(`Failed to fetch prices: ${error.message}`);
    }
  },

  async getProtocols(limit = 15) {
    try {
      const response = await fetch(`${DEFILLAMA_API}/protocols`);
      const protocols = await response.json();
      
      const arbitrumProtocols = protocols
        .filter(p => p.chains?.includes('Arbitrum'))
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, limit);

      return arbitrumProtocols.map((p, i) => ({
        rank: i + 1,
        name: p.name,
        category: p.category,
        tvl: p.tvl,
        change24h: p.change_1d || 0
      }));
    } catch (error) {
      throw new Error(`Failed to fetch protocols: ${error.message}`);
    }
  },

  async getYields(limit = 20) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(`${YIELDS_API}/pools`, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const text = await response.text();
      if (!text || text.trim() === '') {
        throw new Error('Empty response from yields API');
      }
      
      const data = JSON.parse(text);
      
      const arbitrumPools = (data.data || [])
        .filter(p => p.chain === 'Arbitrum' && p.apy > 0)
        .sort((a, b) => b.apy - a.apy)
        .slice(0, limit);

      return arbitrumPools.map(p => ({
        pool: p.symbol,
        protocol: p.project,
        apy: p.apy,
        tvl: p.tvlUsd
      }));
    } catch (error) {
      throw new Error(`Failed to fetch yields: ${error.message}`);
    }
  },

  async getGasEstimates(network = 'mainnet') {
    try {
      const rpcUrl = config.arbitrum[network]?.rpcUrl || config.arbitrum.mainnet.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();
      
      const pricesResponse = await fetch(`${COINS_API}/prices/current/coingecko:ethereum`);
      const pricesData = await pricesResponse.json();
      const ethPrice = pricesData.coins['coingecko:ethereum']?.price || 0;

      const gasPrice = feeData.gasPrice || BigInt(0);
      const gasPriceGwei = Number(gasPrice) / 1e9;
      const maxFeeGwei = feeData.maxFeePerGas ? Number(feeData.maxFeePerGas) / 1e9 : gasPriceGwei;
      const priorityFeeGwei = feeData.maxPriorityFeePerGas ? Number(feeData.maxPriorityFeePerGas) / 1e9 : 0;

      const estimateCost = (gasUnits) => {
        const costWei = gasPrice * BigInt(gasUnits);
        const costEth = Number(costWei) / 1e18;
        return (costEth * ethPrice).toFixed(4);
      };

      return {
        network,
        gasPrice: gasPriceGwei.toFixed(4),
        maxFee: maxFeeGwei.toFixed(4),
        priorityFee: priorityFeeGwei.toFixed(4),
        ethPrice,
        estimates: {
          ethTransfer: estimateCost(21000),
          tokenTransfer: estimateCost(65000),
          swap: estimateCost(150000),
          addLiquidity: estimateCost(250000),
          deployContract: estimateCost(500000)
        }
      };
    } catch (error) {
      throw new Error(`Failed to estimate gas: ${error.message}`);
    }
  },

  async getNetworkInfo(network = 'sepolia') {
    try {
      const networkConfig = config.arbitrum[network];
      if (!networkConfig) {
        throw new Error(`Unknown network: ${network}`);
      }
      
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const [blockNumber, feeData] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData()
      ]);

      return {
        name: networkConfig.name,
        chainId: networkConfig.chainId,
        rpcUrl: networkConfig.rpc,
        explorer: networkConfig.explorer,
        blockNumber,
        gasPrice: feeData.gasPrice ? (Number(feeData.gasPrice) / 1e9).toFixed(6) : '0'
      };
    } catch (error) {
      throw new Error(`Failed to get network info: ${error.message}`);
    }
  },

  getNetworks() {
    return Object.entries(config.arbitrum).map(([key, net]) => ({
      id: key,
      name: net.name,
      chainId: net.chainId,
      rpcUrl: net.rpcUrl,
      explorer: net.explorer
    }));
  }
};
