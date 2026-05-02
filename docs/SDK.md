# Arbitrum AI Agent Platform - SDK

**Embed powerful AI agents directly into your Node.js applications.**

The SDK provides programmatic access to all platform features - create agents, access real-time analytics, and build custom DeFi automation with just a few lines of code.

---

## Installation

```bash
npm install arbitrum-ai-agent-cli
```

---

## Quick Start

```javascript
// Import the services you need
import { agentService, analyticsService } from 'arbitrum-ai-agent-cli/services';

// Create an AI-powered trading agent
const agent = agentService.createAgent('AlphaBot', 'trading', 'mainnet');

// Get real-time DeFi data
const prices = await analyticsService.getPrices();
const yields = await analyticsService.getYields();

console.log('Top yields on Arbitrum:', yields.slice(0, 5));
```

---

## Agent Service

The `agentService` provides complete agent lifecycle management.

### Create Agents

```javascript
import { agentService } from 'arbitrum-ai-agent-cli/services';

// Standard trading agent
const trader = agentService.createAgent('AlphaTrader', 'trading', 'mainnet');

// Interest-free (halal-compliant) DeFi agent
const halalAgent = agentService.createAgent('HalalYield', 'defi', 'mainnet', {
  interestFreeMode: true
});

// On-chain deployment agent
const deployer = agentService.createAgent('ContractBot', 'onchain', 'sepolia');
```

### Available Agent Types

| Type | Best For |
|------|----------|
| `trading` | Swaps, arbitrage, perpetual strategies |
| `defi` | Yield optimization, staking, lending |
| `onchain` | Smart contract deployment and interaction |
| `nft` | NFT minting, trading, collection analysis |
| `social` | Alpha tracking, sentiment analysis |
| `custom` | Build your own capabilities |

### Manage Agents

```javascript
// List all agents
const agents = agentService.listAgents();
console.log(`You have ${agents.length} agents`);

// Get specific agent
const trader = agentService.getAgent('AlphaTrader');

// Set active agent for operations
agentService.setActiveAgent('AlphaTrader');

// Delete agent
agentService.deleteAgent('OldBot');
```

### AI Chat

```javascript
// Have intelligent conversations with your agents
const response = await agentService.chat(
  'AlphaTrader',
  'What are the best arbitrage opportunities on Arbitrum right now?'
);

console.log('AI Analysis:', response.response.thought);
console.log('Recommended Action:', response.response.action);
```

---

## Analytics Service

Access real-time DeFi data without any API key requirements.

### Live Token Prices

```javascript
import { analyticsService } from 'arbitrum-ai-agent-cli/services';

const prices = await analyticsService.getPrices();

prices.forEach(token => {
  const change = token.change24h >= 0 ? '+' : '';
  console.log(`${token.symbol}: $${token.price.toFixed(2)} (${change}${token.change24h}%)`);
});
```

### Protocol Rankings

```javascript
// Get top 10 protocols by TVL
const protocols = await analyticsService.getProtocols(10);

protocols.forEach(p => {
  console.log(`#${p.rank} ${p.name}: $${(p.tvl / 1e6).toFixed(2)}M TVL`);
});
```

### Yield Opportunities

```javascript
// Find the best APY opportunities
const yields = await analyticsService.getYields(20);

console.log('Top Yield Opportunities:');
yields.forEach(pool => {
  console.log(`${pool.pool} on ${pool.protocol}: ${pool.apy.toFixed(2)}% APY`);
});
```

### Gas Estimation

```javascript
// Get current gas costs
const gas = await analyticsService.getGasEstimates('mainnet');

console.log('Current Gas Costs:');
console.log(`  ETH Transfer: $${gas.estimates.ethTransfer}`);
console.log(`  Token Swap: $${gas.estimates.swap}`);
console.log(`  Deploy Contract: $${gas.estimates.deployContract}`);
```

### Network Information

```javascript
// List all supported networks
const networks = analyticsService.getNetworks();

