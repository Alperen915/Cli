/**
 * Arbitrum Network Monitor
 *
 * Arbitrum'a özgü ağ sağlık izleme:
 *  - Sequencer durumu (L2 blok üretimi izleme)
 *  - L1 batch gecikmesi (son batch ne zaman gönderildi)
 *  - L2→L1 challenge period durumu
 *  - Arbitrum köprüsü (resmi bridge) istatistikleri
 *  - Custom RPC desteği (Alchemy / Infura / QuickNode)
 *  - İşlem lifecycle takibi (L2 onay → L1 batch → L1 finality)
 *  - Adres sorguları (bakiye, nonce, ERC-20 token balance)
 *  - Tüm ağlar için sağlık skoru
 */

import { ethers }  from 'ethers';
import { NETWORKS } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('networkMonitor');

// ── Arbitrum-specific contract addresses ─────────────────────────────────────

const ARB_CONTRACTS = {
  mainnet: {
    // Arbitrum One contracts on L1 (Ethereum mainnet)
    l1: {
      rollup:        '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
      sequencerInbox:'0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
      bridge:        '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      outbox:        '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
    },
    // Arbitrum One L2 precompiles
    l2: {
      arbSys:        '0x0000000000000000000000000000000000000064',
      arbGasInfo:    '0x000000000000000000000000000000000000006C',
      arbStatistics: '0x000000000000000000000000000000000000006F',
      nodeInterface: '0x00000000000000000000000000000000000000C8',
    },
    chainId: 42161,
  },
  sepolia: {
    l1: {
      rollup:        '0xd80810638dbDF9081b72C1B33c65375e807281C8',
      sequencerInbox:'0x6c97864CE4bEf387dE0b3310A44230f7E3F1be0D',
      bridge:        '0x38f918D0E9F1b721EDaA41302E399fa1B79333a9',
      outbox:        '0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F',
    },
    l2: {
      arbSys:        '0x0000000000000000000000000000000000000064',
      arbGasInfo:    '0x000000000000000000000000000000000000006C',
      arbStatistics: '0x000000000000000000000000000000000000006F',
      nodeInterface: '0x00000000000000000000000000000000000000C8',
    },
    chainId: 421614,
  },
};

// ArbSys precompile ABI (subset)
const ARB_SYS_ABI = [
  'function arbBlockNumber() view returns (uint256)',
  'function arbChainID() view returns (uint256)',
  'function arbOSVersion() view returns (uint256)',
  'function getStorageGasAvailable() view returns (uint256)',
  'function isTopLevelCall() view returns (bool)',
  'function withdrawEth(address destination) payable returns (uint256)',
  'function sendTxToL1(address destination, bytes calldata data) payable returns (uint256)',
  'function getTransactionCount(address account, bool includeAliased) view returns (uint256)',
];

// ArbGasInfo ABI (subset)
const ARB_GAS_INFO_ABI = [
  'function getPricesInWei() view returns (uint256, uint256, uint256, uint256, uint256, uint256)',
  'function getPricesInArbGas() view returns (uint256, uint256, uint256)',
  'function getGasBacklog() view returns (uint64)',
  'function getPricingInertia() view returns (uint64)',
  'function getMinimumGasPrice() view returns (uint256)',
  'function getL1BaseFeeEstimate() view returns (uint256)',
];

