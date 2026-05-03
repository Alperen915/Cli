<div align="center">

# Arbitrum AI Agent Platform

**The most powerful AI-native autonomous agent platform for the Arbitrum ecosystem.**
Build, deploy, and orchestrate agents that think, trade, and act on-chain — powered by GPT-4o, Claude, and Gemini.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs)](https://nodejs.org/)
[![Arbitrum](https://img.shields.io/badge/Arbitrum-One%20%7C%20Nova%20%7C%20Sepolia-2D374B?logo=ethereum)](https://arbitrum.io/)
[![npm](https://img.shields.io/badge/npm-arbitrum--ai--agent--cli-CB3837?logo=npm)](https://www.npmjs.com/package/arbitrum-ai-agent-cli)
[![REST API](https://img.shields.io/badge/REST%20API-80%2B%20endpoints-orange)](#rest-api-reference)
[![Version](https://img.shields.io/badge/version-1.7.0-blue)](#changelog)

```
npm install -g arbitrum-ai-agent-cli
arb agent create
arb chat
```

</div>

---

## What Is This?

Arbitrum AI Agent Platform is a full-stack autonomous agent framework that runs on the Arbitrum L2 ecosystem. It combines a powerful CLI, a production-ready REST API, an SDK, and a Docker container into a unified system.

Agents in this platform are not chatbots — they are autonomous actors that:
- **Read** real-time market data (prices, TVL, yields, gas) from DefiLlama and on-chain
- **Reason** using GPT-4o, Claude Sonnet, or Gemini 2.0 Flash
- **Execute** real transactions on Arbitrum (swaps, bridges, transfers, deployments)
- **Guard** themselves with a policy engine that enforces spending limits and safety rules
- **Coordinate** with other agents in a fleet using consensus-based voting
- **Alert** you via Discord or Telegram when anything changes

Everything runs locally. No cloud dependencies. Your private keys never leave your machine.

---

## Feature Overview

| Capability | What It Does |
|---|---|
| **6 Agent Types** | Trading, DeFi, On-Chain, NFT, Social, Custom |
| **3 AI Providers** | OpenAI GPT-4o, Anthropic Claude, Google Gemini |
| **Real On-Chain Execution** | Live swaps, bridges, transfers — not simulations |
| **Natural Language → Tx** | Brian API converts plain English into verified calldata |
| **Multi-DEX Routing** | LiFi aggregator across Uniswap V3, Camelot, 1inch, Paraswap |
| **Strategy Engine** | DCA, stop-loss, take-profit, rebalance — runs autonomously |
| **Policy Engine** | Spending limits, token whitelist, emergency pause |
| **Interest-Free Mode** | Halal-compliant — no lending, borrowing, or margin |
| **Agent Tokenization** | Deploy ERC-20 tokens for any agent with revenue sharing |
| **Event Listening** | Real-time on-chain event monitoring (whale swaps, liquidations) |
| **Performance Dashboard** | P&L tracking, win rate, ROI, daily charts |
| **Multi-Agent Orchestration** | Fleet coordination with consensus voting |
| **Discord & Telegram** | Push notifications on any agent event |
| **Network Health Monitor** | Sequencer status, tx lifecycle, address inspection |
| **Custom RPC Support** | Alchemy, Infura, QuickNode — validated before saving |
| **80+ REST Endpoints** | Full programmatic control |

---

## Quick Start

### 1. Install

```bash
npm install -g arbitrum-ai-agent-cli
```

### 2. Set Your AI Key

```bash
arb config set
# Choose provider: OpenAI / Anthropic / Gemini
# Paste your API key
```

### 3. Create an Agent

```bash
# Interactive wizard
arb agent create

# Or direct flags
arb agent create -n AlphaTrader -t trading -N mainnet

# Halal-compliant (no lending/borrowing/margin)
arb agent create -n HalalYield -t defi --interest-free
```

### 4. Start Chatting

```bash
arb chat

# Inside chat — natural language + slash commands
You: What are the best yields on Arbitrum right now?
You: /swap ETH USDC 0.01
You: /strategy add dca --token ARB --amount 0.01 --interval 3600000
You: /intent swap 0.05 ETH for ARB
You: /autonomous start
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Arbitrum AI Agent Platform v1.7.0                      │
├──────────────────────┬───────────────────────┬──────────────────────────────┤
│    AI Providers      │   Blockchain Layer     │     Data Sources              │
│  ─────────────────── │  ──────────────────── │  ─────────────────────────── │
│  GPT-4o (OpenAI)     │  ethers.js             │  DefiLlama (prices/TVL/APY) │
│  Claude Sonnet       │  Arbitrum One  42161   │  LiFi (multi-DEX routing)   │
│  Gemini 2.0 Flash    │  Arbitrum Nova 42170   │  Brian API (NL→calldata)    │
│                      │  Arb Sepolia   421614  │  Arbiscan (explorer)        │
├──────────────────────┴───────────────────────┴──────────────────────────────┤
│                            Agent Layer                                        │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐   │
│  │   BaseAgent    │  │  StrategyEngine  │  │       PolicyEngine         │   │
│  │  • AI Chat     │  │  • DCA           │  │  • Max tx / hour / day     │   │
│  │  • BrianAPI    │  │  • Stop-Loss     │  │  • Token whitelist         │   │
│  │  • Executor    │  │  • Take-Profit   │  │  • Emergency pause         │   │
│  │  • Wallet      │  │  • Rebalance     │  │  • Interest-free mode      │   │
│  └────────────────┘  │  • Price Alerts  │  └────────────────────────────┘   │
│  Trading · DeFi ·    └──────────────────┘                                    │
│  OnChain · NFT ·                                                              │
│  Social · Custom                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                        Platform Services (v1.3 – v1.7)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  ERC-20      │  │  Event       │  │  Performance │  │  Multi-Agent   │   │
│  │  Tokenizer   │  │  Listener    │  │  Dashboard   │  │  Orchestrator  │   │
│  │  (v1.3)      │  │  (v1.4)      │  │  P&L / ROI   │  │  Fleet + Vote  │   │
│  └──────────────┘  └──────────────┘  │  (v1.5)      │  │  (v1.5)        │   │
│  ┌──────────────┐  ┌──────────────┐  └──────────────┘  └────────────────┘   │
│  │  Discord &   │  │  Network     │                                          │
│  │  Telegram    │  │  Monitor     │                                          │
│  │  (v1.6)      │  │  Sequencer + │                                          │
│  └──────────────┘  │  Tx Tracker  │                                          │
│                    │  (v1.7)      │                                          │
│                    └──────────────┘                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                         Interface Layer                                        │
│             CLI (arb)  ·  REST API (80+ endpoints)  ·  SDK  ·  Docker        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## CLI Command Reference

### Agent Management

```bash
arb agent create              # Interactive wizard (name, type, network, mode)
arb agent create -n Bot -t trading -N mainnet
arb agent create -n Halal -t defi --interest-free
arb agent list                # All agents with status
arb agent select              # Set active agent
arb agent delete              # Remove agent and its data
```

### AI Chat + On-Chain Execution

```bash
arb chat                      # Start AI chat with your active agent

# Swap tokens (live, on Arbitrum)
/swap ETH USDC 0.01

# Natural language → on-chain transaction (Brian API)
/intent swap 0.1 ETH for USDC
/intent bridge 50 USDC from Arbitrum to Optimism
/intent transfer 10 ARB to 0xabc...

# Best price routing (LiFi, no API key needed)
/lifi quote ETH ARB 0.05

# Portfolio
/portfolio                    # Live wallet balances + P&L

# Autonomous trading loop
/autonomous start             # AI starts making decisions every N seconds
/autonomous stop
```

### Strategy Engine

```bash
# Add autonomous strategies (run in the background)
/strategy add dca --token ARB --amount 0.01 --interval 3600000
/strategy add stop-loss --token ETH --price 1800 --amount 0.5
/strategy add take-profit --token ETH --price 3500 --amount 0.3
/strategy add rebalance --allocations ETH:50,ARB:30,USDC:20

arb analytics simulate        # Backtest strategies on historical data
/strategy list                # View all active strategies
/strategy remove <id>
```

### Policy Engine (Safety)

```bash
/policy status
/policy set maxTxSizeEth 0.05
/policy set maxDailySpendEth 0.5
/policy pause                 # Emergency stop — blocks all transactions
/policy resume
/policy set tokenWhitelist ETH,ARB,USDC
```

### Analytics & Market Data

```bash
arb analytics prices          # Real-time token prices (ETH, ARB, GMX, WBTC, LINK…)
arb analytics protocols       # Top Arbitrum protocols ranked by TVL
arb analytics yields          # Best APY opportunities (farming, staking, lending)
arb analytics gas             # Current gas cost estimates for common operations
arb analytics whales          # Large wallet movement tracker
arb analytics simulate        # Backtest DCA / Grid / Momentum strategies
```

### Network Health Monitor *(v1.7)*

```bash
arb network status            # Live health dashboard — all 3 networks, score bars
arb network sequencer         # Sequencer lag, TPS, block target time
arb network tx <hash>         # Tx lifecycle: L2 Pending → Confirmed → L1 Batched → Finalized
arb network address <addr>    # ETH balance, nonce, ARB/WETH/USDC/USDT token balances
arb network faucet            # 5 Sepolia faucet links for testnet ETH
arb network rpc set           # Set custom RPC (Alchemy / Infura / QuickNode)
arb network rpc list          # List configured custom endpoints
arb network rpc remove        # Revert to public endpoint
arb network rpc test          # Test any RPC URL without saving
```

**Live data from v1.7.0 E2E tests:**
```
Arbitrum One     ● healthy    [█████████░] 90/100  Block: #458M   TPS: ~15   L1 Base: 0.004 gwei
Arbitrum Sepolia ● healthy    [█████████░] 90/100  Block: #264M   TPS: ~10   L1 Base: 0.0000003 gwei
Arbitrum Nova    ◐ degraded   [███░░░░░░░] 30/100  Block: #84M    Lag: 155s
```

### Event Listening *(v1.4)*

```bash
arb events start              # Start on-chain event polling (default: 15s interval)
arb events stop
arb events status             # Running status, watcher count, last block
arb events watch              # Add watcher: large_transfer / whale_swap / liquidation / custom
arb events list               # All watchers for active agent
arb events remove <id>
arb events history            # Recently captured events
```

**Watcher types:**
- `large_transfer` — alert when >X ETH moves from a tracked token contract
- `whale_swap` — alert on large Uniswap V3 pool swaps (ETH/USDC, ETH/ARB…)
- `liquidation` — alert on Aave V3 liquidation events (mainnet)
- `custom` — any contract, any event, any threshold

### Performance Dashboard *(v1.5)*

```bash
arb perf show                 # Full P&L dashboard: win rate, ROI, open positions
arb perf history              # Trade log with realized P&L per entry
arb perf daily                # Daily P&L with ASCII bar chart
arb perf log                  # Manually log a trade entry
arb perf reset                # Clear the ledger
```

**Example output:**
```
alpha-trader — P&L Dashboard
────────────────────────────────────
  Total Trades:   5     Win Rate:  50%
  Invested:    $4,250   Realized:  +$225
  ROI:         +5.29%   Best:  ETH +$255

  Strategy Breakdown:
  take_profit   ████████  $255
  stop_loss     ███       -$30
  dca           ░░░░░░░░   $0 (open)
```

### Multi-Agent Orchestration *(v1.5)*

```bash
# Create a fleet of coordinated AI agents
arb fleet create              # Name, network, consensus threshold (e.g. 60%)
arb fleet add                 # Add sub-agent: master | analyst | executor | risk_manager | monitor
arb fleet status              # View all agents and their roles
arb fleet list                # All fleets

arb fleet ask                 # Send a goal to the full fleet (master coordinates)
arb fleet ask --role analyst  # Ask a specific role directly
arb fleet vote                # Submit a proposal for consensus vote
arb fleet history             # Inter-agent message log
arb fleet delete
```

**How it works:**
1. `master` decomposes the goal into sub-tasks
2. `analyst`, `executor`, `risk_manager`, `monitor` each respond from their role perspective
3. `vote` collects yes/no from all agents — approved only if threshold is met (default 60%)
4. All messages logged with full history

### Agent Tokenization *(v1.3)*

```bash
arb token create              # Deploy ERC-20 token for your active agent
arb token info                # On-chain token info (live)
arb token list                # All tokenized agents
arb token holders             # Token holder list and balances
arb token distribute          # Deposit ETH as revenue to all holders (EIP-2222)
arb token claim               # Claim your pending ETH revenue
arb token transfer            # Send tokens to another address
arb token precompile          # Pre-compile and cache AgentToken.sol
```

### Discord & Telegram Notifications *(v1.6)*

```bash
# Set up a notification channel
arb notify channel add        # Add Discord webhook OR Telegram bot (interactive)
arb notify channel list
arb notify channel test       # Send test notification to verify connection
arb notify channel remove

# Subscribe to events
arb notify subscribe          # Choose channel, agent, event types, min severity
arb notify subscriptions      # List active subscriptions

# Send and review
arb notify send               # Send a custom notification
arb notify history            # Notification send log
```

**Notification types:** `strategy_trigger` · `event_fired` · `pnl_update` · `price_alert` · `fleet_decision` · `whale_alert` · `custom`

**Severity → Discord embed color:**
- `info` → Blurple — strategy executed, P&L update
- `warning` → Yellow — price alert, whale activity
- `danger` → Red — liquidation, critical price drop
- `success` → Green — profitable trade, fleet approved

### Wallet & Smart Contracts

```bash
arb wallet status             # Network connection + block info
arb wallet generate           # Create a new Arbitrum wallet (address + key + mnemonic)
arb wallet balance -a 0x...   # Balance of any address on any network
arb wallet connect            # Connect wallet for live transactions

arb onchain deploy            # Deploy smart contracts to Arbitrum
arb onchain status            # Deployment status and tx hash
arb onchain verify -a 0x...   # Verify on Arbiscan
arb onchain interact          # Call any contract function
```

---

## REST API Reference

Start the API server:

```bash
npm run api
# Server: http://localhost:3000
# Health: GET /api/health
```

### Endpoint Groups (80+ total)

| Group | Base Path | Description |
|---|---|---|
| **Health** | `GET /api/health` | Server status and version |
| **Agents** | `/api/agents` | Create, list, select, delete |
| **Chat** | `POST /api/chat` | AI conversation |
| **Analytics** | `/api/analytics/*` | Prices, protocols, yields, gas, whales |
| **On-Chain** | `/api/onchain/*` | Wallet connect, swap, transfer, portfolio |
| **Strategy** | `/api/agents/:id/strategies` | CRUD autonomous strategies |
| **Policy** | `/api/agents/:id/policy` | Read and update safety policies |
| **Intent** | `/api/intent/*` | Brian API: build + execute NL transactions |
| **LiFi** | `GET /api/lifi-quote` | Multi-DEX best-price routing |
| **Autonomous** | `/api/agents/:id/autonomous/*` | Start/stop/status trading loops |
| **Deployment** | `POST /api/deploy` | Smart contract deployment |
| **Tokenization** | `/api/agents/:id/token*` | ERC-20 token lifecycle |
| **Events** | `/api/agents/:id/events*` | Watcher lifecycle + SSE stream |
| **Performance** | `/api/agents/:id/performance*` | P&L dashboard + history |
| **Fleets** | `/api/fleets*` | Multi-agent orchestration + SSE |
| **Notifications** | `/api/notifications/*` | Discord/Telegram channels + subscriptions |
| **Networks** | `/api/networks/*` | Health, sequencer, tx tracker, address |

### Network Monitor API *(v1.7)*

```bash
# All networks health (live RPC check)
GET /api/networks/health

# Single network
GET /api/networks/mainnet/health
→ { healthScore: 90, blockNumber: 458832452, gasPrice: "0.0200 gwei",
    blockAge: "1s ago", latencyMs: 472,
    arbitrum: { l1BaseFeeGwei: "0.004", gasBacklog: 90804295 } }

# Sequencer status
GET /api/networks/mainnet/sequencer
→ { status: "healthy", lagSeconds: 1, estimatedTps: 15, targetBlockTimeMs: 250 }

# Transaction lifecycle tracker
GET /api/networks/mainnet/tx/0xabc...
→ { status: "success", l2Stage: "finalized_l2",
    arbitrumLifecycle: { l2Confirmed: true, l2Safe: true, l1Batched: true },
    challengePeriodEnd: "2026-05-10T...", explorerUrl: "..." }

# Address inspector
GET /api/networks/mainnet/address/0xF3FC...
→ { ethBalance: "0.000000 ETH", nonce: 1, isContract: true,
    tokenBalances: { ARB: "2656858656.18", USDC: "148810.69" } }

# Custom RPC management
POST /api/networks/mainnet/rpc
  Body: { "rpcUrl": "https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY" }
  → Validates chain ID (42161) before saving

POST /api/networks/mainnet/rpc/test    # Test without saving
DELETE /api/networks/mainnet/rpc       # Revert to public endpoint

# Sepolia faucets
GET /api/networks/faucets
```

### Performance API *(v1.5)*

```bash
GET  /api/agents/:name/performance
→ { totalTrades: 5, winRate: 50, roi: 5.29, totalRealizedPnL: 225,
    bestTrade: { token: "ETH", pnl: 255 }, openPositions: [...],
    byStrategy: { take_profit: { pnl: 255 }, stop_loss: { pnl: -30 } } }

GET  /api/agents/:name/performance/history?limit=50
GET  /api/agents/:name/performance/daily?days=30
POST /api/agents/:name/performance/log   # Log a trade
DELETE /api/agents/:name/performance     # Reset ledger
```

### Fleet API *(v1.5)*

```bash
POST   /api/fleets                        # Create fleet
GET    /api/fleets                        # List fleets
GET    /api/fleets/:name                  # Fleet status + agents
DELETE /api/fleets/:name                  # Delete fleet
POST   /api/fleets/:name/agents           # Add agent to fleet
DELETE /api/fleets/:name/agents/:role     # Remove agent
POST   /api/fleets/:name/coordinate       # Full fleet coordination (AI)
POST   /api/fleets/:name/ask              # Ask specific role
POST   /api/fleets/:name/vote             # Consensus vote on proposal
GET    /api/fleets/:name/history          # Message history
GET    /api/fleets/:name/stream           # SSE live message stream
```

### Notification API *(v1.6)*

```bash
GET    /api/notifications/channels
POST   /api/notifications/channels
  Body: { "name": "my-discord", "type": "discord",
          "webhookUrl": "https://discord.com/api/webhooks/..." }
  Body: { "name": "my-telegram", "type": "telegram",
          "botToken": "...", "chatId": "-100..." }

DELETE /api/notifications/channels/:name
PATCH  /api/notifications/channels/:name   # { "enabled": false }
POST   /api/notifications/channels/:name/test

GET    /api/notifications/subscriptions
POST   /api/notifications/subscriptions
  Body: { "channelName": "my-discord", "agentName": "*",
          "eventTypes": ["strategy_trigger","pnl_update"],
          "minSeverity": "info" }
DELETE /api/notifications/subscriptions/:id

POST   /api/notifications/send
GET    /api/notifications/history
```

### Event API *(v1.4)*

```bash
POST /api/agents/:name/events/start       # { "intervalMs": 15000 }
POST /api/agents/:name/events/stop
GET  /api/agents/:name/events/status
GET  /api/agents/:name/events             # List watchers
POST /api/agents/:name/events/watch       # Add watcher
  Body: { "preset": "large_transfer", "token": "WETH", "threshold": 10 }
  Body: { "preset": "whale_swap", "pool": "ETH/USDC-0.05%" }
  Body: { "preset": "liquidation" }
DELETE /api/agents/:name/events/watch/:id
PATCH  /api/agents/:name/events/watch/:id  # Enable/disable
GET    /api/agents/:name/events/history
GET    /api/agents/:name/events/options    # Known pools + tokens
GET    /api/agents/:name/events/stream     # SSE live event stream
```

### Example Requests

```bash
# Check all 3 networks health (live RPC)
curl http://localhost:3000/api/networks/health | jq '.health[].healthScore'

# Inspect the Arbitrum Foundation treasury
curl http://localhost:3000/api/networks/mainnet/address/0xF3FC178157fb3c87548bAA86F9d24BA38E649B58
# → ARB: 2,656,858,656  USDC: 148,810

# Create a trading agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"AlphaTrader","type":"trading","network":"mainnet"}'

# Get best DEX price (no API key)
curl "http://localhost:3000/api/lifi-quote?tokenIn=ETH&tokenOut=USDC&amountIn=0.1"

# Build a Brian API intent
curl -X POST http://localhost:3000/api/intent/build \
  -H "Content-Type: application/json" \
  -d '{"agentId":"...","prompt":"swap 0.05 ETH for ARB on Arbitrum"}'

# Create a fleet and vote
curl -X POST http://localhost:3000/api/fleets \
  -H "Content-Type: application/json" \
  -d '{"name":"alpha-fleet","network":"mainnet","consensusThreshold":60}'

curl -X POST http://localhost:3000/api/fleets/alpha-fleet/vote \
  -H "Content-Type: application/json" \
  -d '{"proposal":{"action":"swap","token":"ETH","amountUSD":500}}'
```

---

## SDK Usage

```javascript
import { agentService }          from 'arbitrum-ai-agent-cli/services/agentService.js';
import { analyticsService }      from 'arbitrum-ai-agent-cli/services/analyticsService.js';
import { performanceService }    from 'arbitrum-ai-agent-cli/services/performanceService.js';
import { orchestrationService }  from 'arbitrum-ai-agent-cli/services/orchestrationService.js';
import { notificationService }   from 'arbitrum-ai-agent-cli/services/notificationService.js';
import { networkService }        from 'arbitrum-ai-agent-cli/services/networkService.js';
import { BrianAPI }              from 'arbitrum-ai-agent-cli/blockchain/brianAPI.js';

// ── Create and manage agents ─────────────────────────────────────────────────
const agent = agentService.createAgent('AlphaBot', 'trading', 'mainnet');
const list  = agentService.listAgents();

// ── Live market data (no API key) ────────────────────────────────────────────
const prices    = await analyticsService.getPrices();
const yields    = await analyticsService.getYields();
const protocols = await analyticsService.getProtocols();
const gas       = await analyticsService.getGasEstimates('mainnet');

// ── Natural language → transaction ──────────────────────────────────────────
const brian  = new BrianAPI({ apiKey: process.env.BRIAN_API_KEY });
const result = await brian.buildTransaction('swap 0.1 ETH for USDC', walletAddress);

// ── P&L tracking ─────────────────────────────────────────────────────────────
performanceService.logTrade('alpha-trader', {
  token: 'ETH', side: 'BUY',
  amountToken: 1.5, amountUSD: 3750,
  priceUSD: 2500, strategyType: 'dca'
});
const summary = performanceService.getSummary('alpha-trader');
// → { totalTrades, winRate, roi, totalRealizedPnL, bestTrade, openPositions, byStrategy }

// ── Multi-agent fleet ─────────────────────────────────────────────────────────
const fleet = await orchestrationService.createFleet('my-fleet', 'mainnet', 60);
await orchestrationService.addAgent('my-fleet', 'analyst', { model: 'gemini' });
const decision = await orchestrationService.coordinate('my-fleet', 'Should we buy ETH at $2500?');
const vote     = await orchestrationService.vote('my-fleet', { action: 'swap', token: 'ETH' });

// ── Discord/Telegram notifications ───────────────────────────────────────────
notificationService.addChannel({
  name: 'my-discord', type: 'discord',
  webhookUrl: 'https://discord.com/api/webhooks/...'
});
notificationService.subscribe({
  channelName: 'my-discord', agentName: '*',
  eventTypes: ['strategy_trigger', 'pnl_update'], minSeverity: 'info'
});
await notificationService.notifyPnLUpdate('alpha-trader', summary);

// ── Network monitoring ────────────────────────────────────────────────────────
const health    = await networkService.getAllHealth();
const sequencer = await networkService.getSequencerStatus('mainnet');
const txInfo    = await networkService.trackTransaction('0xabc...', 'mainnet');
const addrInfo  = await networkService.inspectAddress('0xF3FC...', 'mainnet');
// addrInfo.tokenBalances → { ARB: "2656858656.18", USDC: "148810.69" }

// Use Alchemy for faster, more reliable RPC
await networkService.setCustomRpc('mainnet', 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY');
```

---

## Supported Networks

| Network | Chain ID | Type | Block Time | Explorer |
|---|---|---|---|---|
| **Arbitrum One** | 42161 | Mainnet | ~0.25s | [arbiscan.io](https://arbiscan.io) |
| **Arbitrum Nova** | 42170 | Mainnet (AnyTrust) | ~0.25s | [nova.arbiscan.io](https://nova.arbiscan.io) |
| **Arbitrum Sepolia** | 421614 | Testnet | ~0.25s | [sepolia.arbiscan.io](https://sepolia.arbiscan.io) |

### Transaction Lifecycle on Arbitrum

Arbitrum is an Optimistic Rollup. A transaction goes through 5 stages:

```
[1] L2 Pending     — in mempool, awaiting mining
[2] L2 Confirmed   — mined on L2 (0.25s — instant)
[3] L2 Safe        — 10+ block confirmations
[4] L1 Batched     — included in an L1 Ethereum batch
[5] L1 Finalized   — 7-day challenge period expired (withdrawal ready)
```

Track any transaction through these stages with:
```bash
arb network tx 0xabc...
# or
GET /api/networks/mainnet/tx/0xabc...
```

### Testnet ETH (Sepolia Faucets)

| Faucet | Amount | Requirement |
|---|---|---|
| [faucet.arbitrum.io](https://faucet.arbitrum.io) | 0.001 ETH | Mainnet history |
| [sepoliafaucet.com](https://sepoliafaucet.com) | 0.5 ETH/day | Alchemy account |
| [faucet.quicknode.com](https://faucet.quicknode.com/arbitrum/sepolia) | 0.01 ETH | QuickNode account |
| [faucets.chain.link](https://faucets.chain.link/arbitrum-sepolia) | 0.1 ETH | Connect wallet |
| [bridge.arbitrum.io](https://bridge.arbitrum.io/?l2ChainId=421614) | Any | Bridge from Eth Sepolia |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | One of these three | GPT-4o — `sk-...` |
| `ANTHROPIC_API_KEY` | One of these three | Claude Sonnet — `sk-ant-...` |
| `GOOGLE_API_KEY` | One of these three | Gemini 2.0 Flash — `AIza...` |
| `BRIAN_API_KEY` | Optional | NL→calldata (get free at [brianknows.org](https://brianknows.org)) |
| `API_PORT` | Optional | REST API port (default: `3000`) |

At least one AI provider key is required. The platform auto-detects which provider to use based on which key is set (priority: Anthropic → Gemini → OpenAI).

---

## Multi-Environment Support

### CLI
```bash
npm install -g arbitrum-ai-agent-cli
arb agent create
arb chat
```

### REST API Server
```bash
npm run api
# Endpoints at http://localhost:3000/api
# Health: GET http://localhost:3000/api/health
```

### SDK / Library
```javascript
import { agentService } from 'arbitrum-ai-agent-cli/services/agentService.js';
```

### Docker
```bash
docker-compose up -d
# Production containerized deployment
```

---

## Security

| Principle | Implementation |
|---|---|
| **Private keys never stored** | Wallet connections are session-only, cleared on exit, never written to disk |
| **All data stays local** | Agent configs, P&L, events — everything in `~/.arb-agent/` on your machine |
| **Testnet by default** | New agents default to Arbitrum Sepolia for safe experimentation |
| **Dry run by default** | Autonomous loops start with `dryRun: true` — simulate before going live |
| **Pre-flight balance checks** | Executor validates sufficient balance + gas before every transaction |
| **Policy Engine** | Spending limits, token whitelist, and emergency pause enforced before any tx |
| **Chain ID validation** | Custom RPC endpoints are verified for correct chain ID before saving |
| **Rate limiting** | REST API has configurable per-IP rate limiting (helmet + express-rate-limit) |

---

## Project Structure

```
arbitrum-ai-agent-cli/
├── index.js                      # CLI entry point (arb command)
├── src/
│   ├── agents/
│   │   ├── baseAgent.js          # Core agent with AI + executor + strategies
│   │   ├── tradingAgent.js       # Trading-specific agent
│   │   ├── defiAgent.js
│   │   └── orchestrator.js       # Multi-agent fleet coordinator (v1.5)
│   ├── api/
│   │   └── server.js             # Express REST API (80+ endpoints)
│   ├── blockchain/
│   │   ├── wallet.js             # Arbitrum wallet management
│   │   ├── executor.js           # On-chain transaction executor
│   │   ├── brianAPI.js           # NL→calldata integration
│   │   ├── eventListener.js      # Block-polling event monitor (v1.4)
│   │   ├── networkMonitor.js     # L2 health + precompiles + tx tracker (v1.7)
│   │   ├── tokenizer.js          # ERC-20 agent token deployer (v1.3)
│   │   └── compiler.js           # solc Solidity compiler with cache
│   ├── commands/                 # CLI command handlers
│   │   ├── agent.js
│   │   ├── chat.js
│   │   ├── analytics.js
│   │   ├── network.js            # arb network * commands (v1.7)
│   │   ├── events.js             # arb events * commands (v1.4)
│   │   ├── performance.js        # arb perf * commands (v1.5)
│   │   ├── orchestrate.js        # arb fleet * commands (v1.5)
│   │   ├── notify.js             # arb notify * commands (v1.6)
│   │   └── token.js              # arb token * commands (v1.3)
│   ├── contracts/
│   │   └── AgentToken.sol        # ERC-20 + revenue sharing + governance
│   ├── services/                 # Business logic layer
│   │   ├── agentService.js
│   │   ├── analyticsService.js
│   │   ├── eventService.js       # Event watcher lifecycle (v1.4)
│   │   ├── performanceService.js # P&L + cost basis tracker (v1.5)
│   │   ├── orchestrationService.js # Fleet persistence (v1.5)
│   │   ├── notificationService.js  # Discord + Telegram (v1.6)
│   │   └── networkService.js     # Network health + RPC management (v1.7)
│   └── utils/
│       ├── config.js             # Network configs + provider settings
│       ├── logger.js
│       ├── display.js
│       ├── storage.js
│       └── validator.js
└── package.json
```

---

## Changelog

| Version | Highlights |
|---|---|
| **v1.7.0** | Arbitrum Network Health Monitor — sequencer status, ArbGasInfo precompile, tx lifecycle tracker, address inspector, custom RPC (Alchemy/Infura/QuickNode) |
| **v1.6.0** | Discord & Telegram notifications — channel management, subscription engine, 7 event types, severity filtering, rich embeds |
| **v1.5.0** | Multi-agent orchestration (fleet + consensus voting) + Performance Dashboard (P&L, ROI, win rate, daily charts) |
| **v1.4.0** | Blockchain Event Listening — real-time block polling, whale/liquidation watchers, SSE stream |
| **v1.3.0** | Agent Tokenization — ERC-20 deployment, revenue sharing (EIP-2222), governance voting |
| **v1.2.0** | Policy Engine + Strategy Engine (DCA, stop-loss, take-profit, rebalance) |
| **v1.1.0** | LiFi multi-DEX routing + Brian API NL→transaction |
| **v1.0.0** | Core platform: agents, AI chat, on-chain execution, analytics |

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Resources

| Resource | URL |
|---|---|
| Arbitrum Docs | [docs.arbitrum.io](https://docs.arbitrum.io) |
| Brian API | [docs.brianknows.org](https://docs.brianknows.org) |
| LiFi Protocol | [li.fi](https://li.fi) |
| DefiLlama API | [defillama.com/docs/api](https://defillama.com/docs/api) |
| ethers.js | [docs.ethers.org](https://docs.ethers.org) |
| OpenAI API | [platform.openai.com/docs](https://platform.openai.com/docs) |
| Alchemy (RPC) | [alchemy.com](https://www.alchemy.com) |
| Arbiscan | [arbiscan.io](https://arbiscan.io) |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for the Arbitrum ecosystem**

*AI-powered blockchain automation — from a single swap to a fleet of autonomous agents*

</div>
