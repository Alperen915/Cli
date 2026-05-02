// ── Contract Addresses ───────────────────────────────────────────────────────

export const ADDRESSES = {
  mainnet: {
    // Routers
    uniswapV3Router:   '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV3Quoter:   '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    camelotRouter:     '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',

    // Tokens
    WETH:  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    ARB:   '0x912CE59144191C1204E64559FE8253a0e49E6548',
    USDC:  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT:  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    WBTC:  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    GMX:   '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    LINK:  '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    UNI:   '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    RDNT:  '0x3082CC23568eA640225c2467653dB90e9250AaA0',
    MAGIC: '0x539bdE0d7Dbd336b79148AA742883198BBF60342',
    PENDLE:'0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
    GNS:   '0x18c11FD286C5EC11c3b683Caa813B77f5163A122',
    GRAIL: '0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8',
  },
  sepolia: {
    uniswapV3Router: '0x101F443B4d1b059569D643917553c771E1b9663E',
    uniswapV3Quoter: '0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0B',
    camelotRouter:   '0x0000000000000000000000000000000000000000',

    WETH:  '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    ARB:   '0x0000000000000000000000000000000000000000',
    USDC:  '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    USDT:  '0x0000000000000000000000000000000000000000',
    WBTC:  '0x0000000000000000000000000000000000000000',
    GMX:   '0x0000000000000000000000000000000000000000',
  }
};

// Pool fee tiers (Uniswap V3)
export const FEE_TIERS = {
  LOWEST: 100,    // 0.01% - stable pairs
  LOW:    500,    // 0.05% - stable pairs
  MEDIUM: 3000,   // 0.30% - most pairs
  HIGH:   10000   // 1.00%  - exotic pairs
};

// Default fee tiers per pair
export const DEFAULT_FEES = {
  'WETH-USDC': FEE_TIERS.LOW,
  'WETH-USDT': FEE_TIERS.LOW,
  'WETH-ARB':  FEE_TIERS.MEDIUM,
  'WETH-WBTC': FEE_TIERS.MEDIUM,
  'WETH-GMX':  FEE_TIERS.MEDIUM,
  'ARB-USDC':  FEE_TIERS.MEDIUM,
  'default':   FEE_TIERS.MEDIUM
};

// ── ABIs ─────────────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

export const WETH_ABI = [
  ...ERC20_ABI,
  'function deposit() payable',
  'function withdraw(uint256 wad)'
];

export const UNISWAP_V3_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn',           type: 'address' },
          { name: 'tokenOut',          type: 'address' },
          { name: 'fee',               type: 'uint24'  },
          { name: 'recipient',         type: 'address' },
          { name: 'amountIn',          type: 'uint256' },
          { name: 'amountOutMinimum',  type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { name: 'path',             type: 'bytes'   },
          { name: 'recipient',        type: 'address' },
          { name: 'amountIn',         type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInput',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
];

export const UNISWAP_V3_QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn',           type: 'address' },
          { name: 'tokenOut',          type: 'address' },
          { name: 'amountIn',          type: 'uint256' },
          { name: 'fee',               type: 'uint24'  },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut',                type: 'uint256' },
      { name: 'sqrtPriceX96After',        type: 'uint160' },
      { name: 'initializedTicksCrossed',  type: 'uint32'  },
      { name: 'gasEstimate',              type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

// Token symbol → address lookup
export function getTokenAddress(symbol, network = 'mainnet') {
  const addrs = ADDRESSES[network] || ADDRESSES.mainnet;
  return addrs[symbol.toUpperCase()] || null;
}

// Get token decimals (most tokens are 18, USDC/USDT are 6)
export function getTokenDecimals(symbol) {
  const SIX_DECIMAL = ['USDC', 'USDT'];
  const EIGHT_DECIMAL = ['WBTC'];
  if (SIX_DECIMAL.includes(symbol.toUpperCase())) return 6;
  if (EIGHT_DECIMAL.includes(symbol.toUpperCase())) return 8;
  return 18;
}

// Get best fee tier for a pair
export function getPairFee(symbolA, symbolB) {
  const key = `${symbolA}-${symbolB}`;
  const keyAlt = `${symbolB}-${symbolA}`;
  return DEFAULT_FEES[key] || DEFAULT_FEES[keyAlt] || DEFAULT_FEES.default;
}

export const TOKEN_SYMBOLS = {
  mainnet: ['ETH', 'WETH', 'ARB', 'USDC', 'USDT', 'WBTC', 'GMX', 'LINK', 'UNI', 'RDNT', 'MAGIC', 'PENDLE', 'GRAIL'],
  sepolia: ['ETH', 'WETH', 'USDC']
};