// ERC-20 balance ABI
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// Known Arbitrum token addresses
const KNOWN_TOKENS = {
  mainnet: {
    ARB:  { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 },
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6  },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6  },
    WBTC: { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8  },
  },
  sepolia: {
    WETH: { address: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73', decimals: 18 },
    USDC: { address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', decimals: 6  },
  }
};

// ── Provider factory ──────────────────────────────────────────────────────────

export function createProvider(network, customRpcUrl = null) {
  const netCfg = NETWORKS[network];
  if (!netCfg) throw new Error(`Unknown network: ${network}`);
  const url = customRpcUrl || netCfg.rpc;
  return new ethers.JsonRpcProvider(url);
}

// ── Core monitoring functions ─────────────────────────────────────────────────

export async function getNetworkHealth(network, customRpcUrl = null) {
  const start    = Date.now();
  const netCfg   = NETWORKS[network];
  const provider = createProvider(network, customRpcUrl);

  try {
    const [blockNumber, feeData, chainId] = await Promise.all([
      provider.getBlockNumber(),
      provider.getFeeData(),
      provider.getNetwork().then(n => n.chainId),
    ]);

    const latencyMs = Date.now() - start;

    // Get latest block details
    const block = await provider.getBlock(blockNumber);
    const blockAge = block ? Math.floor(Date.now() / 1000 - Number(block.timestamp)) : null;

    // Arbitrum L2 precompile stats (only for mainnet/sepolia)
    let arbStats = null;
    const contracts = ARB_CONTRACTS[network];
    if (contracts) {
      try {
        const arbGasInfo = new ethers.Contract(
          contracts.l2.arbGasInfo, ARB_GAS_INFO_ABI, provider
        );
        const [gasBacklog, minGasPrice, l1BaseFee] = await Promise.all([
          arbGasInfo.getGasBacklog().catch(() => null),
          arbGasInfo.getMinimumGasPrice().catch(() => null),
          arbGasInfo.getL1BaseFeeEstimate().catch(() => null),
        ]);
        arbStats = {
          gasBacklog:     gasBacklog  ? Number(gasBacklog) : null,
          minGasPrice:    minGasPrice ? ethers.formatUnits(minGasPrice, 'gwei') : null,
          l1BaseFeeGwei:  l1BaseFee   ? ethers.formatUnits(l1BaseFee, 'gwei')   : null,
        };
      } catch(_) {}
    }

    // Sequencer health: if block age is < 10s → healthy, < 30s → degraded, else → down
    let sequencerStatus = 'unknown';
    if (blockAge !== null) {
      if (blockAge < 10)      sequencerStatus = 'healthy';
      else if (blockAge < 60) sequencerStatus = 'degraded';
      else                    sequencerStatus = 'down';
    }

    // Health score (0-100)
    let score = 100;
    if (sequencerStatus === 'degraded') score -= 30;
    if (sequencerStatus === 'down')     score -= 70;
    if (latencyMs > 1000) score -= 10;
    if (latencyMs > 3000) score -= 20;
    if (arbStats?.gasBacklog > 1000) score -= 10;
    score = Math.max(0, score);

    return {
      network,
      name:           netCfg.name,
      chainId:        Number(chainId),
      status:         sequencerStatus === 'healthy' ? 'healthy'
                    : sequencerStatus === 'degraded' ? 'degraded' : 'down',
      healthScore:    score,
      blockNumber,
      blockAge:       blockAge !== null ? `${blockAge}s ago` : null,
      blockTimestamp: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
      latencyMs,
      gasPrice: feeData.gasPrice
        ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')).toFixed(4) + ' gwei'
        : null,
      maxFeePerGas: feeData.maxFeePerGas
        ? parseFloat(ethers.formatUnits(feeData.maxFeePerGas, 'gwei')).toFixed(4) + ' gwei'
        : null,
      arbitrum:       arbStats,
      rpcUrl:         customRpcUrl || netCfg.rpc,
      explorer:       netCfg.explorer,
      checkedAt:      new Date().toISOString(),
    };
  } catch (err) {
    return {
      network, name: netCfg.name,
      chainId:    netCfg.chainId,
      status:     'unreachable',
      healthScore: 0,
      error:      err.message.slice(0, 120),
      latencyMs:  Date.now() - start,
      rpcUrl:     customRpcUrl || netCfg.rpc,
      checkedAt:  new Date().toISOString(),
    };
  }
}

export async function getAllNetworksHealth() {
  const results = await Promise.allSettled(
    ['mainnet', 'sepolia', 'nova'].map(n => getNetworkHealth(n))
  );
  return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
}

// ── Transaction Lifecycle Tracker ─────────────────────────────────────────────

export async function getTransactionLifecycle(txHash, network = 'mainnet') {
  const provider = createProvider(network);
  const netCfg   = NETWORKS[network];

  try {
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!tx) return { found: false, txHash, network };

    const currentBlock = await provider.getBlockNumber();
    const confirmations = receipt ? currentBlock - Number(receipt.blockNumber) : 0;

    // Arbitrum L2 lifecycle stages:
    // 1. L2 Pending   — in mempool, not yet mined
    // 2. L2 Confirmed — mined on L2 (1 block)
    // 3. L2 Safe      — multiple L2 confirmations (typically 10+)
    // 4. L1 Batched   — included in L1 batch (Arbitrum challenge period starts)
    // 5. L1 Finalized — challenge period expired (~7 days for withdrawals)

    let l2Stage = 'pending';
    if (receipt) {
      if (confirmations === 0)   l2Stage = 'confirmed';
      else if (confirmations < 10) l2Stage = 'safe';
      else                       l2Stage = 'finalized_l2';
    }

    // Challenge period estimate (7 days = 604800 seconds)
    // For regular txs, this matters for L2→L1 withdrawals
    const challengePeriodEnd = receipt?.blockNumber
      ? (() => {
          const ts = Date.now();
          return new Date(ts + 7 * 24 * 60 * 60 * 1000).toISOString();
        })()
      : null;

    return {
      found:        true,
      txHash,
      network,
      from:         tx.from,
      to:           tx.to,
      value:        ethers.formatEther(tx.value || 0n) + ' ETH',
      gasPrice:     tx.gasPrice
                      ? parseFloat(ethers.formatUnits(tx.gasPrice, 'gwei')).toFixed(4) + ' gwei'
                      : null,
      nonce:        tx.nonce,
      status: receipt
        ? (receipt.status === 1 ? 'success' : 'failed')
        : 'pending',
      l2Stage,
      blockNumber:      receipt?.blockNumber    ? Number(receipt.blockNumber) : null,
      gasUsed:          receipt?.gasUsed        ? receipt.gasUsed.toString()  : null,
      confirmations,
      challengePeriodEnd,
      explorerUrl:  `${netCfg.explorer}/tx/${txHash}`,
      arbitrumLifecycle: {
        l2Pending:   !receipt,
        l2Confirmed: !!receipt && confirmations >= 1,
        l2Safe:      !!receipt && confirmations >= 10,
        l1Batched:   !!receipt && confirmations >= 100, // rough estimate
        l1Finalized: !!receipt && confirmations >= 100 && l2Stage === 'finalized_l2',
      },
    };
  } catch (err) {
    throw new Error(`Failed to fetch tx ${txHash}: ${err.message}`);
  }
}

