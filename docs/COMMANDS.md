# Arbitrum AI Agent Platform - Command Reference

**Complete documentation for all CLI commands.**

Master every feature of the platform with this comprehensive command guide. From creating your first agent to deploying smart contracts on Arbitrum mainnet.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Agent Commands](#agent-commands)
- [Analytics Commands](#analytics-commands)
- [Chat Commands](#chat-commands)
- [Wallet Commands](#wallet-commands)
- [Network Commands](#network-commands)
- [On-Chain Commands](#on-chain-commands)
- [Config Commands](#config-commands)
- [Export Commands](#export-commands)

---

## Quick Start

Get up and running in under 60 seconds:

```bash
# Step 1: Install the platform
npm install -g arbitrum-ai-agent-cli

# Step 2: View platform information
arb info

# Step 3: Create your first agent
arb agent create -n MyAgent -t trading

# Step 4: Start chatting
arb chat

# Step 5: Explore live DeFi analytics
arb analytics prices
arb analytics yields
```

---

## Agent Commands

### `arb agent create`

Create a new AI-powered agent with customizable capabilities.

```bash
arb agent create [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Agent name (unique identifier) | Interactive |
| `-t, --type <type>` | Agent specialization | Interactive |
| `--network <network>` | Target network | `sepolia` |
| `--interest-free` | Enable halal-compliant mode | `false` |

**Agent Types:**

| Type | Specialization | Capabilities |
|------|----------------|--------------|
| `trading` | DeFi Trading | Swaps, arbitrage, perpetuals, portfolio management |
| `defi` | Yield Optimization | Staking, lending, farming, auto-compounding |
| `onchain` | Smart Contracts | Deploy, verify, interact with contracts |
| `nft` | NFT Operations | Mint, trade, analyze collections |
| `social` | Community Intel | Alpha tracking, sentiment, signals |
| `custom` | Fully Customizable | Define your own capabilities |

**Examples:**

```bash
# Interactive creation wizard
arb agent create

# Quick creation with flags
arb agent create -n AlphaTrader -t trading --network mainnet

# Create halal-compliant DeFi agent
arb agent create -n HalalYield -t defi --interest-free

# Create on-chain deployment agent for testing
arb agent create -n ContractBot -t onchain --network sepolia
```

### Transaction Modes

Choose between two operating modes when creating agents:

**Standard Mode (Default)**
Full access to all DeFi capabilities including lending, borrowing, margin trading, and leveraged positions.

**Interest-Free Mode (Halal-Compliant)**
For users who prefer to avoid interest-based transactions:
- Direct spot trading and token swaps
- Liquidity provision earning trading fees
- Governance staking rewards
- NFT trading and collecting
- **Excludes:** Lending, borrowing, margin, leverage

When interest-based features are requested, the agent intelligently suggests halal-compliant alternatives.

---

### `arb agent list`

View all your agents with their current status.

```bash
arb agent list
```

**Output includes:**
- Agent name and type
- Target network
- Transaction mode (Standard/Interest-Free)
- AI status (active or limited)
- Deployment status (for on-chain agents)

---

### `arb agent select`

Set an agent as active for chat and operations.

```bash
arb agent select [name]
```

Your selection persists between CLI sessions.

---

### `arb agent delete`

Remove an agent with confirmation prompt.

```bash
arb agent delete [name]
```

---

## Analytics Commands

Access real-time DeFi intelligence without any API key.

### `arb analytics prices`

Get live token prices from DefiLlama.

```bash
arb analytics prices
```

**Supported tokens:** ETH, ARB, GMX, USDC, USDT, WBTC, LINK, UNI, RDNT, MAGIC, GRAIL, PENDLE, GNS, SUSHI

---

### `arb analytics protocols`

View top Arbitrum protocols ranked by Total Value Locked.

```bash
arb analytics protocols
```

---

### `arb analytics yields`

Discover the best yield farming opportunities across all protocols.

```bash
arb analytics yields
```

---

### `arb analytics gas`

Estimate transaction costs before executing.

```bash
arb analytics gas [--network <network>]
```

**Shows costs for:**
- ETH transfers
- Token transfers
- Swaps
- Adding liquidity
- Contract deployment

---

### `arb analytics portfolio`

Track any wallet's holdings and performance.

```bash
arb analytics portfolio -a <address>
```

---

### `arb analytics whales`

Monitor large transactions on Arbitrum.

```bash
arb analytics whales
```

---

### `arb analytics alerts`

Set up price alerts for tokens.

```bash
arb analytics alerts
```

---

### `arb analytics simulate`

Backtest trading strategies with historical data.

```bash
arb analytics simulate
```

**Available strategies:**
- Dollar Cost Averaging (DCA)
- Grid Trading
- Momentum
- Mean Reversion

---

## Chat Commands

### `arb chat`

Start an interactive conversation with your active agent.

```bash
arb chat
```

**Requirements:** An active agent must be selected.

**In-Chat Commands:**

| Command | Action |
|---------|--------|
| `/clear` | Reset agent memory |
| `/info` | Display agent details |
| `/help` | Show available commands |
| `exit` | End chat session |

**AI-Powered Features (with OpenAI API key):**
- Intelligent market analysis
- Strategy recommendations
- Risk assessments
- Protocol-specific guidance
- Real-time opportunity identification

---

## Wallet Commands

### `arb wallet status`

Check network connection and current status.

```bash
arb wallet status [--network <network>]
```

---

### `arb wallet generate`

Create a new Arbitrum wallet with secure key generation.

```bash
arb wallet generate
```

**Important:** Your private key is displayed only once. Store it securely!

---

### `arb wallet balance`

Check ETH balance for any address.

```bash
arb wallet balance -a <address> [--network <network>]
```

---

### `arb wallet connect`

Connect your wallet for the current session.

```bash
arb wallet connect [--network <network>]
```

**Security:** Private keys are never stored on disk. Connection expires when CLI exits.

---

## Network Commands

### `arb network list`

View all Arbitrum networks with live status.

```bash
arb network list
```

**Shows:**
- Network name and Chain ID
- Current block number
- RPC connection status

---

### `arb network info`

Get detailed information about a specific network.

```bash
arb network info [--network <network>]
```

**Shows:**
- Gas prices (base, max, priority)
- Block explorer links
- Network specifications

---

## On-Chain Commands

Deploy and interact with smart contracts on Arbitrum.

### `arb onchain deploy`

Deploy a smart contract to Arbitrum.

```bash
arb onchain deploy
```

**Requirements:**
- Active on-chain agent
- Connected wallet with ETH for gas
- Compiled contract bytecode

**Deployment Steps:**
1. Compile your Solidity contract (Hardhat/Foundry/Remix)
2. Run `arb onchain deploy`
3. Paste bytecode when prompted
4. Confirm transaction
5. Receive contract address

---

### `arb onchain status`

Check deployment status for the active agent.

```bash
arb onchain status
```

**Shows:**
- Deployment status
- Contract address
- Transaction hash
- Verification status

---

### `arb onchain verify`

Verify a contract exists at an address.

```bash
arb onchain verify -a <address>
```

---

### `arb onchain interact`

Interact with deployed contracts.

```bash
arb onchain interact
```

---

## Config Commands

### `arb config set`

Configure your OpenAI API key for AI-powered features.

```bash
arb config set
```

**Features:**
- Interactive API key entry
- Key validation before saving
- Local storage in `.env`
- Never transmitted except to OpenAI

---

### `arb config show`

Display current configuration status.

```bash
arb config show
```

---

## Export Commands

### `arb export agents`

Export agents to JSON for backup or transfer.

```bash
arb export agents [-o <file>] [--all]
```

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output filename |
| `-a, --all` | Export all without prompting |

---

### `arb export import`

Import agents from JSON file.

```bash
arb export import -f <file>
```

---

### `arb export config`

Export configuration settings.

```bash
arb export config [-o <file>]
```

---

## Complete Workflow Examples

### Trading Agent Workflow

```bash
# 1. Create trading agent
arb agent create -n AlphaTrader -t trading --network mainnet

# 2. Configure AI (optional but recommended)
arb config set

# 3. Check market conditions
arb analytics prices
arb analytics yields

# 4. Chat with your agent
arb chat
# Ask: "What are the best arbitrage opportunities right now?"
```

### Smart Contract Deployment Workflow

```bash
# 1. Create on-chain agent
arb agent create -n Deployer -t onchain --network sepolia

# 2. Check network status
arb network info --network sepolia

# 3. Connect wallet
arb wallet connect

# 4. Deploy contract
arb onchain deploy

# 5. Verify deployment
arb onchain status
arb onchain verify -a <contract-address>
```

### Interest-Free DeFi Workflow

```bash
# 1. Create halal-compliant agent
arb agent create -n HalalYield -t defi --interest-free

# 2. Explore opportunities
arb analytics yields

# 3. Get halal-compliant recommendations
arb chat
# Ask: "What are the best ways to earn yield without interest?"
# Agent suggests: LP fees, staking rewards, NFT trading
```

---

## Data Storage

All data stored locally for privacy:

```
~/.arb-agent/
├── agents.json          # Agent configurations
└── active_agent.json    # Current selection
```

**Never stored:**
- Private keys (session-only)
- Conversation history (memory-only)

---

## Supported Networks

| Network | Chain ID | Type | RPC Endpoint |
|---------|----------|------|--------------|
| Arbitrum One | 42161 | Mainnet | `arb1.arbitrum.io/rpc` |
| Arbitrum Sepolia | 421614 | Testnet | `sepolia-rollup.arbitrum.io/rpc` |
| Arbitrum Nova | 42170 | Mainnet | `nova.arbitrum.io/rpc` |

**Get testnet ETH:** [faucet.arbitrum.io](https://faucet.arbitrum.io)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No active agent" | Run `arb agent select` |
| "AI features limited" | Run `arb config set` to add API key |
| "Wallet not connected" | Run `arb wallet connect` |
| "Insufficient funds" | Get ETH from [faucet.arbitrum.io](https://faucet.arbitrum.io) |
| "Network issues" | Check status with `arb network list` |

---

**Master these commands and unlock the full power of AI-driven blockchain automation.**
