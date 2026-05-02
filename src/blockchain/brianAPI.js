/**
 * Brian API Integration
 * Natural language → on-chain transaction calldata
 * Docs: https://docs.brianknows.org
 * Base: https://api.brianknows.org/api/v0
 *
 * Supports: swap, bridge, transfer, deposit/withdraw (Aave),
 *           borrow/repay, ENS — on Arbitrum + 15 other chains
 * Solvers:  LiFi, Enso, Bungee, Portals, Symbiosis (best route)
 */

const BRIAN_BASE = 'https://api.brianknows.org/api/v0';

// Arbitrum chain IDs
export const CHAIN_IDS = {
  mainnet: '42161',
  sepolia: '421614',
  ethereum: '1',
  base: '8453',
  optimism: '10',
  polygon: '137',
  bsc: '56'
};

export class BrianAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      'x-brian-api-key': apiKey
    };
  }

  /**
   * Build transaction(s) from a natural language prompt.
   * Returns ready-to-sign transaction calldata.
   *
   * Example prompts:
   *   "Swap 0.01 ETH to USDC on Arbitrum"
   *   "Bridge 10 USDC from Arbitrum to Base"
   *   "Deposit 100 USDC into Aave on Arbitrum"
   *   "Swap 50% of my ETH to USDC"
   */
  async buildTransaction(prompt, walletAddress, network = 'mainnet') {
    const chainId = CHAIN_IDS[network] || CHAIN_IDS.mainnet;

    const res = await fetch(`${BRIAN_BASE}/agent/transaction`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ prompt, chainId, address: walletAddress })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Brian API error ${res.status}: ${err.error || err.message || res.statusText}`);
    }

    const data = await res.json();
    if (!data.result || !data.result.length) {
      throw new Error('Brian API returned no transactions for this prompt');
    }

    return data.result.map(r => ({
      action:      r.action,
      solver:      r.solver,
      description: r.data?.description || '',
      gasCost:     r.data?.gasCostUSD,
      fromToken:   r.data?.fromToken,
      toToken:     r.data?.toToken,
      fromAmount:  r.data?.fromAmount,
      toAmount:    r.data?.toAmount,
      steps:       r.data?.steps || [],
      transaction: r.data?.steps?.[0]?.transactionRequest || r.data?.transaction || null
    }));
  }

  /**
   * Execute a Brian-built transaction with a connected signer.
   * Signs and sends the raw calldata returned by Brian.
   */
  async executeTransaction(signer, brianResult) {
    const tx = brianResult.transaction;
    if (!tx) throw new Error('No transaction data in Brian result');

    const { ethers } = await import('ethers');

    const txRequest = {
      to:       tx.to,
      data:     tx.data,
      value:    tx.value ? BigInt(tx.value) : 0n,
      gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined
    };

    const sentTx  = await signer.sendTransaction(txRequest);
    const receipt = await sentTx.wait();

    return {
      success:     true,
      txHash:      receipt.hash,
      action:      brianResult.action,
      solver:      brianResult.solver,
      description: brianResult.description,
      gasUsed:     receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      explorer:    `https://arbiscan.io/tx/${receipt.hash}`
    };
  }

  /**
   * Get AI-powered knowledge answer (read-only, no tx).
   * e.g. "What is the current ETH price?" or "Explain GMX"
   */
  async ask(prompt) {
    const res = await fetch(`${BRIAN_BASE}/agent/knowledge`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ prompt, kb: 'public-knowledge-box' })
    });
    if (!res.ok) throw new Error(`Brian Knowledge API error: ${res.status}`);
    const data = await res.json();
    return data.result;
  }

  /**
   * Resolve intent from prompt without building tx.
   * Returns structured intent object.
   */
  async extractIntent(prompt) {
    const res = await fetch(`${BRIAN_BASE}/agent/parameters-extraction`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error(`Brian extraction error: ${res.status}`);
    return res.json();
  }

  /**
   * Natural language → sign → broadcast
   * One-shot: prompt + signer = executed tx
   */
  async intend(prompt, signer, network = 'mainnet') {
    const walletAddress = await signer.getAddress();
    const results = await this.buildTransaction(prompt, walletAddress, network);
    const receipts = [];

    for (const result of results) {
      if (!result.transaction) {
        receipts.push({ action: result.action, skipped: true, reason: 'no calldata' });
        continue;
      }
      const receipt = await this.executeTransaction(signer, result);
      receipts.push(receipt);
    }

    return receipts;
  }
}

/**
 * LiFi Quote API (free, no auth required)
 * Used for optimal routing without Brian API key
 */
export class LiFiRouter {
  constructor(network = 'mainnet') {
    this.chainId = CHAIN_IDS[network] || CHAIN_IDS.mainnet;
    this.BASE = 'https://li.quest/v1';
  }

  async getQuote({ fromToken, toToken, fromAmount, fromAddress }) {
    const TOKEN_MAP = {
      ETH:  '0x0000000000000000000000000000000000000000',
      WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      ARB:  '0x912CE59144191C1204E64559FE8253a0e49E6548'
    };

    const fromAddr = TOKEN_MAP[fromToken?.toUpperCase()] || fromToken;
    const toAddr   = TOKEN_MAP[toToken?.toUpperCase()]   || toToken;

    const params = new URLSearchParams({
      fromChain:   this.chainId,
      toChain:     this.chainId,
      fromToken:   fromAddr,
      toToken:     toAddr,
      fromAmount:  fromAmount.toString(),
      fromAddress: fromAddress || '0x0000000000000000000000000000000000000001'
    });

    const res = await fetch(`${this.BASE}/quote?${params}`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LiFi error: ${err.message || res.statusText}`);
    }

    const data = await res.json();
    return {
      fromToken,
      toToken,
      fromAmount: data.estimate?.fromAmount,
      toAmount:   data.estimate?.toAmount,
      toAmountMin: data.estimate?.toAmountMin,
      gasCostUSD: data.estimate?.gasCosts?.[0]?.amountUSD,
      tool:       data.toolDetails?.name || data.tool,
      type:       data.type,
      transactionRequest: data.transactionRequest
    };
  }

  async executeQuote(signer, quote) {
    const tx = quote.transactionRequest;
    if (!tx) throw new Error('No transaction in LiFi quote');

    const { ethers } = await import('ethers');

    const sentTx  = await signer.sendTransaction({
      to:       tx.to,
      data:     tx.data,
      value:    tx.value ? BigInt(tx.value) : 0n,
      gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined
    });
    const receipt = await sentTx.wait();

    return {
      success:     true,
      txHash:      receipt.hash,
      tool:        quote.tool,
      fromToken:   quote.fromToken,
      toToken:     quote.toToken,
      explorer:    `https://arbiscan.io/tx/${receipt.hash}`
    };
  }
}
