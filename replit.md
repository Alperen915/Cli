# Arbitrum AI Agent Platform

## Overview
The Arbitrum AI Agent Platform is an AI-powered agent platform for the Arbitrum blockchain ecosystem, available as a CLI, REST API, SDK/library, and Docker container. It enables users to build autonomous trading bots, DeFi yield optimizers, NFT agents, and smart contract deployers. The platform supports major AI providers, offers real-time analytics from DefiLlama, includes an interest-free (halal-compliant) transaction mode, and provides enterprise-ready deployment options. The project aims to deliver a comprehensive and flexible toolset for automation and interaction within the Arbitrum ecosystem.

## User Preferences
Users can choose between two transaction modes when creating agents:
### Standard Mode (Default)
All DeFi features enabled:
- Lending and borrowing (Aave, Radiant, Compound)
- Margin and leveraged trading (GMX perpetuals)
- Interest-bearing yield farming
- Full protocol access

### Interest-Free Mode (Halal-Compliant)
For users who prefer to avoid interest-based transactions:
- Direct spot trading and swaps only
- Staking for governance (not interest)
- LP positions earning trading fees (not interest)
- NFT trading and collecting
- **Excludes**: Lending, borrowing, margin trading, leverage

## System Architecture
The platform is designed to support diverse AI agent types (trading, DeFi, on-chain, NFT, social, custom) by integrating with AI providers like OpenAI, Anthropic, and Google Gemini for intelligent decision-making. Agents can be deployed as smart contracts on Arbitrum One, Nova, and Sepolia.

Core architectural components include:
- **Agents**: A modular system with a `baseAgent` integrating AI, BrianAPI, StrategyEngine, and PolicyEngine.
- **Blockchain Integration**: Uses `ethers.js` for wallet operations and an `OnChainExecutor` for transactions, with `brianAPI` for natural language to calldata conversion.
- **On-Chain Execution**: Enables real transactions on Arbitrum, including token swaps and AI-guided trading.
- **StrategyEngine**: Implements trading strategies (DCA, stop-loss, take-profit, rebalance).
- **PolicyEngine**: Enforces safety defaults like spending limits, token whitelists, and transaction pauses.
- **Wallet Management**: Secure handling of Arbitrum wallets with no private key persistence.
- **Persistent Storage**: Agents and active selections are saved between sessions.
- **Deployment**: Supports on-chain deployment of agents as smart contracts.
- **User Interface**: Primarily a CLI with interactive chat, complemented by a REST API and SDK.
- **Multi-Agent Orchestration**: Allows coordination of agent fleets with a master coordinator and role-specific sub-agents, using a consensus-based decision-making process.
- **Agent Performance Dashboard**: Tracks P&L, ROI, and strategy breakdowns for individual agents, including FIFO average cost basis.
- **Blockchain Event Listening System**: Real-time on-chain event monitoring for agents, supporting various watcher types (large transfers, whale swaps, liquidations) with custom actions.
- **Agent Tokenization System**: Allows on-demand tokenization of AI agents as ERC-20 contracts, featuring on-chain metadata, revenue sharing, and governance capabilities.
- **Discord & Telegram Notifications**: Push notifications to Discord webhooks and Telegram bots. Channel management, subscription engine (per-agent, per-event-type, min-severity), 7 notification types.
- **Arbitrum Network Health Monitor**: Deep L2-specific monitoring — sequencer health, ArbGasInfo precompile data, transaction lifecycle (L2→L1 stages), address inspector, custom RPC support.

## v1.8.0 — New Features (latest)
- **`GET /api/analytics/whales`** — real on-chain large-transaction scanner
- **Agent Memory Persistence** — `storage.saveMemory` / `loadMemory` / `deleteMemory`, memory survives server restarts; `GET/DELETE /api/agents/:name/memory`
- **AI Streaming Chat** — `agent.thinkStream()` async generator, `GET /api/agents/:name/chat/stream` (SSE token-by-token)
- **Portfolio History** — `portfolioService.getFullPortfolioAndSave()` + `GET /api/agents/:name/portfolio/history`
- **Outbound Webhooks** — `src/services/webhookService.js`: add/remove/toggle/test, auto-retry (3 attempts), `GET/POST/DELETE/PATCH /api/webhooks`, `/api/webhooks/history`
- **Price Watch Service** — `src/services/priceWatchService.js`: background polling (configurable interval), conditions `above/below/change_pct`, auto-notifies Discord/Telegram + webhooks; `GET/POST/DELETE/PATCH /api/price-watches`
- **OpenAPI / Swagger UI** — `GET /api/docs` (Swagger UI) + `GET /api/docs/openapi.json` (37 paths, 3.0.3 spec)
- **GitHub Actions CI** — `.github/workflows/ci.yml`: Node 18+20 matrix, dry-run pack check
- **npm published**: `arbitrum-ai-agent-cli@1.8.0`