// Get live network stats
const mainnet = await analyticsService.getNetworkInfo('mainnet');
console.log(`Arbitrum One - Block: ${mainnet.blockNumber}, Gas: ${mainnet.gasPrice} Gwei`);
```

---

## Direct Agent Classes

For advanced use cases, instantiate agent classes directly.

### Trading Agent

```javascript
import { TradingAgent } from 'arbitrum-ai-agent-cli/lib';

const trader = new TradingAgent('SwapMaster', 'mainnet', {
  interestFreeMode: false
});

// Get trading advice
const analysis = await trader.think('How do I execute a large ETH to ARB swap with minimal slippage?');
console.log(analysis);
```

### DeFi Agent

```javascript
import { DefiAgent } from 'arbitrum-ai-agent-cli/lib';

// Standard DeFi agent with all features
const defi = new DefiAgent('YieldHunter', 'mainnet');

// Interest-free mode - suggests LP fees and staking instead of lending
const halalDefi = new DefiAgent('HalalYield', 'mainnet', { 
  interestFreeMode: true 
});

const opportunities = await halalDefi.think('Show me yield opportunities');
// Returns LP positions and staking - never lending or borrowing
```

### All Agent Classes

```javascript
import { 
  TradingAgent,    // Trading strategies and execution
  DefiAgent,       // Yield optimization
  OnChainAgent,    // Smart contract operations
  NFTAgent,        // NFT operations
  SocialAgent,     // Community and signals
  CustomAgent      // Build your own
} from 'arbitrum-ai-agent-cli/lib';
```

---

## Start API Server Programmatically

Launch the REST API from your application:

```javascript
import { startServer } from 'arbitrum-ai-agent-cli/api';

// Start on default port 3000
const server = await startServer();
console.log('API server running on port 3000');

// Or specify a custom port
const customServer = await startServer(8080);
```

---

## Real-World Examples

### Build a Yield Dashboard

```javascript
import { analyticsService } from 'arbitrum-ai-agent-cli/services';

async function getYieldDashboard() {
  const [prices, protocols, yields, gas] = await Promise.all([
    analyticsService.getPrices(),
    analyticsService.getProtocols(10),
    analyticsService.getYields(20),
    analyticsService.getGasEstimates('mainnet')
  ]);

  return {
    topTokens: prices.slice(0, 5),
    topProtocols: protocols,
    bestYields: yields.filter(y => y.tvl > 100000), // Filter low liquidity
    currentGas: gas,
    lastUpdated: new Date().toISOString()
  };
}
```

### Create a Trading Bot

```javascript
import { TradingAgent } from 'arbitrum-ai-agent-cli/lib';
import { analyticsService } from 'arbitrum-ai-agent-cli/services';

async function analyzeMarket() {
  const trader = new TradingAgent('MarketAnalyzer', 'mainnet');
  const prices = await analyticsService.getPrices();
  
  // Get AI-powered market analysis
  const analysis = await trader.think(
    `Current Arbitrum prices: ${JSON.stringify(prices.slice(0, 5))}. 
     Identify any trading opportunities based on price movements.`
  );
  
  return {
    prices,
    analysis,
    timestamp: new Date().toISOString()
  };
}
```

### Interest-Free Portfolio Manager

```javascript
import { DefiAgent } from 'arbitrum-ai-agent-cli/lib';

// Create halal-compliant portfolio manager
const halalManager = new DefiAgent('HalalPortfolio', 'mainnet', {
  interestFreeMode: true
});

// Will only suggest halal-compliant strategies
const strategies = await halalManager.think(
  'How can I grow my portfolio without interest-based products?'
);

// Response includes:
// - LP positions earning trading fees
// - Governance staking rewards  
// - NFT investments
// - Direct trading opportunities
// Never includes: lending, borrowing, margin, leverage
```

### Automated Price Monitoring

```javascript
import { analyticsService, agentService } from 'arbitrum-ai-agent-cli/services';

