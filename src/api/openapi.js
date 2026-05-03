export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Arbitrum AI Agent Platform API',
    version: '1.8.0',
    description: 'REST API for the Arbitrum AI Agent Platform — build autonomous trading bots, DeFi agents, and smart contract deployers.',
    contact: { url: 'https://github.com/Alperen915/Cli' },
    license: { name: 'MIT' }
  },
  servers: [
    { url: '/api', description: 'This server' }
  ],
  security: [{ BearerAuth: [] }, {}],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', description: 'Optional API_SECRET header' }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error:   { type: 'string' }
        }
      },
      Agent: {
        type: 'object',
        properties: {
          name:             { type: 'string' },
          type:             { type: 'string', enum: ['trading','defi','onchain','nft','social','custom'] },
          network:          { type: 'string', enum: ['mainnet','nova','sepolia'] },
          interestFreeMode: { type: 'boolean' },
          capabilities:     { type: 'array', items: { type: 'string' } },
          aiEnabled:        { type: 'boolean' },
          aiProvider:       { type: 'string', nullable: true },
          created:          { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: { '200': { description: 'API health status' } }
      }
    },
    '/agents': {
      get: {
        summary: 'List all agents',
        tags: ['Agents'],
        responses: { '200': { description: 'Agent list' } }
      },
      post: {
        summary: 'Create an agent',
        tags: ['Agents'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name:             { type: 'string' },
                  type:             { type: 'string', enum: ['trading','defi','onchain','nft','social','custom'] },
                  network:          { type: 'string', enum: ['mainnet','nova','sepolia'], default: 'sepolia' },
                  interestFreeMode: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Agent created' }, '400': { description: 'Validation error' } }
      }
    },
    '/agents/{name}': {
      get: {
        summary: 'Get agent info',
        tags: ['Agents'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Agent info' }, '404': { description: 'Not found' } }
      },
      delete: {
        summary: 'Delete an agent',
        tags: ['Agents'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } }
      }
    },
    '/agents/{name}/chat': {
      post: {
        summary: 'Chat with an agent (AI)',
        tags: ['Agents'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } }
            }
          }
        },
        responses: { '200': { description: 'AI response' } }
      }
    },
    '/agents/{name}/chat/stream': {
      get: {
        summary: 'Stream chat response (SSE)',
        tags: ['Agents'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'message', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'SSE stream of AI tokens' } }
      }
    },
    '/agents/{name}/memory': {
      get: {
        summary: 'Get agent conversation memory',
        tags: ['Agents'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Conversation history' } }
      },
      delete: {
        summary: 'Clear agent memory',
        tags: ['Agents'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Memory cleared' } }
      }
    },
    '/agents/{name}/portfolio': {
      get: {
        summary: 'Get agent wallet portfolio',
        tags: ['Wallet'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Portfolio snapshot' } }
      }
    },
    '/agents/{name}/portfolio/history': {
      get: {
        summary: 'Get portfolio snapshot history',
        tags: ['Wallet'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30 } }
        ],
        responses: { '200': { description: 'Historical portfolio snapshots' } }
      }
    },
    '/analytics/prices': {
      get: { summary: 'Token prices', tags: ['Analytics'], responses: { '200': { description: 'Prices' } } }
    },
    '/analytics/protocols': {
      get: { summary: 'DeFi protocol TVL', tags: ['Analytics'], responses: { '200': { description: 'Protocols' } } }
    },
    '/analytics/yields': {
      get: { summary: 'Yield opportunities', tags: ['Analytics'], responses: { '200': { description: 'Yields' } } }
    },
    '/analytics/gas': {
      get: { summary: 'Gas estimates', tags: ['Analytics'], responses: { '200': { description: 'Gas data' } } }
    },
    '/analytics/whales': {
      get: {
        summary: 'Recent whale transactions',
        tags: ['Analytics'],
        parameters: [
          { name: 'network', in: 'query', schema: { type: 'string', default: 'mainnet' } },
          { name: 'limit',   in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } }
        ],
        responses: { '200': { description: 'Large on-chain transactions' } }
      }
    },
    '/networks': {
      get: { summary: 'List networks', tags: ['Networks'], responses: { '200': { description: 'Networks' } } }
    },
    '/networks/health': {
      get: { summary: 'All networks health', tags: ['Networks'], responses: { '200': { description: 'Health' } } }
    },
    '/networks/{network}/health': {
      get: {
        summary: 'Single network health',
        tags: ['Networks'],
        parameters: [{ name: 'network', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Health' } }
      }
    },
    '/networks/{network}/sequencer': {
      get: {
        summary: 'Sequencer status',
        tags: ['Networks'],
        parameters: [{ name: 'network', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Sequencer info' } }
      }
    },
    '/networks/{network}/tx/{hash}': {
      get: {
        summary: 'Transaction lifecycle (L2→L1)',
        tags: ['Networks'],
        parameters: [
          { name: 'network', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'hash',    in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Lifecycle stages' } }
      }
    },
    '/networks/{network}/address/{addr}': {
      get: {
        summary: 'Address inspector',
        tags: ['Networks'],
        parameters: [
          { name: 'network', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'addr',    in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Address balances and info' } }
      }
    },
    '/networks/faucets': {
      get: { summary: 'Sepolia faucet list', tags: ['Networks'], responses: { '200': { description: 'Faucets' } } }
    },
    '/agents/{name}/performance': {
      get: {
        summary: 'Agent P&L performance summary',
        tags: ['Performance'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Performance summary' } }
      }
    },
    '/agents/{name}/performance/daily': {
      get: {
        summary: 'Daily P&L breakdown',
        tags: ['Performance'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }
        ],
        responses: { '200': { description: 'Daily P&L' } }
      }
    },
    '/fleets': {
      get:  { summary: 'List fleets',   tags: ['Fleet Orchestration'], responses: { '200': { description: 'Fleets' } } },
      post: { summary: 'Create a fleet', tags: ['Fleet Orchestration'], responses: { '201': { description: 'Created' } } }
    },
    '/fleets/{name}/coordinate': {
      post: {
        summary: 'Coordinate fleet on a task',
        tags: ['Fleet Orchestration'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Consensus decision' } }
      }
    },
    '/notifications/channels': {
      get:  { summary: 'List channels',  tags: ['Notifications'], responses: { '200': { description: 'Channels' } } },
      post: { summary: 'Add channel',    tags: ['Notifications'], responses: { '201': { description: 'Added' } } }
    },
    '/notifications/send': {
      post: { summary: 'Send notification', tags: ['Notifications'], responses: { '200': { description: 'Sent' } } }
    },
    '/notifications/history': {
      get: { summary: 'Notification history', tags: ['Notifications'], responses: { '200': { description: 'History' } } }
    },
    '/webhooks': {
      get:  { summary: 'List outbound webhooks', tags: ['Webhooks'], responses: { '200': { description: 'Webhooks' } } },
      post: {
        summary: 'Add outbound webhook',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'url'],
                properties: {
                  name:   { type: 'string' },
                  url:    { type: 'string', format: 'uri' },
                  events: { type: 'array', items: { type: 'string' }, default: ['*'] },
                  secret: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Webhook added' } }
      }
    },
    '/webhooks/{name}': {
      get:    { summary: 'Get webhook',    tags: ['Webhooks'], parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Webhook' } } },
      delete: { summary: 'Remove webhook', tags: ['Webhooks'], parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Removed' } } }
    },
    '/webhooks/{name}/test': {
      post: {
        summary: 'Test a webhook',
        tags: ['Webhooks'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Delivery result' } }
      }
    },
    '/webhooks/history': {
      get: { summary: 'Webhook delivery history', tags: ['Webhooks'], responses: { '200': { description: 'History' } } }
    },
    '/price-watches': {
      get:  { summary: 'List price watches', tags: ['Price Watches'], responses: { '200': { description: 'Watches' } } },
      post: {
        summary: 'Add price watch',
        tags: ['Price Watches'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'condition', 'targetPrice'],
                properties: {
                  token:       { type: 'string', example: 'ETH' },
                  condition:   { type: 'string', enum: ['above', 'below', 'change_pct'] },
                  targetPrice: { type: 'number' },
                  agentName:   { type: 'string', nullable: true },
                  intervalMs:  { type: 'integer', default: 60000 }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Watch created' } }
      }
    },
    '/price-watches/{id}': {
      get:    { summary: 'Get price watch',    tags: ['Price Watches'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Watch' } } },
      delete: { summary: 'Remove price watch', tags: ['Price Watches'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Removed' } } },
      patch:  {
        summary: 'Enable/disable price watch',
        tags: ['Price Watches'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { enabled: { type: 'boolean' } } } } }
        },
        responses: { '200': { description: 'Updated' } }
      }
    },
    '/agents/{name}/tokenize': {
      post: {
        summary: 'Tokenize agent as ERC-20',
        tags: ['Tokenization'],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Token deployed' } }
      }
    },
    '/tokens': {
      get: { summary: 'List all agent tokens', tags: ['Tokenization'], responses: { '200': { description: 'Tokens' } } }
    },
    '/agents/{name}/events': {
      get:  { summary: 'List event watchers',  tags: ['Events'], parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Watchers' } } },
      post: { summary: 'Add event watcher',    tags: ['Events'], parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Added' } } }
    },
    '/agents/{name}/events/stream': {
      get: { summary: 'SSE live event stream', tags: ['Events'], parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'SSE stream' } } }
    }
  }
};

export const swaggerHtml = (specUrl) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arbitrum AI Agent API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #0a0a0a; }
    .swagger-ui .topbar { background: #1a1a2e; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      tryItOutEnabled: true,
      requestInterceptor: (r) => { r.headers['Accept'] = 'application/json'; return r; }
    });
  </script>
</body>
</html>`;