### New Files (v1.8.0)
- `src/services/webhookService.js` — outbound webhook delivery with retry
- `src/services/priceWatchService.js` — background price-alert polling
- `src/api/openapi.js` — OpenAPI 3.0.3 spec + Swagger HTML
- `.github/workflows/ci.yml` — CI pipeline

### Storage additions (v1.8.0)
- `~/.arb-agent/memory/<agent>.json` — persisted conversation memory
- `~/.arb-agent/portfolio_history/<agent>.json` — portfolio snapshots (max 365)
- `~/.arb-agent/webhooks.json` — outbound webhook registry
- `~/.arb-agent/webhook_history.json` — delivery log (last 200)
- `~/.arb-agent/price_watches.json` — price watch registry

## Arbitrum Network Health Monitor (v1.7.0)
Deep Arbitrum-specific network monitoring using L2 precompiles, sequencer health, transaction lifecycle tracking, and custom RPC management.

### Architecture
- **`src/blockchain/networkMonitor.js`** — core monitoring engine:
  - **`getNetworkHealth()`**: live health + `ArbGasInfo` precompile (gasBacklog, l1BaseFee, minGasPrice), health score 0–100
  - **`getSequencerStatus()`**: lag (seconds), estimated TPS, 250ms block target
  - **`getTransactionLifecycle()`**: 5-stage L2→L1 tracker (Pending → Confirmed → Safe → Batched → Finalized), 7-day challenge period
  - **`inspectAddress()`**: ETH balance, nonce, ERC-20 token balances (ARB/WETH/USDC/USDT/WBTC), contract vs EOA
  - **`testCustomRpc()`**: validates chain ID before saving
  - **`getSepoliaFaucets()`**: 5 faucet sources
- **`src/services/networkService.js`** — persistence to `~/.arb-agent/network_config.json`
- **`src/commands/network.js`** — CLI command group

### CLI Commands
```
arb network status              Live health dashboard with score bars + L1 base fee
arb network sequencer           Sequencer lag, TPS, block time
arb network tx [hash]           Tx lifecycle: L2→L1 stages + challenge period end
arb network txhistory           Recently tracked transactions
arb network address [addr]      ETH + token balances (ARB, WETH, USDC…)
arb network faucet              Sepolia faucet links (5 sources)
arb network rpc set/list/remove/test   Custom RPC management (Alchemy/Infura/QuickNode)
```

### REST API (v1.7.0)
- `GET  /api/networks` — list with chain IDs
- `GET  /api/networks/health` — all networks live health
- `GET  /api/networks/:n/health` — single network
- `GET  /api/networks/:n/sequencer` — sequencer status + TPS
- `GET  /api/networks/:n/tx/:hash` — tx lifecycle tracker
- `GET  /api/networks/:n/address/:addr` — address inspector
- `GET  /api/networks/faucets` — Sepolia faucet list
- `GET/POST/DELETE /api/networks/:n/rpc` — custom RPC management
- `POST /api/networks/:n/rpc/test` — test RPC without saving
- `GET  /api/networks/tx/history` — tracked tx history

## Discord & Telegram Notification System (v1.6.0)
Real-time push notifications to Discord webhooks and Telegram bots.

### Architecture
- **`src/services/notificationService.js`** — plain `fetch`, no extra library:
  - Discord rich embeds (color-coded severity, fields, footer) + Telegram HTML messages
  - Channel management: add/remove/toggle/list/test
  - Subscription engine: per-agent, per-event-type, min-severity filtering
  - 7 types: `strategy_trigger`, `event_fired`, `pnl_update`, `price_alert`, `fleet_decision`, `whale_alert`, `custom`
  - Convenience senders: `notifyStrategyTrigger`, `notifyEventFired`, `notifyPnLUpdate`, `notifyPriceAlert`, `notifyFleetDecision`, `notifyWhaleAlert`
  - History to `~/.arb-agent/notifications.json` (last 200)
