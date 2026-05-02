/**
 * AgentTokenizer
 *
 * Deploys and interacts with AgentToken ERC-20 contracts on Arbitrum.
 *
 * Inspired by:
 *   - Virtuals Protocol  → agent tokenization + revenue sharing
 *   - ai16z/ElizaOS      → autonomous agent ERC-20 governance
 *   - Botto              → governance-led AI agent tokens
 */
import { ethers } from 'ethers';
import { compileAgentToken } from './compiler.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tokenizer');

// ── Constants ─────────────────────────────────────────────────────────────────

export const AGENT_TOKEN_EVENTS = {
  Transfer:         'Transfer',
  RevenueDeposited: 'RevenueDeposited',
  RevenueClaimed:   'RevenueClaimed',
  OwnershipTransferred: 'OwnershipTransferred'
};

const EXPLORER_URLS = {
  mainnet: 'https://arbiscan.io',
  sepolia: 'https://sepolia.arbiscan.io',
  nova:    'https://nova.arbiscan.io'
};

// ── AgentTokenizer Class ──────────────────────────────────────────────────────

export class AgentTokenizer {
  constructor(provider, network = 'sepolia') {
    this.provider = provider;
    this.network  = network;
    this._abi     = null;
    this._bytecode = null;
  }

  async _ensureCompiled() {
    if (this._abi && this._bytecode) return;
    const compiled = await compileAgentToken();
    this._abi      = compiled.abi;
    this._bytecode = compiled.bytecode;
  }

  // ── Deployment ────────────────────────────────────────────────────────────

  /**
   * Deploy a new AgentToken ERC-20 for an AI agent.
   *
   * @param {ethers.Signer} signer - Wallet that pays gas and receives all tokens
   * @param {Object} options
   *   - tokenName    {string}  - ERC-20 name       e.g. "AlphaTrader Token"
   *   - tokenSymbol  {string}  - ERC-20 symbol      e.g. "ALPHA"
   *   - totalSupply  {number}  - Total supply (no decimals) e.g. 1_000_000
   *   - agentName    {string}  - Agent name
   *   - agentType    {string}  - Agent type (trading/defi/nft/...)
   *   - description  {string}  - Token description
   *   - agentNetwork {string}  - Deployment network
   * @returns {Object} Deployment result
   */
  async deployToken(signer, options = {}) {
    await this._ensureCompiled();

    const {
      tokenName   = `${options.agentName || 'Agent'} Token`,
      tokenSymbol = (options.agentName || 'AGENT').slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, ''),
      totalSupply = 1_000_000,
      agentName   = 'Agent',
      agentType   = 'custom',
      description = `AI Agent token for ${agentName}`,
      agentNetwork = this.network
    } = options;

    log.info('Deploying AgentToken', { tokenName, tokenSymbol, totalSupply, agentName });

    const factory = new ethers.ContractFactory(this._abi, this._bytecode, signer);

    const contract = await factory.deploy(
      tokenName,
      tokenSymbol,
      BigInt(totalSupply),
      agentName,
      agentType,
      description,
      agentNetwork
    );

    log.info('Token deployment tx sent', { hash: contract.deploymentTransaction()?.hash });
    const receipt = await contract.waitForDeployment();
    const address = await contract.getAddress();

    log.info('AgentToken deployed', { address, network: this.network });