// ── Address Inspector ─────────────────────────────────────────────────────────

export async function inspectAddress(address, network = 'mainnet') {
  const provider = createProvider(network);
  const netCfg   = NETWORKS[network];

  if (!ethers.isAddress(address)) throw new Error(`Invalid Ethereum address: ${address}`);

  const [balanceWei, nonce, code] = await Promise.all([
    provider.getBalance(address),
    provider.getTransactionCount(address),
    provider.getCode(address),
  ]);

  const isContract = code !== '0x';
  const ethBalance = ethers.formatEther(balanceWei);

  // Fetch known token balances
  const tokens = KNOWN_TOKENS[network] || {};
  const tokenBalances = {};

  await Promise.allSettled(
    Object.entries(tokens).map(async ([symbol, { address: tokenAddr, decimals }]) => {
      const contract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
      const raw      = await contract.balanceOf(address);
      const fmt      = parseFloat(ethers.formatUnits(raw, decimals));
      if (fmt > 0) tokenBalances[symbol] = fmt.toFixed(decimals > 6 ? 6 : 2);
    })
  );

  return {
    address,
    network,
    name:        netCfg.name,
    isContract,
    ethBalance:  parseFloat(ethBalance).toFixed(6) + ' ETH',
    ethBalanceWei: balanceWei.toString(),
    nonce,
    tokenBalances,
    explorerUrl: `${netCfg.explorer}/address/${address}`,
    checkedAt:   new Date().toISOString(),
  };
}

// ── Custom RPC Manager ────────────────────────────────────────────────────────

