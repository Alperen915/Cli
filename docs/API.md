# Arbitrum AI Agent Platform - REST API

**Integrate powerful AI agents into any application with our production-ready REST API.**

The API provides full access to agent management, AI chat capabilities, and real-time DeFi analytics - perfect for web applications, mobile apps, trading bots, and microservices.

---

## Getting Started

### Start the API Server

```bash
# Using npm script
npm run api

# Direct execution
node src/api/server.js

# Custom port configuration
API_PORT=8080 node src/api/server.js
```

### Docker Deployment

```bash
# Build and run
docker build -t arbitrum-agent-api .
docker run -p 3000:3000 -e OPENAI_API_KEY=your_key arbitrum-agent-api

# Or use Docker Compose for production
docker-compose up -d
```

The API server starts at `http://localhost:3000` with all endpoints available under `/api`.

---

## API Endpoints

### Health & Status

#### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "platform": "Arbitrum AI Agent Platform",
  "version": "1.0.0"
}
```

Use this endpoint for load balancer health checks and monitoring.

---

### Agent Management

#### List All Agents
```http
GET /api/agents
```

Returns all configured agents with their current status and capabilities.

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "name": "AlphaTrader",
      "type": "trading",
      "network": "mainnet",
      "interestFreeMode": false,
      "capabilities": ["swap", "liquidity", "arbitrage", "portfolio"],
      "created": "2025-01-01T00:00:00.000Z",
      "isDeployed": false,
      "hasOpenAI": true
    }
  ]
}
```

