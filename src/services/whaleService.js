import { ethers } from 'ethers';
import { NETWORKS } from '../utils/config.js';
import { priceService } from './priceService.js';

const WHALE_THRESHOLD_ETH = 100; // 100+ ETH = whale
const WHALE_THRESHOLD_USD = 100000; // $100K+ = whale

class WhaleService {
  constructor() {
    this.providers = {};
    this.monitoredAddresses = new Map();
  }

  getProvider(network = 'mainnet') {
    if (!this.providers[network]) {
      const rpc = NETWORKS[network]?.rpc || NETWORKS.mainnet.rpc;
      this.providers[network] = new ethers.JsonRpcProvider(rpc);
    }
    return this.providers[network];
  }

  async getRecentLargeTransactions(network = 'mainnet', limit = 10) {
    const provider = this.getProvider(network);
    const largeTxs = [];

    try {
      const ethPrice = await priceService.getTokenPrice('ETH');
      const ethPriceUsd = ethPrice.price;
      const currentBlock = await provider.getBlockNumber();
      
      // Scan recent blocks for large transactions
      for (let i = 0; i < 50 && largeTxs.length < limit; i++) {
        try {
          const block = await provider.getBlock(currentBlock - i, true);
          if (!block || !block.prefetchedTransactions) continue;

          for (const tx of block.prefetchedTransactions) {
            const valueEth = parseFloat(ethers.formatEther(tx.value));
            const valueUsd = valueEth * ethPriceUsd;

            if (valueEth >= WHALE_THRESHOLD_ETH || valueUsd >= WHALE_THRESHOLD_USD) {
              largeTxs.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                valueEth: valueEth.toFixed(4),
                valueUsd: valueUsd.toFixed(2),
                blockNumber: block.number,
                timestamp: new Date(block.timestamp * 1000).toISOString(),
                type: this.classifyTransaction(tx)
              });

              if (largeTxs.length >= limit) break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      return {
        network,
        transactions: largeTxs,
        threshold: { eth: WHALE_THRESHOLD_ETH, usd: WHALE_THRESHOLD_USD },
        ethPrice: ethPriceUsd,
        scannedBlocks: 50
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  classifyTransaction(tx) {
    if (!tx.to) return 'contract_creation';
    if (tx.data === '0x' || !tx.data) return 'transfer';
    
    // Check common function signatures
    const sig = tx.data.slice(0, 10);
    const knownSigs = {
      '0xa9059cbb': 'erc20_transfer',
      '0x23b872dd': 'erc20_transferFrom',
      '0x095ea7b3': 'erc20_approve',
      '0x38ed1739': 'swap_exact_tokens',
      '0x7ff36ab5': 'swap_eth_for_tokens',
      '0x18cbafe5': 'swap_tokens_for_eth',
      '0xe8e33700': 'add_liquidity',
      '0xf305d719': 'add_liquidity_eth',
      '0xbaa2abde': 'remove_liquidity'
    };

    return knownSigs[sig] || 'contract_interaction';
  }

  async getAddressActivity(address, network = 'mainnet') {
    const provider = this.getProvider(network);
    
    try {
      const [balance, txCount, code] = await Promise.all([
        provider.getBalance(address),
        provider.getTransactionCount(address),
        provider.getCode(address)
      ]);

      const isContract = code !== '0x';
      const balanceEth = parseFloat(ethers.formatEther(balance));
      
      const ethPrice = await priceService.getTokenPrice('ETH');
      const balanceUsd = balanceEth * ethPrice.price;

      const isWhale = balanceEth >= WHALE_THRESHOLD_ETH || balanceUsd >= WHALE_THRESHOLD_USD;

      return {
        address,
        network,
        balanceEth: balanceEth.toFixed(4),
        balanceUsd: balanceUsd.toFixed(2),
        transactionCount: txCount,
        isContract,
        isWhale,
        classification: isContract ? 'Smart Contract' : (isWhale ? 'Whale' : 'Regular Wallet')
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  async compareToWhales(address, network = 'mainnet') {
    const provider = this.getProvider(network);
    
    try {
      const balance = await provider.getBalance(address);
      const balanceEth = parseFloat(ethers.formatEther(balance));
      
      // Compare to known whale thresholds
      const tiers = [
        { name: 'Mega Whale', threshold: 10000, emoji: '🐋🐋🐋' },
        { name: 'Whale', threshold: 1000, emoji: '🐋🐋' },
        { name: 'Dolphin', threshold: 100, emoji: '🐬' },
        { name: 'Fish', threshold: 10, emoji: '🐟' },
        { name: 'Shrimp', threshold: 1, emoji: '🦐' },
        { name: 'Plankton', threshold: 0, emoji: '🦠' }
      ];

      const tier = tiers.find(t => balanceEth >= t.threshold) || tiers[tiers.length - 1];
      const nextTier = tiers[tiers.indexOf(tier) - 1];

      return {
        address,
        balanceEth: balanceEth.toFixed(4),
        tier: tier.name,
        emoji: tier.emoji,
        nextTier: nextTier ? {
          name: nextTier.name,
          needed: (nextTier.threshold - balanceEth).toFixed(4)
        } : null
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  formatWhaleAlert(tx) {
    const arrow = tx.type === 'transfer' ? '→' : '⚡';
    return `${tx.valueEth} ETH ($${tx.valueUsd}) ${arrow} ${tx.type}`;
  }
}

export const whaleService = new WhaleService();