    return {
      success:     true,
      address,
      tokenName,
      tokenSymbol,
      totalSupply,
      agentName,
      agentType,
      description,
      agentNetwork,
      deployer:    await signer.getAddress(),
      txHash:      contract.deploymentTransaction()?.hash,
      explorer:    `${EXPLORER_URLS[this.network] || EXPLORER_URLS.sepolia}/token/${address}`,
      txExplorer:  `${EXPLORER_URLS[this.network] || EXPLORER_URLS.sepolia}/tx/${contract.deploymentTransaction()?.hash}`,
      deployedAt:  new Date().toISOString(),
      network:     this.network
    };
  }

  // ── Token Interaction ─────────────────────────────────────────────────────

  _contract(address, signer) {
    return new ethers.Contract(address, this._abi, signer || this.provider);
  }

  async _ensureAbi() {
    if (!this._abi) { await this._ensureCompiled(); }
  }

  /**
   * Get full token info from the contract.
   */
  async getTokenInfo(tokenAddress) {
    await this._ensureAbi();
    const contract = this._contract(tokenAddress);

    const [
      name, symbol, decimals, totalSupply,
      agentInfo
    ] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
      contract.getAgentInfo()
    ]);

    return {
      address:        tokenAddress,
      name,
      symbol,
      decimals:       Number(decimals),
      totalSupply:    ethers.formatUnits(totalSupply, 18),
      totalSupplyRaw: totalSupply.toString(),
      agentName:      agentInfo[0],
      agentType:      agentInfo[1],
      description:    agentInfo[2],
      agentNetwork:   agentInfo[3],
      owner:          agentInfo[4],
      createdAt:      new Date(Number(agentInfo[5]) * 1000).toISOString(),
      totalRevenue:   ethers.formatEther(agentInfo[7]),
      dividendPerToken: agentInfo[8].toString(),
      explorer:       `${EXPLORER_URLS[this.network] || EXPLORER_URLS.sepolia}/token/${tokenAddress}`
    };
  }

  /**
   * Get holder's balance and pending revenue.
   */
  async getHolderInfo(tokenAddress, holderAddress) {
    await this._ensureAbi();
    const contract = this._contract(tokenAddress);

    const [balance, pending, claimed] = await Promise.all([
      contract.balanceOf(holderAddress),
      contract.pendingRevenue(holderAddress),
      contract.claimable(holderAddress)
    ]);

    const totalSupply = await contract.totalSupply();
    const share = totalSupply > 0n
      ? (Number(balance) / Number(totalSupply) * 100).toFixed(4)
      : '0';

    return {
      address:        holderAddress,
      balance:        ethers.formatUnits(balance, 18),
      balanceRaw:     balance.toString(),
      ownershipPct:   share,
      pendingRevenue: ethers.formatEther(pending),
      claimable:      ethers.formatEther(claimed)
    };
  }

  /**
   * Deposit ETH revenue to be shared among all holders.
   * Called after the agent generates profits.
   */
  async depositRevenue(tokenAddress, signer, ethAmount) {
    await this._ensureAbi();
    const contract = this._contract(tokenAddress, signer);
    const value    = ethers.parseEther(ethAmount.toString());

    const tx      = await contract.depositRevenue({ value });
    const receipt = await tx.wait();

    log.info('Revenue deposited', { tokenAddress, ethAmount, txHash: receipt.hash });

    return {
      success:    true,
      txHash:     receipt.hash,
      explorer:   `${EXPLORER_URLS[this.network] || EXPLORER_URLS.sepolia}/tx/${receipt.hash}`,
      amount:     ethAmount.toString(),
      gasUsed:    receipt.gasUsed.toString()
    };
  }

  /**
   * Claim pending ETH revenue as a token holder.
   */
  async claimRevenue(tokenAddress, signer) {
    await this._ensureAbi();
    const holderAddr = await signer.getAddress();
    const contract   = this._contract(tokenAddress, signer);

    // Check pending before claiming
    const pending = await contract.pendingRevenue(holderAddr);
    if (pending === 0n) {
      return { success: false, error: 'No revenue to claim', pending: '0' };
    }

    const tx      = await contract.claimRevenue();
    const receipt = await tx.wait();

    log.info('Revenue claimed', { tokenAddress, holder: holderAddr, txHash: receipt.hash });

    return {
      success:  true,
      txHash:   receipt.hash,
      explorer: `${EXPLORER_URLS[this.network] || EXPLORER_URLS.sepolia}/tx/${receipt.hash}`,
      claimed:  ethers.formatEther(pending),
      gasUsed:  receipt.gasUsed.toString()
    };
  }

  /**
   * Transfer tokens from signer to recipient.
   */
  async transferTokens(tokenAddress, signer, toAddress, amount) {
    await this._ensureAbi();
    const contract = this._contract(tokenAddress, signer);
    const decimals = await contract.decimals();
    const amountRaw = ethers.parseUnits(amount.toString(), decimals);

    const tx      = await contract.transfer(toAddress, amountRaw);
    const receipt = await tx.wait();

    return {
      success:  true,
      txHash:   receipt.hash,
      explorer: `${EXPLORER_URLS[this.network] || EXPLORER_URLS.sepolia}/tx/${receipt.hash}`,
      from:     await signer.getAddress(),
      to:       toAddress,
      amount:   amount.toString()
    };
  }

  /**
   * Transfer token ownership to a new address.
   */
  async transferOwnership(tokenAddress, signer, newOwner) {
    await this._ensureAbi();
    const contract = this._contract(tokenAddress, signer);
    const tx       = await contract.transferOwnership(newOwner);
    const receipt  = await tx.wait();

    return {
      success:  true,
      txHash:   receipt.hash,
      newOwner,
      explorer: `${EXPLORER_URLS[this.network] || EXPLORER_URLS.sepolia}/tx/${receipt.hash}`
    };
  }

  /**
   * Get token holder list from Transfer events (on-chain, no indexer needed).
   * Returns top holders sorted by balance.
   */
  async getHolders(tokenAddress, limit = 50) {
    await this._ensureAbi();
    const contract    = this._contract(tokenAddress);
    const deployBlock = await this._getDeployBlock(tokenAddress);
    const currentBlock = await this.provider.getBlockNumber();

    // Fetch all Transfer events
    const filter = contract.filters.Transfer();
    const events = await contract.queryFilter(filter, deployBlock, currentBlock);

    // Compute balances
    const balances = new Map();
    for (const ev of events) {
      const { from, to, value } = ev.args;
      if (from !== ethers.ZeroAddress) {
        balances.set(from, (balances.get(from) || 0n) - value);
      }
      if (to !== ethers.ZeroAddress) {
        balances.set(to, (balances.get(to) || 0n) + value);
      }
    }

    const totalSupply = await contract.totalSupply();
    const holders = [...balances.entries()]
      .filter(([, bal]) => bal > 0n)
      .sort(([, a], [, b]) => (b > a ? 1 : -1))
      .slice(0, limit)
      .map(([addr, bal]) => ({
        address:     addr,
        balance:     ethers.formatUnits(bal, 18),
        ownershipPct:(Number(bal) / Number(totalSupply) * 100).toFixed(4)
      }));

    return { holders, totalHolders: holders.length };
  }

  async _getDeployBlock(address) {
    try {
      // Use a broad search — fine for small block ranges
      return Math.max(0, (await this.provider.getBlockNumber()) - 100_000);
    } catch {
      return 0;
    }
  }
}