#### Create Agent
```http
POST /api/agents
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "YieldOptimizer",
  "type": "defi",
  "network": "mainnet",
  "interestFreeMode": true
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the agent |
| `type` | string | Yes | Agent type: `trading`, `defi`, `onchain`, `nft`, `social`, `custom` |
| `network` | string | No | Target network: `mainnet`, `sepolia`, `nova` (default: `sepolia`) |
| `interestFreeMode` | boolean | No | Enable halal-compliant mode (default: `false`) |

**Response:**
```json
{
  "success": true,
  "agent": {
    "name": "YieldOptimizer",
    "type": "defi",
    "network": "mainnet",
    "interestFreeMode": true,
    "capabilities": ["stake", "lend", "farm", "compound"]
  }
}
```

#### Get Agent Details
```http
GET /api/agents/:name
```

#### Delete Agent
```http
DELETE /api/agents/:name
```

#### Activate Agent
```http
POST /api/agents/:name/activate
```

---

### AI Chat

#### Chat with Agent
```http
POST /api/agents/:name/chat
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "What are the best yield farming opportunities on Arbitrum right now?"
}
```

**Response:**
```json
{
  "success": true,
  "agent": "YieldOptimizer",
  "message": "What are the best yield farming opportunities on Arbitrum right now?",
  "response": {
    "thought": "Analyzing current yield opportunities across Arbitrum protocols...",
    "action": "yield_analysis",
    "protocols": ["Camelot", "GMX", "Radiant", "Pendle"],
    "recommendations": [
      "WETH-USDC LP on Camelot offering 45% APY",
      "GLP staking on GMX with 25% real yield"
    ]
  }
}
```

The AI analyzes your query and returns actionable insights powered by GPT-4o.

---

### Real-Time Analytics

Access live DeFi data without any API key requirements.

#### Live Token Prices
```http
GET /api/analytics/prices
```

**Response:**
```json
{
  "success": true,
  "prices": [
    { "symbol": "ETH", "price": 2500.00, "change24h": 2.5 },
    { "symbol": "ARB", "price": 1.25, "change24h": -1.2 },
    { "symbol": "GMX", "price": 45.00, "change24h": 5.8 }
  ],
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

#### Top Protocols by TVL
```http
GET /api/analytics/protocols?limit=15
```

Returns Arbitrum protocols ranked by Total Value Locked.

#### Best Yield Opportunities
```http
GET /api/analytics/yields?limit=20
```

Discover the highest APY pools across all Arbitrum DeFi protocols.

#### Gas Cost Estimator
```http
GET /api/analytics/gas?network=mainnet
```

**Response:**
```json
{
  "success": true,
  "network": "mainnet",
  "gasPrice": "0.1000",
  "maxFee": "0.2000",
  "priorityFee": "0.0000",
  "ethPrice": 2500.00,
  "estimates": {
    "ethTransfer": "$0.0053",
    "tokenTransfer": "$0.0163",
    "swap": "$0.0375",
    "addLiquidity": "$0.0625",
    "deployContract": "$0.1250"
  },
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

---

### Network Information

#### List Available Networks
```http
GET /api/networks
```

**Response:**
```json
{
  "success": true,
  "networks": [
    {
      "id": "mainnet",
      "name": "Arbitrum One",
      "chainId": 42161,
      "rpcUrl": "https://arb1.arbitrum.io/rpc",
      "explorer": "https://arbiscan.io"
    },
    {
      "id": "sepolia",
      "name": "Arbitrum Sepolia",
      "chainId": 421614,
      "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
      "explorer": "https://sepolia.arbiscan.io"
    }
  ]
}
```

#### Get Network Details
```http
GET /api/networks/:network
```

Returns live network statistics including current block and gas prices.

---

## Error Handling

All errors follow a consistent format for easy handling:

```json
{
  "success": false,
  "error": "Agent 'NonExistent' not found"
}
```

| Status Code | Meaning |
|-------------|---------|
| `200` | Success |
| `201` | Resource created |
| `400` | Invalid request parameters |
| `404` | Resource not found |
| `500` | Server error |

---

## Production Configuration

### Authentication

For production deployments, implement API key authentication:

```javascript
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// Apply to protected routes
app.use('/api/agents', authenticate);
```

### Rate Limiting

Protect your API with rate limiting:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
});

app.use('/api', limiter);
```

### CORS Configuration

Configure allowed origins for production:

```javascript
import cors from 'cors';

app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
```

---

## Brian API — Natural Language Intents

Convert plain English instructions into real on-chain transaction calldata using the [Brian API](https://docs.brianknows.org).

**Header:** `x-brian-api-key: YOUR_BRIAN_API_KEY` (or set `BRIAN_API_KEY` env var)

#### Build transaction calldata from natural language
```http
POST /api/agents/:name/intent/build
```
```json
{ "prompt": "Swap 0.01 ETH to USDC on Arbitrum" }
```
Returns ready-to-sign transaction calldata (does not execute).

#### Execute intent (build + sign + broadcast)
```http
POST /api/agents/:name/intent/execute
```
Requires wallet attached. Supports: swap, bridge, transfer, deposit/withdraw (Aave), borrow/repay.

**Example prompts:**
- `"Swap 0.01 ETH to USDC"`
- `"Bridge 10 USDC from Arbitrum to Base"`
- `"Deposit 100 USDC into Aave"`
- `"Swap 50% of my ETH to USDC"`
- `"Transfer 1 USDC to 0xabc..."`

#### LiFi Multi-DEX Quote (free, no auth)
```http
GET /api/agents/:name/lifi-quote?fromToken=ETH&toToken=USDC&fromAmount=10000000000000000
```
Best routing across LiFi, Enso, Paraswap, 1inch, and more.

---

## Strategy Engine

Autonomous rule-based execution: DCA, stop-loss, take-profit, price alerts, portfolio rebalancing.

#### List strategies
```http
GET /api/agents/:name/strategies
```

#### Add custom strategy
```http
POST /api/agents/:name/strategies
```
```json
{
  "name": "My Strategy",
  "type": "dca",
  "trigger": { "type": "schedule", "intervalMs": 86400000 },
  "action": { "type": "swap", "tokenIn": "USDC", "tokenOut": "ETH", "amount": "10" },
  "dryRun": true
}
```

#### Add DCA strategy
```http
POST /api/agents/:name/strategies/dca
```
```json
{ "token": "ETH", "quoteToken": "USDC", "amount": "10", "intervalHours": 24, "dryRun": true }
```

#### Add Stop-Loss
```http
POST /api/agents/:name/strategies/stop-loss
```
```json
{ "token": "ETH", "lossPercent": 10, "currentPrice": 3500, "dryRun": true }
```
Sells 100% of ETH if price drops 10% from `currentPrice`.

#### Add Take-Profit
```http
POST /api/agents/:name/strategies/take-profit
```
```json
{ "token": "ETH", "profitPercent": 20, "amountPct": 50, "currentPrice": 3500, "dryRun": true }
```

#### Add Price Alert
```http
POST /api/agents/:name/strategies/price-alert
```
```json
{ "token": "ETH", "condition": "above", "targetPrice": 4000 }
```

#### Add Portfolio Rebalance
```http
POST /api/agents/:name/strategies/rebalance
```
```json
{ "targets": { "ETH": 50, "USDC": 30, "ARB": 20 }, "intervalHours": 168 }
```

#### Delete strategy
```http
DELETE /api/agents/:name/strategies/:id
```

#### Start strategy engine (automatic polling)
```http
POST /api/agents/:name/strategies/engine/start
```
```json
{ "intervalMs": 60000 }
```

#### Stop strategy engine
```http
POST /api/agents/:name/strategies/engine/stop
```

#### Run strategy check immediately
```http
POST /api/agents/:name/strategies/run
```
Fetches current prices and evaluates all conditions immediately.

---

## Policy Engine

Configure spending limits and safety guardrails per agent. Inspired by Coinbase AgentKit's policy system.

#### Get policy
```http
GET /api/agents/:name/policy
```
```json
{
  "maxTxSizeEth": 0.1,
  "maxDailySpendEth": 1.0,
  "maxHourlySpendEth": 0.25,
  "maxSlippageBps": 100,
  "allowedTokens": null,
  "interestFreeMode": false,
  "paused": false,
  "hourlySpent": "0.0000",
  "dailySpent": "0.0000",
  "txCount24h": 0
}
```

#### Update policy
```http
PATCH /api/agents/:name/policy
```
```json
{
  "maxTxSizeEth": 0.05,
  "maxDailySpendEth": 0.5,
  "allowedTokens": ["ETH", "USDC", "ARB"],
  "interestFreeMode": true
}
```

#### Emergency pause (block all transactions)
```http
POST /api/agents/:name/policy/pause
```

#### Resume transactions
```http
POST /api/agents/:name/policy/resume
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | Server listening port | `3000` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | - |
| `NODE_ENV` | Environment mode | `development` |
| `API_KEY` | Your API authentication key | - |

---

## Integration Examples

### JavaScript/Fetch
```javascript
// Create an agent
const response = await fetch('http://localhost:3000/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'MyBot',
    type: 'trading',
    network: 'mainnet'
  })
});
const data = await response.json();
```

### Python/Requests
```python
import requests

# Get live prices
response = requests.get('http://localhost:3000/api/analytics/prices')
prices = response.json()['prices']

for token in prices:
    print(f"{token['symbol']}: ${token['price']:.2f}")
```

### cURL
```bash
# Chat with an agent
curl -X POST http://localhost:3000/api/agents/AlphaTrader/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze ETH trading opportunities"}'
```

---

**Ready to integrate? Start the API server and build powerful DeFi applications.**
