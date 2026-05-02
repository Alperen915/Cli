/**
 * Token Service
 *
 * High-level service for creating and managing agent tokens.
 * Wraps AgentTokenizer with storage persistence and agent integration.
 */
import { ethers } from 'ethers';
import { AgentTokenizer } from '../blockchain/tokenizer.js';
import { ArbitrumWallet } from '../blockchain/wallet.js';
import { storage } from '../utils/storage.js';
import { onchainService } from './onchainService.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('token-service');

// ── Token Registry (in-memory + disk) ─────────────────────────────────────────

function getTokenRegistry() {
  return storage.loadTokenRegistry();
}

function saveTokenRegistry(registry) {
  storage.saveTokenRegistry(registry);
}

// ── Service ───────────────────────────────────────────────────────────────────

export const tokenService = {

  /**
   * Tokenize an AI agent — deploy an ERC-20 on Arbitrum.
   *
   * @param {string} agentName - Agent to tokenize
   * @param {string} privateKey - Deployer wallet private key
   * @param {Object} options - Token configuration
   */
  async tokenizeAgent(agentName, privateKey, options = {}) {
    const saved = storage.loadAgents().find(a => a.name === agentName);
    if (!saved) throw new Error(`Agent "${agentName}" not found`);

    // Check not already tokenized
    const registry = getTokenRegistry();
    if (registry[agentName] && !options.force) {
      throw new Error(
        `Agent "${agentName}" is already tokenized. Token: ${registry[agentName].address}. ` +
        `Pass force:true to deploy a new token.`
      );
    }

    const wallet    = new ArbitrumWallet(saved.network);
    const signer    = new ethers.Wallet(privateKey, wallet.provider);
    const tokenizer = new AgentTokenizer(wallet.provider, saved.network);

    const result = await tokenizer.deployToken(signer, {
      tokenName:   options.tokenName   || `${agentName} Token`,
      tokenSymbol: options.tokenSymbol || agentName.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, ''),
      totalSupply: options.totalSupply || 1_000_000,
      agentName,
      agentType:   saved.type,
      description: options.description || `Autonomous AI agent token for ${agentName} on Arbitrum. Powered by Arbitrum AI Agent Platform.`,
      agentNetwork: saved.network
    });

    // Persist to registry
    const entry = {
      agentName,
      agentType:   saved.type,
      agentNetwork: saved.network,
      ...result
    };

    registry[agentName] = entry;
    saveTokenRegistry(registry);

    log.info('Agent tokenized', { agentName, address: result.address });
    return entry;
  },

  /**
   * Get token info for a tokenized agent.
   */
  async getAgentToken(agentName) {
    const registry = getTokenRegistry();
    const entry    = registry[agentName];
    if (!entry) throw new Error(`Agent "${agentName}" has not been tokenized yet`);

    // Fetch live on-chain info
    try {
      const wallet    = new ArbitrumWallet(entry.agentNetwork || 'sepolia');
      const tokenizer = new AgentTokenizer(wallet.provider, entry.agentNetwork);
      const liveInfo  = await tokenizer.getTokenInfo(entry.address);
      return { ...entry, ...liveInfo, cached: false };
    } catch (err) {
      log.warn('Could not fetch live token info, returning cached', { error: err.message });
      return { ...entry, cached: true };
    }
  },

  /**
   * List all tokenized agents.
   */
  listTokenizedAgents() {
    const registry = getTokenRegistry();
    return Object.values(registry);
  },

  /**
   * Get holder info for a specific address.
   */
  async getHolderInfo(agentName, holderAddress) {
    const registry = getTokenRegistry();
    const entry    = registry[agentName];
    if (!entry) throw new Error(`Agent "${agentName}" has not been tokenized`);

    const wallet    = new ArbitrumWallet(entry.agentNetwork || 'sepolia');
    const tokenizer = new AgentTokenizer(wallet.provider, entry.agentNetwork);
    return tokenizer.getHolderInfo(entry.address, holderAddress);
  },

  /**
   * Get token holder list.
   */
  async getHolders(agentName, limit = 50) {
    const registry = getTokenRegistry();
    const entry    = registry[agentName];
    if (!entry) throw new Error(`Agent "${agentName}" has not been tokenized`);

    const wallet    = new ArbitrumWallet(entry.agentNetwork || 'sepolia');
    const tokenizer = new AgentTokenizer(wallet.provider, entry.agentNetwork);
    return tokenizer.getHolders(entry.address, limit);
  },

  /**
   * Deposit ETH revenue to token holders.
   * Usually called automatically after agent generates profits.
   */
  async depositRevenue(agentName, privateKey, ethAmount) {
    const registry = getTokenRegistry();
    const entry    = registry[agentName];
    if (!entry) throw new Error(`Agent "${agentName}" has not been tokenized`);

    const wallet    = new ArbitrumWallet(entry.agentNetwork || 'sepolia');
    const signer    = new ethers.Wallet(privateKey, wallet.provider);
    const tokenizer = new AgentTokenizer(wallet.provider, entry.agentNetwork);

    const result = await tokenizer.depositRevenue(entry.address, signer, ethAmount);

    // Update total revenue in registry
    registry[agentName].totalRevenue = (
      parseFloat(registry[agentName].totalRevenue || '0') + parseFloat(ethAmount)
    ).toString();
    saveTokenRegistry(registry);

    return result;
  },

  /**
   * Claim pending revenue as a token holder.
   */
  async claimRevenue(agentName, privateKey) {
    const registry = getTokenRegistry();
    const entry    = registry[agentName];
    if (!entry) throw new Error(`Agent "${agentName}" has not been tokenized`);

    const wallet    = new ArbitrumWallet(entry.agentNetwork || 'sepolia');
    const signer    = new ethers.Wallet(privateKey, wallet.provider);
    const tokenizer = new AgentTokenizer(wallet.provider, entry.agentNetwork);

    return tokenizer.claimRevenue(entry.address, signer);
  },

  /**
   * Transfer tokens to another address.
   */
  async transferTokens(agentName, privateKey, toAddress, amount) {
    const registry = getTokenRegistry();
    const entry    = registry[agentName];
    if (!entry) throw new Error(`Agent "${agentName}" has not been tokenized`);

    const wallet    = new ArbitrumWallet(entry.agentNetwork || 'sepolia');
    const signer    = new ethers.Wallet(privateKey, wallet.provider);
    const tokenizer = new AgentTokenizer(wallet.provider, entry.agentNetwork);

    return tokenizer.transferTokens(entry.address, signer, toAddress, amount);
  },

  /**
   * Transfer token ownership to a new address.
   */
  async transferOwnership(agentName, privateKey, newOwner) {
    const registry = getTokenRegistry();
    const entry    = registry[agentName];
    if (!entry) throw new Error(`Agent "${agentName}" has not been tokenized`);

    const wallet    = new ArbitrumWallet(entry.agentNetwork || 'sepolia');
    const signer    = new ethers.Wallet(privateKey, wallet.provider);
    const tokenizer = new AgentTokenizer(wallet.provider, entry.agentNetwork);

    const result = await tokenizer.transferOwnership(entry.address, signer, newOwner);
    registry[agentName].owner = newOwner;
    saveTokenRegistry(registry);

    return result;
  },

  /**
   * Remove token from registry (does NOT affect on-chain state).
   */
  removeFromRegistry(agentName) {
    const registry = getTokenRegistry();
    if (!registry[agentName]) throw new Error(`Agent "${agentName}" is not in the token registry`);
    delete registry[agentName];
    saveTokenRegistry(registry);
    return { success: true, message: `${agentName} removed from token registry` };
  },

  /**
   * Check compilation status (pre-compile the contract cache).
   */
  async precompile() {
    const { compileAgentToken } = await import('../blockchain/compiler.js');
    return compileAgentToken();
  }
};
