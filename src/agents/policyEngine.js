/**
 * Policy Engine — Spending Limits & Safety Guardrails
 *
 * Inspired by Coinbase AgentKit's Policy Engine.
 * Prevents autonomous agents from executing transactions
 * that exceed configured safety limits.
 *
 * Features:
 *   - Max spend per transaction (ETH-equivalent)
 *   - Max spend per time window (daily / hourly)
 *   - Allowed token whitelist
 *   - Allowed protocol whitelist
 *   - Max slippage enforcement
 *   - Emergency pause
 */

export class PolicyEngine {
  constructor(policy = {}) {
    this.policy = {
      // Spending limits
      maxTxSizeEth:     policy.maxTxSizeEth    ?? 0.1,     // max ETH per tx
      maxDailySpendEth: policy.maxDailySpendEth ?? 1.0,    // max ETH per day
      maxHourlySpendEth:policy.maxHourlySpendEth ?? 0.25,  // max ETH per hour

      // Slippage
      maxSlippageBps:   policy.maxSlippageBps  ?? 100,     // 1% max slippage

      // Whitelist / blacklist (null = allow all)
      allowedTokens:    policy.allowedTokens    ?? null,   // ['ETH','USDC','ARB']
      blockedTokens:    policy.blockedTokens     ?? [],    // always blocked
      allowedProtocols: policy.allowedProtocols  ?? null,  // null = all allowed

      // Interest-free enforcement
      interestFreeMode: policy.interestFreeMode  ?? false,

      // Emergency
      paused:           policy.paused            ?? false
    };

    // Spend tracking
    this.spendLog = [];   // [{ ts, ethAmount }]
  }

  // ── Check ─────────────────────────────────────────────────────────────────

  /**
   * Check if a proposed transaction is allowed.
   * Throws PolicyViolationError if denied.
   */
  check(action) {
    if (this.policy.paused) {
      throw new PolicyViolationError('PAUSED', 'Policy engine is paused — all transactions blocked');
    }

    const { type, tokenIn, tokenOut, amountEth, slippageBps } = action;

    // Token whitelist check
    if (this.policy.allowedTokens) {
      if (tokenIn  && !this.policy.allowedTokens.includes(tokenIn.toUpperCase())) {
        throw new PolicyViolationError('TOKEN_NOT_ALLOWED', `Token ${tokenIn} is not in allowed list`);
      }
      if (tokenOut && !this.policy.allowedTokens.includes(tokenOut.toUpperCase())) {
        throw new PolicyViolationError('TOKEN_NOT_ALLOWED', `Token ${tokenOut} is not in allowed list`);
      }
    }

    // Blocked tokens
    for (const blocked of this.policy.blockedTokens) {
      if (tokenIn?.toUpperCase()  === blocked.toUpperCase()) throw new PolicyViolationError('TOKEN_BLOCKED', `${tokenIn} is blocked`);
      if (tokenOut?.toUpperCase() === blocked.toUpperCase()) throw new PolicyViolationError('TOKEN_BLOCKED', `${tokenOut} is blocked`);
    }

    // Interest-free mode
    if (this.policy.interestFreeMode) {
      const interestProtocols = ['aave', 'radiant', 'compound', 'margin', 'leverage', 'borrow', 'lend'];
      const actionStr = JSON.stringify(action).toLowerCase();
      for (const term of interestProtocols) {
        if (actionStr.includes(term)) {
          throw new PolicyViolationError('INTEREST_FREE_VIOLATION', `${term} is not allowed in interest-free mode`);
        }
      }
    }

    // Slippage check
    if (slippageBps && slippageBps > this.policy.maxSlippageBps) {
      throw new PolicyViolationError(
        'SLIPPAGE_TOO_HIGH',
        `Slippage ${slippageBps}bps exceeds max ${this.policy.maxSlippageBps}bps`
      );
    }

    // Transaction size
    if (amountEth && amountEth > this.policy.maxTxSizeEth) {
      throw new PolicyViolationError(
        'TX_TOO_LARGE',
        `Transaction size ${amountEth} ETH exceeds max ${this.policy.maxTxSizeEth} ETH`
      );
    }

    // Hourly spend limit
    const hourlySpend = this._windowSpend(3_600_000);
    if (amountEth && (hourlySpend + amountEth) > this.policy.maxHourlySpendEth) {
      throw new PolicyViolationError(
        'HOURLY_LIMIT',
        `Hourly spend ${hourlySpend.toFixed(4)} + ${amountEth} ETH exceeds limit ${this.policy.maxHourlySpendEth} ETH`
      );
    }

    // Daily spend limit
    const dailySpend = this._windowSpend(86_400_000);
    if (amountEth && (dailySpend + amountEth) > this.policy.maxDailySpendEth) {
      throw new PolicyViolationError(
        'DAILY_LIMIT',
        `Daily spend ${dailySpend.toFixed(4)} + ${amountEth} ETH exceeds limit ${this.policy.maxDailySpendEth} ETH`
      );
    }

    return true;
  }

  /**
   * Record a completed transaction for spend tracking
   */
  record(amountEth) {
    this.spendLog.push({ ts: Date.now(), ethAmount: parseFloat(amountEth) || 0 });
    // Keep last 7 days only
    const cutoff = Date.now() - 7 * 86_400_000;
    this.spendLog = this.spendLog.filter(e => e.ts >= cutoff);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  update(updates) {
    Object.assign(this.policy, updates);
  }

  pause()  { this.policy.paused = true;  }
  resume() { this.policy.paused = false; }

  getStatus() {
    return {
      ...this.policy,
      hourlySpent: this._windowSpend(3_600_000).toFixed(4),
      dailySpent:  this._windowSpend(86_400_000).toFixed(4),
      txCount24h:  this._windowCount(86_400_000)
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _windowSpend(windowMs) {
    const cutoff = Date.now() - windowMs;
    return this.spendLog
      .filter(e => e.ts >= cutoff)
      .reduce((sum, e) => sum + e.ethAmount, 0);
  }

  _windowCount(windowMs) {
    const cutoff = Date.now() - windowMs;
    return this.spendLog.filter(e => e.ts >= cutoff).length;
  }
}

export class PolicyViolationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PolicyViolationError';
    this.code = code;
  }
}
