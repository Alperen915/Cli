import { ethers } from 'ethers';
import {
  ADDRESSES, ERC20_ABI, WETH_ABI,
  UNISWAP_V3_ROUTER_ABI, UNISWAP_V3_QUOTER_ABI,
  getTokenAddress, getTokenDecimals, getPairFee
} from './contracts.js';

const SLIPPAGE_DENOMINATOR = 10000n;

export class OnChainExecutor {
  constructor(provider, network = 'mainnet') {
    this.provider = provider;
    this.network = network;
    this.addrs = ADDRESSES[network] || ADDRESSES.mainnet;
  }

  // ── Balances ──────────────────────────────────────────────────────────────

  async getEthBalance(address) {
    const bal = await this.provider.getBalance(address);
    return { raw: bal, formatted: ethers.formatEther(bal), symbol: 'ETH' };
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const [bal, decimals, symbol] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
      contract.symbol()
    ]);
    return {
      raw: bal,
      formatted: ethers.formatUnits(bal, decimals),
      symbol,
      decimals: Number(decimals)
    };
  }

  async getPortfolio(walletAddress) {
    const tokens = Object.entries(this.addrs)
      .filter(([sym, addr]) =>
        !['uniswapV3Router', 'uniswapV3Quoter', 'camelotRouter'].includes(sym) &&
        addr !== '0x0000000000000000000000000000000000000000'
      );

    const results = { ETH: await this.getEthBalance(walletAddress), tokens: {} };

    await Promise.allSettled(
      tokens.map(async ([sym, addr]) => {
        try {
          const bal = await this.getTokenBalance(addr, walletAddress);
          if (parseFloat(bal.formatted) > 0) {
            results.tokens[sym] = bal;
          }
        } catch {}
      })
    );
    return results;
  }

  // ── Token Approval ────────────────────────────────────────────────────────

  async approveToken(signer, tokenAddress, spender, amountRaw) {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const current = await contract.allowance(await signer.getAddress(), spender);

    if (current >= amountRaw) return { alreadyApproved: true };

    const tx = await contract.approve(spender, amountRaw);
    const receipt = await tx.wait();
    return {
      alreadyApproved: false,
      txHash: receipt.hash,
      explorer: `${this._explorer()}/tx/${receipt.hash}`
    };
  }

  // ── WETH Wrap / Unwrap ────────────────────────────────────────────────────

  async wrapETH(signer, amountEth) {
    const wethAddr = this.addrs.WETH;
    const weth = new ethers.Contract(wethAddr, WETH_ABI, signer);
    const tx = await weth.deposit({ value: ethers.parseEther(amountEth.toString()) });
    const receipt = await tx.wait();
    return { txHash: receipt.hash, explorer: `${this._explorer()}/tx/${receipt.hash}` };
  }

  async unwrapETH(signer, amountWeth) {
    const wethAddr = this.addrs.WETH;
    const weth = new ethers.Contract(wethAddr, WETH_ABI, signer);
    const tx = await weth.withdraw(ethers.parseEther(amountWeth.toString()));
    const receipt = await tx.wait();
    return { txHash: receipt.hash, explorer: `${this._explorer()}/tx/${receipt.hash}` };
  }

  // ── Swap Quote (read-only, no gas) ────────────────────────────────────────

  async getSwapQuote({ tokenInSymbol, tokenOutSymbol, amountIn }) {
    const tokenInAddr  = this._resolveToken(tokenInSymbol);
    const tokenOutAddr = this._resolveToken(tokenOutSymbol);
    if (!tokenInAddr || !tokenOutAddr) throw new Error(`Unknown token: ${tokenInSymbol} or ${tokenOutSymbol}`);

    const decimalsIn  = getTokenDecimals(tokenInSymbol);
    const decimalsOut = getTokenDecimals(tokenOutSymbol);
    const fee         = getPairFee(tokenInSymbol, tokenOutSymbol);
    const amountInRaw = ethers.parseUnits(amountIn.toString(), decimalsIn);

    const quoter = new ethers.Contract(this.addrs.uniswapV3Quoter, UNISWAP_V3_QUOTER_ABI, this.provider);

    try {
      const [amountOut] = await quoter.quoteExactInputSingle.staticCall({
        tokenIn:           tokenInAddr,
        tokenOut:          tokenOutAddr,
        amountIn:          amountInRaw,
        fee,
        sqrtPriceLimitX96: 0n
      });

      const amountOutFormatted = ethers.formatUnits(amountOut, decimalsOut);
      const price = parseFloat(amountOutFormatted) / parseFloat(amountIn);

      return {
        tokenIn:  tokenInSymbol,
        tokenOut: tokenOutSymbol,
        amountIn: amountIn.toString(),
        amountOut: amountOutFormatted,
        price: price.toFixed(6),
        fee: `${fee / 10000}%`,
        network: this.network
      };
    } catch (err) {
      throw new Error(`Quote failed: ${err.message}`);
    }
  }

  // ── Execute Swap (Uniswap V3) ─────────────────────────────────────────────

  async executeSwap(signer, { tokenInSymbol, tokenOutSymbol, amountIn, slippageBps = 50 }) {
    const walletAddress = await signer.getAddress();
    const tokenInAddr   = this._resolveToken(tokenInSymbol);
    const tokenOutAddr  = this._resolveToken(tokenOutSymbol);
    if (!tokenInAddr || !tokenOutAddr) throw new Error(`Unknown token: ${tokenInSymbol} or ${tokenOutSymbol}`);

    const decimalsIn  = getTokenDecimals(tokenInSymbol);
    const decimalsOut = getTokenDecimals(tokenOutSymbol);
    const fee         = getPairFee(tokenInSymbol, tokenOutSymbol);
    const amountInRaw = ethers.parseUnits(amountIn.toString(), decimalsIn);

    // Pre-flight balance check
    if (tokenInSymbol.toUpperCase() === 'ETH') {
      const ethBal = await this.provider.getBalance(walletAddress);
      const gasBuffer = ethers.parseEther('0.005'); // reserve ~0.005 ETH for gas
      if (ethBal < amountInRaw + gasBuffer) {
        throw new Error(`Insufficient ETH balance. Have ${ethers.formatEther(ethBal)} ETH, need ${amountIn} ETH + gas`);
      }
    } else {
      const contract = new ethers.Contract(tokenInAddr, ERC20_ABI, this.provider);
      const tokenBal = await contract.balanceOf(walletAddress);
      if (tokenBal < amountInRaw) {
        const decimals = await contract.decimals().catch(() => decimalsIn);
        throw new Error(`Insufficient ${tokenInSymbol} balance. Have ${ethers.formatUnits(tokenBal, decimals)}, need ${amountIn}`);
      }
    }

    // Get quote
    const quote = await this.getSwapQuote({ tokenInSymbol, tokenOutSymbol, amountIn });
    const amountOutMin = ethers.parseUnits(
      (parseFloat(quote.amountOut) * (1 - slippageBps / 10000)).toFixed(decimalsOut),
      decimalsOut
    );

    // Handle ETH → WETH auto-wrap
    let actualTokenIn = tokenInAddr;
    let value = 0n;
    if (tokenInSymbol.toUpperCase() === 'ETH') {
      actualTokenIn = this.addrs.WETH;
      value = amountInRaw;
    } else {
      // Approve router
      await this.approveToken(signer, tokenInAddr, this.addrs.uniswapV3Router, amountInRaw);
    }

    const router = new ethers.Contract(this.addrs.uniswapV3Router, UNISWAP_V3_ROUTER_ABI, signer);

    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 min
    const tx = await router.exactInputSingle(
      {
        tokenIn:           actualTokenIn,
        tokenOut:          tokenOutAddr,
        fee,
        recipient:         walletAddress,
        amountIn:          amountInRaw,
        amountOutMinimum:  amountOutMin,
        sqrtPriceLimitX96: 0n
      },
      { value }
    );

    const receipt = await tx.wait();

    return {
      success: true,
      txHash:      receipt.hash,
      explorer:    `${this._explorer()}/tx/${receipt.hash}`,
      tokenIn:     tokenInSymbol,
      tokenOut:    tokenOutSymbol,
      amountIn:    amountIn.toString(),
      amountOut:   quote.amountOut,
      slippage:    `${slippageBps / 100}%`,
      gasUsed:     receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber
    };
  }

  // ── ERC-20 Transfer ───────────────────────────────────────────────────────

  async transferToken(signer, tokenSymbol, toAddress, amount) {
    const tokenAddr = this._resolveToken(tokenSymbol);
    if (!tokenAddr) throw new Error(`Unknown token: ${tokenSymbol}`);

    const decimals = getTokenDecimals(tokenSymbol);
    const amountRaw = ethers.parseUnits(amount.toString(), decimals);

    const contract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
    const tx = await contract.transfer(toAddress, amountRaw);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash:  receipt.hash,
      explorer:`${this._explorer()}/tx/${receipt.hash}`,
      token:   tokenSymbol,
      to:      toAddress,
      amount:  amount.toString()
    };
  }

  // ── ETH Transfer ──────────────────────────────────────────────────────────

  async transferETH(signer, toAddress, amountEth) {
    const tx = await signer.sendTransaction({
      to:    toAddress,
      value: ethers.parseEther(amountEth.toString())
    });
    const receipt = await tx.wait();
    return {
      success: true,
      txHash:  receipt.hash,
      explorer:`${this._explorer()}/tx/${receipt.hash}`,
      to:      toAddress,
      amount:  amountEth.toString()
    };
  }

  // ── Gas Info ──────────────────────────────────────────────────────────────

  async getGasInfo() {
    const feeData = await this.provider.getFeeData();
    return {
      gasPrice:       ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'),
      maxFeePerGas:   feeData.maxFeePerGas   ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei')   : null,
      priorityFee:    feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _resolveToken(symbol) {
    if (symbol?.startsWith('0x')) return symbol;
    return getTokenAddress(symbol, this.network);
  }

  _explorer() {
    const explorers = {
      mainnet: 'https://arbiscan.io',
      sepolia: 'https://sepolia.arbiscan.io',
      nova:    'https://nova.arbiscan.io'
    };
    return explorers[this.network] || 'https://arbiscan.io';
  }
}
