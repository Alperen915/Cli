#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { display } from './src/utils/display.js';
import { config } from './src/utils/config.js';

import { 
  createAgentCommand, 
  listAgentsCommand, 
  selectAgentCommand,
  deleteAgentCommand 
} from './src/commands/agent.js';

import { chatCommand } from './src/commands/chat.js';

import { 
  walletStatusCommand, 
  walletGenerateCommand, 
  walletBalanceCommand,
  walletConnectCommand 
} from './src/commands/wallet.js';

import { 
  networkListCommand, 
  networkInfoCommand 
} from './src/commands/network.js';

import {
  deployAgentCommand,
  contractStatusCommand,
  verifyContractCommand,
  interactContractCommand
} from './src/commands/onchain.js';

import {
  configureApiCommand,
  showConfigCommand
} from './src/commands/config.js';

import {
  exportAgentsCommand,
  importAgentsCommand,
  exportConfigCommand
} from './src/commands/export.js';

import { analyticsCommand } from './src/commands/analytics.js';

import {
  tokenCreateCommand,
  tokenInfoCommand,
  tokenListCommand,
  tokenHoldersCommand,
  tokenDistributeCommand,
  tokenClaimCommand,
  tokenTransferCommand,
  tokenPrecompileCommand
} from './src/commands/token.js';

const program = new Command();

program
  .name('arb')
  .description('Arbitrum AI Agent Platform - Build and deploy autonomous agents on the Arbitrum ecosystem')
  .version('1.0.0')
  .hook('preAction', () => {
    display.banner();
  });

const agentCmd = program
  .command('agent')
  .description('Manage AI agents');

agentCmd
  .command('create')
  .description('Create a new AI agent')
  .option('-n, --name <name>', 'Agent name')
  .option('-t, --type <type>', 'Agent type (trading, defi, onchain, nft, social, custom)')
  .option('--network <network>', 'Arbitrum network (mainnet, sepolia, nova)', 'sepolia')
  .option('--interest-free', 'Enable interest-free/halal mode (no lending, borrowing, or leverage)')
  .action(createAgentCommand);

agentCmd
  .command('list')
  .description('List all agents')
  .action(listAgentsCommand);

agentCmd
  .command('select [name]')
  .description('Select an active agent')
  .action(selectAgentCommand);

agentCmd
  .command('delete [name]')
  .description('Delete an agent')
  .action(deleteAgentCommand);

program
  .command('chat')
  .description('Start interactive chat with your active agent')
  .action(chatCommand);

const walletCmd = program
  .command('wallet')
  .description('Wallet management commands');

walletCmd
  .command('status')
  .description('Show network and wallet status')
  .option('--network <network>', 'Arbitrum network', 'sepolia')
  .action(walletStatusCommand);

walletCmd
  .command('generate')
  .description('Generate a new wallet')
  .action(walletGenerateCommand);

walletCmd
  .command('balance')
  .description('Check wallet balance')
  .option('-a, --address <address>', 'Wallet address')
  .option('--network <network>', 'Arbitrum network', 'sepolia')
  .action(walletBalanceCommand);

walletCmd
  .command('connect')
  .description('Connect an existing wallet')
  .option('--network <network>', 'Arbitrum network', 'sepolia')
  .action(walletConnectCommand);

const networkCmd = program
  .command('network')
  .description('Arbitrum network commands');

networkCmd
  .command('list')
  .description('List all available Arbitrum networks')
  .action(networkListCommand);

networkCmd
  .command('info')
  .description('Get detailed network information')
  .option('--network <network>', 'Arbitrum network', 'sepolia')
  .action(networkInfoCommand);

const onchainCmd = program
  .command('onchain')
  .description('On-chain agent deployment and management');

onchainCmd
  .command('deploy')
  .description('Deploy an on-chain agent contract')
  .action(deployAgentCommand);

onchainCmd
  .command('status')
  .description('Check on-chain agent deployment status')
  .action(contractStatusCommand);

onchainCmd
  .command('verify')
  .description('Verify a deployed contract')
  .option('-a, --address <address>', 'Contract address to verify')
  .action(verifyContractCommand);

onchainCmd
  .command('interact')
  .description('Interact with a deployed contract')
  .action(interactContractCommand);

const configCmd = program
  .command('config')
  .description('Configure API keys and settings');

configCmd
  .command('set')
  .description('Configure your OpenAI API key')
  .action(configureApiCommand);

configCmd
  .command('show')
  .description('Show current configuration')
  .action(showConfigCommand);

const exportCmd = program
  .command('export')
  .description('Export agents and configuration');

exportCmd
  .command('agents')
  .description('Export agents to a JSON file')
  .option('-o, --output <file>', 'Output file name')
  .option('-a, --all', 'Export all agents without prompting')
  .action(exportAgentsCommand);

exportCmd
  .command('import')
  .description('Import agents from a JSON file')
  .option('-f, --file <file>', 'File to import')
  .action(importAgentsCommand);

exportCmd
  .command('config')
  .description('Export current configuration')
  .option('-o, --output <file>', 'Output file name')
  .action(exportConfigCommand);

const analyticsCmd = program
  .command('analytics')
  .description('Advanced analytics and market data');

analyticsCmd
  .command('prices')
  .description('View live Arbitrum token prices')
  .action(() => analyticsCommand('prices'));

