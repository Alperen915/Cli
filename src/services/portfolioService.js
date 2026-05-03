import { ethers } from 'ethers';
import { priceService, ARBITRUM_TOKENS } from './priceService.js';
import { NETWORKS } from '../utils/config.js';
import { storage } from '../utils/storage.js';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

class PortfolioService {
  constructor() {
    this.providers = {};
  }

  getProvider(network = 'mainnet') {
    if (!this.providers[network]) {
      const rpc = NETWORKS[network]?.rpc || NETWORKS.mainnet.rpc;
      this.providers[network] = new ethers.JsonRpcProvider(rpc);
    }
    return this.providers[network];
  }

  async getETHBalance(address, network = 'mainnet') {
    const provider = this.getProvider(network);
    const balance = await provider.getBalance(address);
    return parseFloat(ethers.formatEther(balance));
  }

  async getTokenBalance(walletAddress, tokenAddress, network = 'mainnet') {
    const provider = this.getProvider(network);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    try {
      const [balance, decimals, symbol] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals(),
        contract.symbol()
      ]);
      
      return {
        symbol,
        balance: parseFloat(ethers.formatUnits(balance, decimals)),
        decimals
      };
    } catch (e) {
      return { symbol: 'UNKNOWN', balance: 0, error: e.message };
    }
  }

  async getFullPortfolio(walletAddress, network = 'mainnet') {
    const holdings = [];
    
    // Get ETH balance
    const ethBalance = await this.getETHBalance(walletAddress, network);
    if (ethBalance > 0) {
      try {
        const ethPrice = await priceService.getTokenPrice('ETH');
        holdings.push({
          symbol: 'ETH',
          name: 'Ethereum',
          balance: ethBalance,
          price: ethPrice.price,
          value: ethBalance * ethPrice.price,
          change24h: ethPrice.change24h
        });
      } catch (e) {
        holdings.push({
          symbol: 'ETH',
          name: 'Ethereum',
          balance: ethBalance,
          price: 0,
          value: 0,
          error: e.message
        });
      }
    }

    // Get token balances
    const tokens = Object.entries(ARBITRUM_TOKENS).filter(([s]) => s !== 'ETH');
    
    for (const [symbol, token] of tokens) {
      try {
        const tokenData = await this.getTokenBalance(walletAddress, token.address, network);
        if (tokenData.balance > 0.0001) {
          const priceData = await priceService.getTokenPrice(symbol);
          holdings.push({
            symbol: tokenData.symbol || symbol,
            name: token.name,
            balance: tokenData.balance,
            price: priceData.price,
            value: tokenData.balance * priceData.price,
            change24h: priceData.change24h
          });
        }
      } catch (e) {
        // Skip tokens with errors
      }
    }

    // Sort by value
    holdings.sort((a, b) => (b.value || 0) - (a.value || 0));

    const totalValue = holdings.reduce((sum, h) => sum + (h.value || 0), 0);
    const weightedChange = holdings.reduce((sum, h) => {
      if (h.value && h.change24h) {
        return sum + (h.value / totalValue) * h.change24h;
      }
      return sum;
    }, 0);

    return {
      address: walletAddress,
      network,
      holdings,
      totalValue,
      change24h: weightedChange,
      timestamp: new Date().toISOString()
    };
  }

  async getTransactionHistory(address, network = 'mainnet', limit = 10) {
    const provider = this.getProvider(network);
    
    try {
      const currentBlock = await provider.getBlockNumber();
      const txs = [];
      
      // Simple approach: check recent blocks for transactions
      // Note: For production, use Arbiscan API or similar
      for (let i = 0; i < Math.min(limit * 10, 100); i++) {
        try {
          const block = await provider.getBlock(currentBlock - i, true);
          if (block && block.prefetchedTransactions) {
            for (const tx of block.prefetchedTransactions) {
              if (tx.from?.toLowerCase() === address.toLowerCase() || 
                  tx.to?.toLowerCase() === address.toLowerCase()) {
                txs.push({
                  hash: tx.hash,
                  from: tx.from,
                  to: tx.to,
                  value: ethers.formatEther(tx.value),
                  blockNumber: block.number,
                  timestamp: block.timestamp
                });
                if (txs.length >= limit) break;
              }
            }
          }
          if (txs.length >= limit) break;
        } catch (e) {
          continue;
        }
      }
      
      return txs;
    } catch (e) {
      return { error: e.message };
    }
  }

  async estimateGas(network = 'mainnet') {
    const provider = this.getProvider(network);
    
    try {
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')) : 0;
      const maxFee = feeData.maxFeePerGas ? parseFloat(ethers.formatUnits(feeData.maxFeePerGas, 'gwei')) : 0;
      const priorityFee = feeData.maxPriorityFeePerGas ? parseFloat(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')) : 0;
      
      // Estimate costs for common operations
      const ethPrice = await priceService.getTokenPrice('ETH');
      const ethPriceUsd = ethPrice.price;
      
      const estimates = {
        transfer: { gas: 21000, cost: (21000 * gasPrice / 1e9) * ethPriceUsd },
        erc20Transfer: { gas: 65000, cost: (65000 * gasPrice / 1e9) * ethPriceUsd },
        swap: { gas: 150000, cost: (150000 * gasPrice / 1e9) * ethPriceUsd },
        addLiquidity: { gas: 250000, cost: (250000 * gasPrice / 1e9) * ethPriceUsd },
        contractDeploy: { gas: 500000, cost: (500000 * gasPrice / 1e9) * ethPriceUsd }
      };

      return {
        network,
        gasPrice: gasPrice.toFixed(4),
        maxFee: maxFee.toFixed(4),
        priorityFee: priorityFee.toFixed(4),
        unit: 'gwei',
        estimates,
        ethPrice: ethPriceUsd,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  formatBalance(balance, decimals = 4) {
    if (balance >= 1000000) return `${(balance / 1000000).toFixed(2)}M`;
    if (balance >= 1000) return `${(balance / 1000).toFixed(2)}K`;
    if (balance >= 1) return balance.toFixed(decimals);
    return balance.toFixed(6);
  }

  async getFullPortfolioAndSave(walletAddress, network = 'mainnet', agentName = null) {
    const snapshot = await this.getFullPortfolio(walletAddress, network);
    if (agentName) {
      storage.appendPortfolioSnapshot(agentName, { address: walletAddress, network, ...snapshot });
    }
    return snapshot;
  }

  getPortfolioHistory(agentName, limit = 30) {
    return storage.loadPortfolioHistory(agentName, limit);
  }
}

export const portfolioService = new PortfolioService();
