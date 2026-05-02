# Arbitrum AI Agent Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Arbitrum](https://img.shields.io/badge/Arbitrum-Ecosystem-blue.svg)](https://arbitrum.io/)
[![npm](https://img.shields.io/badge/npm-arbitrum--ai--agent--cli-red.svg)](https://www.npmjs.com/package/arbitrum-ai-agent-cli)
[![API](https://img.shields.io/badge/REST%20API-50%20endpoints-orange.svg)](#rest-api)

**The most powerful AI-powered autonomous agent platform for the Arbitrum blockchain ecosystem.** Build, deploy, and manage agents that execute real DeFi strategies, optimize yields, trade NFTs, deploy smart contracts — all powered by multi-provider AI intelligence (GPT-4o, Claude, Gemini).

---

## Why Arbitrum AI Agent Platform?

| Feature | Details |
|---------|---------|
| **Instant Setup** | Get started in under 60 seconds with a single `npm install` |
| **Real On-Chain Execution** | Live swaps, transfers, arbitrage — not just simulations |
| **Natural Language → Transactions** | Brian API converts plain text into verified calldata |
| **Multi-DEX Routing** | LiFi aggregator finds best prices across Uniswap, Camelot, 1inch, and more |
| **AI-Powered Intelligence** | GPT-4o, Claude, or Gemini analyzes markets and guides decisions |
| **Autonomous Strategy Engine** | DCA, stop-loss, take-profit, price alerts, portfolio rebalancing |
| **Safety-First Policy Engine** | Spending limits, token whitelist, emergency pause |
| **Interest-Free Mode** | Halal-compliant — avoids all lending, borrowing, and margin trading |
| **50 REST Endpoints** | Full programmatic control over every feature |
| **Multi-Environment** | CLI, REST API, SDK library, Docker container |

---

## Key Features

### 6 Autonomous Agent Types

| Agent Type | What It Does |
|------------|--------------|
| **Trading** | Swaps, arbitrage, perpetuals on GMX, Camelot, Uniswap V3 |
| **DeFi** | Yield optimization across Radiant, Pendle, AAVE, and 50+ protocols |
| **On-Chain** | Deploy and manage smart contracts directly on Arbitrum |
| **NFT** | Mint, trade, and analyze NFT collections |
| **Social** | Track alpha signals and community sentiment |
| **Custom** | Build agents with your own custom capabilities |

---

### Brian API — Natural Language Transactions

Convert plain English into verified on-chain calldata without writing Solidity:

```bash
# In chat mode
/intent swap 0.1 ETH for USDC
/intent bridge 50 USDC from Arbitrum to Optimism
/intent transfer 10 ARB to 0xabc...
```

```http
POST /api/intent/build
{ "agentId": "...", "prompt": "swap 0.05 ETH for ARB" }
```

**Supported operations:** swap · bridge · transfer · deposit · withdraw · borrow · repay

Requires a `BRIAN_API_KEY` environment variable. Get one free at [brianknows.org](https://brianknows.org).

---

### LiFi Multi-DEX Routing

Free, no-auth best-price routing across all major DEX aggregators:

```bash
# In chat mode
/lifi quote ETH USDC 0.1
```

```http
GET /api/lifi-quote?tokenIn=ETH&tokenOut=USDC&amountIn=0.1&network=mainnet
```

- Routes through Uniswap V3, Camelot, 1inch, Paraswap, Enso
- Returns best quote, estimated output, fees, and route breakdown
- No API key required

---

### Strategy Engine

Autonomous strategies that run in the background and react to market conditions:

| Strategy Type | Description |
|---------------|-------------|
| **DCA** | Dollar-cost average into any token at configurable intervals |
| **Stop-Loss** | Auto-sell when token drops below your threshold |
| **Take-Profit** | Auto-sell when token hits your target price |
| **Price Alert** | Notify when price crosses a level |
| **Rebalance** | Keep portfolio at target allocations (±2% tolerance) |

```bash
# CLI / Chat
/strategy add dca --token ARB --amount 0.01 --interval 3600000
/strategy add stop-loss --token ETH --price 1800 --amount 0.5
/strategy list
/strategy remove <id>
```

```http
POST /api/agents/:id/strategies
GET  /api/agents/:id/strategies
DELETE /api/agents/:id/strategies/:strategyId
```

---

### Policy Engine

Coinbase AgentKit-inspired safety controls that run before every transaction:

| Policy Control | Description |
|----------------|-------------|
| **Per-Tx Limit** | Max ETH per single transaction (default: 0.1 ETH) |
| **Hourly Limit** | Max ETH per hour (default: 0.5 ETH) |
| **Daily Limit** | Max ETH per day (default: 1.0 ETH) |
| **Token Whitelist** | Only allow approved tokens |
| **Token Blacklist** | Block specific tokens |
| **Slippage Cap** | Reject high-slippage swaps |
| **Emergency Pause** | Instantly halt all transactions |
| **Interest-Free Mode** | Block lending/borrowing/margin automatically |

```bash
/policy status
/policy set maxTxSizeEth 0.05
/policy pause
/policy resume
```

```http
GET  /api/agents/:id/policy
POST /api/agents/:id/policy
POST /api/agents/:id/policy/pause
POST /api/agents/:id/policy/resume
```

---

### Real-Time Analytics

Live DeFi intelligence — no API key required:

```bash
arb analytics prices        # Real-time token prices (ETH, ARB, GMX, WBTC, LINK…)
arb analytics protocols     # Top Arbitrum protocols by TVL
arb analytics yields        # Best yield opportunities by APY
arb analytics gas           # Current transaction cost estimates
arb analytics whales        # Large transaction monitor
arb analytics simulate      # Backtest DCA, Grid, Momentum strategies
```

---

### Interest-Free Mode (Halal-Compliant)

For users who prefer to avoid interest-based transactions:

**Allowed:**
- Direct spot trading and token swaps
- Liquidity provision earning trading fees
- Governance staking rewards
- NFT trading and collecting

**Excluded by PolicyEngine:**
- Lending and borrowing (Aave, Radiant, Compound)
- Margin and leveraged trading (GMX perpetuals)
- Interest-bearing yield farming

```bash
arb agent create -n HalalYield -t defi --interest-free
```

---

## Quick Start

### Installation

```bash
npm install -g arbitrum-ai-agent-cli
arb info
```

### Create Your First Agent

```bash
# Trading agent
arb agent create -n AlphaTrader -t trading

# Halal-compliant DeFi agent
arb agent create -n HalalYield -t defi --interest-free

# Start chatting with your agent
arb chat
```

### Connect Wallet & Execute Real Swaps

```bash
arb chat
# In chat:
/connect <your-private-key>
/swap ETH USDC 0.01
/lifi quote ETH ARB 0.05
/intent swap 0.01 ETH for USDC
```

---

## Complete Command Reference

### Agent Management
```bash
arb agent create              # Create new agent (interactive)
arb agent create -n Bot -t trading --interest-free
arb agent list                # View all agents
arb agent select              # Set active agent
arb agent delete              # Remove an agent
```

### AI Chat + On-Chain Commands
```bash
arb chat                      # Start AI chat with active agent

# In chat mode:
/swap ETH USDC 0.01           # Execute swap via Uniswap V3
/intent swap 0.1 ETH for ARB  # Natural language → on-chain (Brian API)
/lifi quote ETH USDC 0.05     # Best price across all DEXs
/strategy add dca --token ARB # Add autonomous DCA strategy
/strategy list                # View active strategies
/policy status                # View safety policy
/policy set maxTxSizeEth 0.05 # Update spending limit
/policy pause                 # Emergency pause all txs
/portfolio                    # View live wallet balances
/autonomous start             # Start autonomous trading loop
```

### Analytics
```bash
arb analytics prices          # Live token prices
arb analytics protocols       # Top protocols by TVL
arb analytics yields          # Best yield opportunities
arb analytics gas             # Transaction cost estimator
arb analytics whales          # Large transaction monitor
arb analytics simulate        # Strategy backtesting
```

### Wallet Operations
```bash
arb wallet status             # Network connection status
arb wallet generate           # Create new Arbitrum wallet
arb wallet balance -a 0x...   # Check any address balance
arb wallet connect            # Connect wallet for transactions
```

### Smart Contract Deployment
```bash
arb onchain deploy            # Deploy contracts to Arbitrum
arb onchain status            # Check deployment status
arb onchain verify -a 0x...   # Verify contract on explorer
arb onchain interact          # Call contract functions
```

### Configuration & Export
```bash
arb config set                # Configure API keys
arb config show               # View current settings
arb export agents             # Export agents to JSON
arb export import -f file.json
```

---

## REST API

The REST API server exposes **50 endpoints** for full programmatic control.

```bash
npm run api
# Server at http://localhost:3000
```

### Endpoint Groups

| Group | Endpoints | Description |
|-------|-----------|-------------|
| **Agents** | `GET/POST/DELETE /api/agents` | Create, list, delete agents |
| **Chat** | `POST /api/chat` | AI conversation |
| **Analytics** | `GET /api/analytics/*` | Prices, protocols, yields, gas, whales |
| **On-Chain** | `POST /api/onchain/*` | Connect wallet, swap, transfer, portfolio |
| **Strategy** | `GET/POST/DELETE /api/agents/:id/strategies` | Autonomous strategies |
| **Policy** | `GET/POST /api/agents/:id/policy` | Safety policies |
| **Intent** | `POST /api/intent/build`, `POST /api/intent/execute` | Brian API NL→tx |
| **LiFi** | `GET /api/lifi-quote` | Multi-DEX best-price routing |
| **Autonomous** | `POST /api/agents/:id/autonomous/*` | Start/stop trading loops |
| **Deployment** | `POST /api/deploy` | On-chain contract deployment |

### Example Requests

```bash
# Create an agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Bot","type":"trading","network":"mainnet"}'

# Get LiFi quote
curl "http://localhost:3000/api/lifi-quote?tokenIn=ETH&tokenOut=USDC&amountIn=0.1"

# Build Brian API intent
curl -X POST http://localhost:3000/api/intent/build \
  -H "Content-Type: application/json" \
  -d '{"agentId":"...","prompt":"swap 0.05 ETH for ARB"}'

# Add a DCA strategy
curl -X POST http://localhost:3000/api/agents/:id/strategies \
  -H "Content-Type: application/json" \
  -d '{"type":"dca","token":"ARB","amountEth":0.01,"intervalMs":3600000}'

# Set policy limits
curl -X POST http://localhost:3000/api/agents/:id/policy \
  -H "Content-Type: application/json" \
  -d '{"maxTxSizeEth":0.05,"maxDailySpendEth":0.5}'
```

Full API docs: [docs/API.md](docs/API.md)

---

## SDK Usage

```javascript
import { agentService, analyticsService } from 'arbitrum-ai-agent-cli/services';
import { BrianAPI } from 'arbitrum-ai-agent-cli/blockchain';
import { StrategyEngine } from 'arbitrum-ai-agent-cli/agents';

// Create agent
const agent = agentService.createAgent('Bot', 'trading', 'mainnet');

// Live analytics (no API key)
const prices  = await analyticsService.getPrices();
const yields  = await analyticsService.getYields();

// Natural language → transaction
const brian = new BrianAPI({ apiKey: process.env.BRIAN_API_KEY });
const result = await brian.buildTransaction('swap 0.1 ETH for USDC', walletAddress);

// Autonomous strategy
const engine = new StrategyEngine(agent);
engine.addStrategy({ type: 'dca', token: 'ARB', amountEth: 0.01, intervalMs: 3600000 });
engine.start(60_000);
engine.on('strategy_triggered', ({ id, result }) => console.log('Strategy fired:', result));
```

Full SDK docs: [docs/SDK.md](docs/SDK.md)

---

## Multi-Environment Support

### Command Line (CLI)
```bash
npm install -g arbitrum-ai-agent-cli
arb agent create
arb chat
```

### REST API Server
```bash
npm run api
# Endpoints at http://localhost:3000/api
```

### Docker Container
```bash
docker-compose up -d
# Production-ready containerized deployment
```

### SDK/Library
```javascript
import { agentService } from 'arbitrum-ai-agent-cli/services';
```

---

## Supported Networks

| Network | Chain ID | Type | Use Case |
|---------|----------|------|----------|
| **Arbitrum One** | 42161 | Mainnet | Production deployments |
| **Arbitrum Sepolia** | 421614 | Testnet | Development and testing |
| **Arbitrum Nova** | 42170 | Mainnet | High-throughput applications |

Get testnet ETH: [faucet.arbitrum.io](https://faucet.arbitrum.io)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | GPT-4o for AI chat and decisions |
| `BRIAN_API_KEY` | Optional | Natural language → transaction calldata |
| `ANTHROPIC_API_KEY` | Optional | Claude as AI provider alternative |
| `GOOGLE_API_KEY` | Optional | Gemini as AI provider alternative |
| `PORT` | Optional | REST API port (default: 3000) |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                  Arbitrum AI Agent Platform                         │
├────────────────┬───────────────────┬───────────────────────────────┤
│   AI Providers │   Blockchain      │   Data Sources                │
│  ─────────────  │  ──────────────── │  ──────────────────────────── │
│  GPT-4o        │  Ethers.js        │  DefiLlama (prices/TVL/APY)  │
│  Claude        │  Uniswap V3       │  LiFi (multi-DEX routing)    │
│  Gemini        │  Arbitrum One/    │  CoinGecko (via Llama)       │
│                │  Nova / Sepolia   │  Arbiscan (explorer)         │
├────────────────┴───────────────────┴───────────────────────────────┤
│                         Agent Layer                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────────┐  │
│  │  BaseAgent   │  │  StrategyEngine │  │    PolicyEngine       │  │
│  │  + AI Chat   │  │  DCA · StopLoss │  │  Spending Limits      │  │
│  │  + Executor  │  │  TakeProfit     │  │  Token Whitelist      │  │
│  │  + BrianAPI  │  │  Rebalance      │  │  Emergency Pause      │  │
│  └──────────────┘  │  Price Alerts   │  │  Interest-Free Mode   │  │
│  Trading / DeFi /  └─────────────────┘  └───────────────────────┘  │
│  OnChain / NFT /                                                    │
│  Social / Custom                                                    │
├────────────────────────────────────────────────────────────────────┤
│                       Interface Layer                               │
│          CLI (arb)  ·  REST API (50 endpoints)  ·  SDK  ·  Docker  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Security

- **Private Keys Never Stored** — Wallet connections are session-only and cleared on exit
- **Local Data Storage** — All agent data stays on your machine in `~/.arb-agent/`
- **Pre-Flight Balance Checks** — Executor validates sufficient balance before every swap
- **Policy Engine Enforcement** — Spending limits checked before any transaction
- **API Key Protection** — Keys stored locally, transmitted only to their respective services
- **Testnet Default** — New agents default to Sepolia testnet for safe experimentation
- **Dry Run Default** — Autonomous loops default to `dryRun: true` (simulation)

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Command Reference](docs/COMMANDS.md) | Complete CLI command documentation |
| [REST API Guide](docs/API.md) | All 50 HTTP endpoints with examples |
| [SDK Documentation](docs/SDK.md) | Library usage for Node.js applications |
| [Deployment Guide](docs/DEPLOYMENT.md) | Docker, cloud, and serverless deployment |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Resources

- [Arbitrum Documentation](https://docs.arbitrum.io/)
- [Brian API Docs](https://docs.brianknows.org/)
- [LiFi Protocol](https://li.fi/)
- [OpenAI API](https://platform.openai.com/docs)
- [DefiLlama API](https://defillama.com/docs/api)
- [Ethers.js](https://docs.ethers.org/)

---

**Built with passion for the Arbitrum ecosystem**

*Empowering developers and traders with AI-powered blockchain automation*