async function monitorPrices(interval = 60000) {
  const agent = agentService.createAgent('PriceMonitor', 'trading', 'mainnet');
  
  setInterval(async () => {
    const prices = await analyticsService.getPrices();
    const ethPrice = prices.find(p => p.symbol === 'ETH');
    
    if (ethPrice && Math.abs(ethPrice.change24h) > 5) {
      const analysis = await agentService.chat(
        'PriceMonitor',
        `ETH has moved ${ethPrice.change24h}% in 24h. Should I take action?`
      );
      console.log('Alert:', analysis.response);
    }
  }, interval);
}
```

---

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import type { 
  TradingAgent, 
  DefiAgent,
  OnChainAgent
} from 'arbitrum-ai-agent-cli/lib';

interface AgentConfig {
  name: string;
  type: 'trading' | 'defi' | 'onchain' | 'nft' | 'social' | 'custom';
  network: 'mainnet' | 'sepolia' | 'nova';
  interestFreeMode?: boolean;
}
```

---

## Environment Configuration

```bash
# Set for full AI capabilities
export OPENAI_API_KEY=your_key_here
```

Without an API key, agents provide intelligent fallback responses with helpful guidance.

---

## Brian API — Natural Language to Transactions

Convert plain English into on-chain transaction calldata using [Brian API](https://brianknows.org).

```javascript
import { TradingAgent } from 'arbitrum-ai-agent-cli/lib';

const agent = new TradingAgent('AlphaBot', 'mainnet', {
  brianApiKey: process.env.BRIAN_API_KEY  // or set BRIAN_API_KEY env var
});

// Attach wallet
agent.attachWallet(process.env.PRIVATE_KEY);

// One-shot: natural language → sign → broadcast
const receipts = await agent.intend('Swap 0.01 ETH to USDC');

// Or just build calldata (no execution)
const txData = await agent.buildIntent('Bridge 10 USDC from Arbitrum to Base');
console.log(txData[0].action);  // 'bridge'
console.log(txData[0].transaction.to);  // bridge contract address
```

**Supported intents:**
- `"Swap 0.01 ETH to USDC"`
- `"Swap 50% of my ETH to USDC"`
- `"Bridge 10 USDC from Arbitrum to Base"`
- `"Deposit 100 USDC into Aave on Arbitrum"`
- `"Borrow 50 USDC from Aave"`
- `"Transfer 1 ETH to 0xabc..."`

Brian uses LiFi, Enso, Bungee, and Portals as solvers for optimal routing.

---

## LiFi Multi-DEX Quotes (Free, No Auth)

Get best quotes across all major DEXs with no API key required:

```javascript
import { LiFiRouter } from 'arbitrum-ai-agent-cli/lib/blockchain/brianAPI.js';

const lifi = new LiFiRouter('mainnet');

// 0.01 ETH in wei = 10000000000000000
const quote = await lifi.getQuote({
  fromToken: 'ETH',
  toToken:   'USDC',
  fromAmount: '10000000000000000',
  fromAddress: '0xYourAddress'
});

console.log(`ETH → USDC: ${quote.toAmount} (via ${quote.tool})`);
console.log(`Gas cost: ~$${quote.gasCostUSD}`);

// Execute if you have a signer
const result = await lifi.executeQuote(signer, quote);
console.log(`Tx: ${result.explorer}`);
```

Or via the base agent:
```javascript
// amountWei: string in wei
const quote = await agent.lifiQuote('ETH', 'USDC', '10000000000000000');
```

---

## Strategy Engine

Automated rule-based execution — runs independently of the autonomous loop:

```javascript
import { TradingAgent } from 'arbitrum-ai-agent-cli/lib';

const agent = new TradingAgent('StratBot', 'mainnet');
agent.attachWallet(process.env.PRIVATE_KEY);

// DCA: buy $10 of ETH every 24 hours
agent.strategyEngine.addDCA({
  token: 'ETH',
  quoteToken: 'USDC',
  amount: '10',
  intervalHours: 24,
  dryRun: true   // ← set false for real trades
});

// Stop-Loss: sell 100% of ETH if price drops 10%
agent.strategyEngine.addStopLoss({
  token: 'ETH',
  lossPercent: 10,
  currentPrice: 3500,   // set at strategy creation time
  dryRun: true
});

// Take-Profit: sell 50% of ETH if price rises 20%
agent.strategyEngine.addTakeProfit({
  token: 'ETH',
  profitPercent: 20,
  amountPct: 50,
  currentPrice: 3500,
  dryRun: true
});

// Price Alert: notify when ETH crosses $4000
agent.strategyEngine.addPriceAlert({
  token: 'ETH',
  condition: 'above',   // 'above' | 'below'
  targetPrice: 4000,
  action: { type: 'notify', description: 'ETH hit $4k!' }
});

// Portfolio Rebalance: maintain ETH:50%, USDC:30%, ARB:20% weekly
agent.strategyEngine.addRebalance({
  targets: { ETH: 50, USDC: 30, ARB: 20 },
  intervalHours: 168
});

// Listen to events
agent.strategyEngine.on('strategy_triggered', e => {
  console.log(`Strategy fired: ${e.name} at price $${e.price}`);
});
agent.strategyEngine.on('strategy_executed', e => {
  console.log(`Executed:`, e.result);
});

// Start auto-polling (checks every 60 seconds)
agent.strategyEngine.start(60_000);

// Or trigger manually
const prices = await agent.strategyEngine._fetchPrices();
const triggered = await agent.strategyEngine.runNow(prices);
console.log(`${triggered} strategies triggered`);

// List all strategies
console.log(agent.strategyEngine.list());
```

---

## Policy Engine

Per-agent spending limits and safety guardrails — inspired by Coinbase AgentKit:

```javascript
import { TradingAgent } from 'arbitrum-ai-agent-cli/lib';

const agent = new TradingAgent('SafeBot', 'mainnet', {
  maxTxSizeEth:     0.05,   // max 0.05 ETH per transaction
  maxDailySpendEth: 0.5,    // max 0.5 ETH per day
  allowedTokens:    ['ETH', 'USDC', 'ARB'],  // whitelist (null = all)
  interestFreeMode: true    // halal: no lending/borrowing/leverage
});

// Check policy programmatically
try {
  agent.policy.check({ type: 'swap', tokenIn: 'ETH', amountEth: 0.01 });
  console.log('Trade allowed');
} catch (err) {
  if (err.code === 'TX_TOO_LARGE')   console.log('Trade too large');
  if (err.code === 'DAILY_LIMIT')    console.log('Daily limit reached');
  if (err.code === 'TOKEN_NOT_ALLOWED') console.log('Token not whitelisted');
}

// Update limits at runtime
agent.policy.update({ maxTxSizeEth: 0.1 });

// Emergency pause (blocks all transactions)
agent.policy.pause();
// ... later:
agent.policy.resume();

// View current policy + spend tracking
const status = agent.policy.getStatus();
console.log(`Daily spent: ${status.dailySpent} / ${status.maxDailySpendEth} ETH`);
console.log(`Tx count today: ${status.txCount24h}`);
```

**Policy violation codes:**
| Code | Meaning |
|------|---------|
| `PAUSED` | All transactions blocked |
| `TOKEN_NOT_ALLOWED` | Token not in allowedTokens whitelist |
| `TOKEN_BLOCKED` | Token is in blockedTokens list |
| `TX_TOO_LARGE` | Single tx exceeds maxTxSizeEth |
| `HOURLY_LIMIT` | Hourly spend cap reached |
| `DAILY_LIMIT` | Daily spend cap reached |
| `SLIPPAGE_TOO_HIGH` | Slippage exceeds maxSlippageBps |
| `INTEREST_FREE_VIOLATION` | Lending/borrowing in interest-free mode |

---

**Start building with the SDK today and automate your DeFi strategies.**