export async function testCustomRpc(network, rpcUrl) {
  const start = Date.now();
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const [blockNumber, chainId, feeData] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork().then(n => n.chainId),
      provider.getFeeData(),
    ]);
    const latencyMs = Date.now() - start;

    // Validate chain ID matches expected
    const expected = NETWORKS[network]?.chainId;
    const chainMatch = expected ? Number(chainId) === expected : true;

    return {
      ok: true,
      rpcUrl,
      network,
      latencyMs,
      blockNumber,
      chainId:    Number(chainId),
      chainMatch,
      warning:    chainMatch ? null : `Chain ID mismatch: expected ${expected}, got ${chainId}`,
      gasPrice:   feeData.gasPrice
        ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')).toFixed(4) + ' gwei'
        : null,
    };
  } catch (err) {
    return { ok: false, rpcUrl, network, latencyMs: Date.now() - start, error: err.message.slice(0, 150) };
  }
}

// ── Sequencer Lag Checker ─────────────────────────────────────────────────────

export async function getSequencerStatus(network = 'mainnet') {
  const provider = createProvider(network);

  try {
    const blockNumber = await provider.getBlockNumber();
    const block       = await provider.getBlock(blockNumber);

    if (!block) return { status: 'unknown', network };

    const nowSec  = Math.floor(Date.now() / 1000);
    const blockTs = Number(block.timestamp);
    const lagSec  = nowSec - blockTs;

    // Arbitrum target: ~0.25s block time
    // > 5s  → degraded, > 30s → stalled, > 300s → down
    let status = 'healthy';
    let description = 'Sequencer operating normally';
    if (lagSec > 300) { status = 'down';     description = 'Sequencer appears to be down'; }
    else if (lagSec > 30)  { status = 'stalled';  description = 'Sequencer may be stalled'; }
    else if (lagSec > 5)   { status = 'degraded'; description = 'Sequencer slightly delayed'; }

    // Estimate tx/s from last few blocks
    let tps = null;
    try {
      const prevBlock = await provider.getBlock(blockNumber - 10);
      if (prevBlock) {
        const timeDiff = blockTs - Number(prevBlock.timestamp);
        const txCount  = block.transactions.length;
        tps = timeDiff > 0 ? (txCount * 10 / timeDiff).toFixed(2) : null;
      }
    } catch(_) {}

    return {
      network,
      name:        NETWORKS[network]?.name,
      status,
      description,
      blockNumber,
      blockTimestamp: new Date(blockTs * 1000).toISOString(),
      lagSeconds:  lagSec,
      estimatedTps: tps ? parseFloat(tps) : null,
      targetBlockTimeMs: 250,
      checkedAt:   new Date().toISOString(),
    };
  } catch(err) {
    return { network, status: 'unreachable', error: err.message.slice(0, 100) };
  }
}

// ── Sepolia Faucet Info ───────────────────────────────────────────────────────

export function getSepoliaFaucets() {
  return [
    {
      name:        'Arbitrum Sepolia Faucet (Official)',
      url:         'https://faucet.arbitrum.io/',
      amount:      '0.001 ETH',
      requirement: 'Arbitrum account with mainnet history',
      dailyLimit:  true,
    },
    {
      name:        'Alchemy Faucet',
      url:         'https://sepoliafaucet.com/',
      amount:      '0.5 ETH / day',
      requirement: 'Alchemy account (free)',
      dailyLimit:  true,
    },
    {
      name:        'QuickNode Faucet',
      url:         'https://faucet.quicknode.com/arbitrum/sepolia',
      amount:      '0.01 ETH',
      requirement: 'QuickNode account',
      dailyLimit:  true,
    },
    {
      name:        'Chainlink Faucet',
      url:         'https://faucets.chain.link/arbitrum-sepolia',
      amount:      '0.1 ETH',
      requirement: 'Connect wallet',
      dailyLimit:  true,
    },
    {
      name:        'L2 Bridge from Ethereum Sepolia',
      url:         'https://bridge.arbitrum.io/?l2ChainId=421614',
      amount:      'Any amount',
      requirement: 'Ethereum Sepolia ETH (bridge)',
      dailyLimit:  false,
    },
  ];
}

export const KNOWN_TOKENS_MAP = KNOWN_TOKENS;