analyticsCmd
  .command('price')
  .description('Get price for a specific token')
  .option('-s, --symbol <symbol>', 'Token symbol', 'ETH')
  .action((options) => analyticsCommand('price', options));

analyticsCmd
  .command('tvl')
  .description('View Arbitrum chain TVL')
  .action(() => analyticsCommand('tvl'));

analyticsCmd
  .command('protocols')
  .description('Top protocols by TVL')
  .action(() => analyticsCommand('protocols'));

analyticsCmd
  .command('yields')
  .description('Top yield opportunities')
  .action(() => analyticsCommand('yields'));

analyticsCmd
  .command('gas')
  .description('Estimate gas costs')
  .option('--network <network>', 'Network', 'mainnet')
  .action((options) => analyticsCommand('gas', options));

analyticsCmd
  .command('portfolio')
  .description('Track wallet portfolio value')
  .option('-a, --address <address>', 'Wallet address')
  .option('--network <network>', 'Network', 'mainnet')
  .action((options) => analyticsCommand('portfolio', options));

analyticsCmd
  .command('whales')
  .description('Track whale transactions')
  .option('--network <network>', 'Network', 'mainnet')
  .action((options) => analyticsCommand('whales', options));

analyticsCmd
  .command('alerts')
  .description('Manage price alerts')
  .option('-l, --list', 'List all alerts')
  .option('-c, --check', 'Check alerts now')
  .option('--clear', 'Clear all alerts')
  .action((options) => analyticsCommand('alerts', options));

analyticsCmd
  .command('simulate')
  .description('Simulate trading strategies')
  .action(() => analyticsCommand('simulate'));

analyticsCmd
  .command('volume')
  .description('View DEX trading volumes')
  .action(() => analyticsCommand('volume'));

program
  .command('info')
  .description('Show platform information')
  .action(() => {
    display.banner();
    display.divider();
    
    console.log(chalk.bold('\n🚀 Arbitrum AI Agent Platform\n'));
    console.log('Build, deploy, and manage autonomous AI agents on the Arbitrum ecosystem.\n');
    
    console.log(chalk.cyan('Features:'));
    console.log('  • Create trading, DeFi, on-chain, NFT, and custom agents');
    console.log('  • AI-powered decision making with GPT-4o');
    console.log('  • Deploy agents as smart contracts on Arbitrum');
    console.log('  • Multi-network support (Arbitrum One, Nova, Sepolia)');
    console.log('  • Wallet management and blockchain interactions');
    console.log('  • Interactive chat with your agents');
    console.log('  • Live price feeds, TVL, and yield analytics');
    console.log('  • Whale tracking and price alerts');
    console.log('  • Strategy simulator for backtesting\n');
    
    console.log(chalk.cyan('Agent Types:'));
    Object.entries(config.agentTypes).forEach(([key, value]) => {
      console.log(`  ${chalk.yellow(key.padEnd(10))} ${value.description}`);
    });
    
    console.log(chalk.cyan('\nQuick Start:'));
    console.log('  1. arb agent create        - Create your first agent');
    console.log('  2. arb chat                - Start chatting with your agent');
    console.log('  3. arb analytics prices    - View live token prices');
    console.log('  4. arb analytics yields    - Find best yield opportunities');
    console.log('  5. arb analytics simulate  - Backtest trading strategies\n');
    
    if (!config.openaiApiKey) {
      display.warning('Set OPENAI_API_KEY for full AI capabilities');
    }
  });

// ── Token Commands ────────────────────────────────────────────────────────────

const tokenCmd = program
  .command('token')
  .description('Tokenize AI agents — deploy ERC-20 tokens with revenue sharing & governance');

tokenCmd
  .command('create')
  .description('Tokenize the active agent (deploy ERC-20 on Arbitrum)')
  .action(tokenCreateCommand);

tokenCmd
  .command('info')
  .description('Show token info for the active agent')
  .option('-a, --agent <name>', 'Agent name (default: active agent)')
  .action(tokenInfoCommand);

tokenCmd
  .command('list')
  .description('List all tokenized agents')
  .action(tokenListCommand);

tokenCmd
  .command('holders')
  .description('Show token holder list')
  .option('-a, --agent <name>', 'Agent name (default: active agent)')
  .option('-l, --limit <n>', 'Max holders to show', '20')
  .action(tokenHoldersCommand);

tokenCmd
  .command('distribute')
  .description('Deposit ETH revenue to be shared by all token holders')
  .option('-a, --agent <name>', 'Agent name (default: active agent)')
  .action(tokenDistributeCommand);

tokenCmd
  .command('claim')
  .description('Claim pending ETH revenue as a token holder')
  .option('-a, --agent <name>', 'Agent name (default: active agent)')
  .action(tokenClaimCommand);

tokenCmd
  .command('transfer')
  .description('Transfer tokens to another address')
  .option('-a, --agent <name>', 'Agent name (default: active agent)')
  .action(tokenTransferCommand);

tokenCmd
  .command('precompile')
  .description('Pre-compile and cache the AgentToken Solidity contract')
  .action(tokenPrecompileCommand);

// ── Entry Point ───────────────────────────────────────────────────────────────

if (process.argv.length <= 2) {
  program.parse(['node', 'index.js', 'info']);
} else {
  program.parse();
}