- **`src/commands/notify.js`** — CLI command group

### CLI Commands
```
arb notify channel add/list/remove/test
arb notify subscribe / subscriptions
arb notify send / history
```

### REST API (v1.6.0)
- `GET/POST /api/notifications/channels` — channel management
- `DELETE/PATCH /api/notifications/channels/:name`
- `POST /api/notifications/channels/:name/test`
- `GET/POST /api/notifications/subscriptions`
- `DELETE /api/notifications/subscriptions/:id`
- `POST /api/notifications/send`
- `GET  /api/notifications/history`

## Multi-Agent Orchestration (v1.5.0)
Coordinate fleets of specialized AI agents with consensus-based decision making.

### Architecture
- **`src/agents/orchestrator.js`** — `AgentOrchestrator` (EventEmitter): 5 roles (master/analyst/executor/risk_manager/monitor), `coordinate()`, `vote()`, inter-agent history (200 msgs), SSE streaming
- **`src/services/orchestrationService.js`** — fleet lifecycle, persistence to `~/.arb-agent/fleets/<name>.json`
- **`src/commands/orchestrate.js`** — CLI: `arb fleet create/list/status/add/remove/ask/vote/history/delete`

### REST API (v1.5.0)
`POST/GET/DELETE /api/fleets` — `POST /api/fleets/:name/agents` — `POST /api/fleets/:name/coordinate|ask|vote` — `GET /api/fleets/:name/history|stream`

## Agent Performance Dashboard (v1.5.0)
Per-agent P&L tracking with FIFO average cost basis.

### Architecture
- **`src/services/performanceService.js`** — `CostBasisTracker`: `logTrade`, `getSummary` (winRate/ROI/bestTrade/worstTrade/openPositions/byStrategy), `getDailyPnL`, `getHistory`. Persistence: `~/.arb-agent/performance/<agent>.json`
- **`src/commands/performance.js`** — CLI: `arb perf show/history/daily/log/reset`

### REST API (v1.5.0)
`GET/DELETE /api/agents/:name/performance` — `/history` — `/daily` — `POST /log`

## Blockchain Event Listening System (v1.4.0)
Real-time on-chain event monitoring using ethers.js block-polling.

### Architecture
- **`src/blockchain/eventListener.js`** — `EventListener` (EventEmitter): polling `provider.getLogs()` every N seconds, 4 watcher types (`large_transfer`, `whale_swap`, `liquidation`, `custom`), 500-event buffer
- **`src/services/eventService.js`** — per-agent lifecycle, persistence to `~/.arb-agent/events/<agent>.json`
- **`src/commands/events.js`** — CLI: `arb events start/stop/status/watch/list/remove/history`

### REST API (v1.4.0)
`POST/GET /api/agents/:name/events` — `/start` `/stop` `/status` `/watch` `/history` `/stream` (SSE)

## Agent Tokenization System (v1.3.0)
ERC-20 tokenization of AI agents on Arbitrum.

### Architecture
- **`src/contracts/AgentToken.sol`** — ERC-20 + on-chain metadata + EIP-2222 revenue sharing + governance voting
- **`src/blockchain/compiler.js`** — solc compilation with disk cache
- **`src/blockchain/tokenizer.js`** — `AgentTokenizer`: deploy, info, holders, revenue, transfer
- **`src/services/tokenService.js`** — high-level wrapper, registry at `~/.arb-agent/token_registry.json`
- **`src/commands/token.js`** — CLI: `arb token create/info/list/holders/distribute/claim/transfer/precompile`

### REST API (v1.3.0)
`POST /api/agents/:name/tokenize` — `GET /api/agents/:name/token` — `/holders` — `/holder/:addr` — `POST /distribute|claim|transfer|ownership` — `GET /api/tokens`

## External Dependencies
- **AI Providers**: OpenAI (GPT-4o), Anthropic (Claude), Google Gemini
- **Blockchain Framework**: `ethers.js`
- **Analytics**: DefiLlama
- **On-Chain Execution Helpers**: BrianAPI, LiFiRouter
- **Solidity Compiler**: `solc` (npm package)
- **Deployment Tools**: Hardhat/Foundry/Remix
- **Notifications**: Discord Webhook API, Telegram Bot API (plain fetch, no library)