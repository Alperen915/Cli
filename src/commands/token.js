/**
 * arb token — Agent Tokenization CLI Commands
 *
 * arb token create          Tokenize the active agent (deploy ERC-20)
 * arb token info            Show token info for the active agent
 * arb token list            List all tokenized agents
 * arb token holders         Show token holder list
 * arb token distribute      Deposit ETH revenue to all holders
 * arb token claim           Claim pending revenue as a holder
 * arb token transfer        Transfer tokens to another address
 */
import inquirer from 'inquirer';
import ora      from 'ora';
import chalk    from 'chalk';
import { agentManager } from '../agents/agentManager.js';
import { tokenService }  from '../services/tokenService.js';
import { display }       from '../utils/display.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function promptPrivateKey(label = 'deployer') {
  const { key } = await inquirer.prompt([{
    type:     'password',
    name:     'key',
    message:  `Enter ${label} private key (session-only, never stored):`,
    mask:     '*',
    validate: v => (v && v.trim().length >= 64) ? true : 'Enter a valid private key (64+ hex chars)'
  }]);
  return key.trim().startsWith('0x') ? key.trim() : `0x${key.trim()}`;
}

function fmtToken(info) {
  console.log('');
  console.log(chalk.bold.cyan(`  ◈ ${info.tokenName || info.name} (${info.tokenSymbol || info.symbol})`));
  console.log(chalk.gray(`  ─────────────────────────────────────────────`));
  console.log(`  ${chalk.bold('Address:')}      ${chalk.yellow(info.address)}`);
  console.log(`  ${chalk.bold('Agent:')}        ${info.agentName} (${info.agentType})`);
  console.log(`  ${chalk.bold('Network:')}      ${info.agentNetwork || info.network}`);
  console.log(`  ${chalk.bold('Total Supply:')} ${parseFloat(info.totalSupply || 0).toLocaleString()} tokens`);
  console.log(`  ${chalk.bold('Owner:')}        ${info.owner || info.deployer}`);
  console.log(`  ${chalk.bold('Total Revenue:')}${info.totalRevenue || '0'} ETH distributed`);
  if (info.description) console.log(`  ${chalk.bold('Description:')} ${info.description}`);
  if (info.txHash) console.log(`  ${chalk.bold('Deploy Tx:')}    ${info.txHash}`);
  if (info.explorer) console.log(`  ${chalk.bold('Explorer:')}     ${chalk.blue(info.explorer)}`);
  console.log('');
}

// ── Commands ──────────────────────────────────────────────────────────────────

export async function tokenCreateCommand(options) {
  display.divider();
  console.log(chalk.bold.cyan('\n  Tokenize AI Agent → Deploy ERC-20 on Arbitrum\n'));

  const agent = agentManager.getActiveAgent();
  if (!agent) {
    display.error('No active agent. Create or select one first.');
    return;
  }

  console.log(chalk.gray(`  Agent:   ${agent.name}`));
  console.log(chalk.gray(`  Type:    ${agent.type}`));
  console.log(chalk.gray(`  Network: ${agent.network}`));
  console.log('');

  // Gather token parameters
  const answers = await inquirer.prompt([
    {
      type:     'input',
      name:     'tokenName',
      message:  'Token name:',
      default:  `${agent.name} Token`,
      validate: v => v.trim().length > 0 ? true : 'Token name required'
    },
    {
      type:     'input',
      name:     'tokenSymbol',
      message:  'Token symbol (2-10 chars):',
      default:  agent.name.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, ''),
      validate: v => (v.trim().length >= 2 && v.trim().length <= 10) ? true : '2-10 characters required'
    },
    {
      type:     'number',
      name:     'totalSupply',
      message:  'Total supply (tokens):',
      default:  1_000_000,
      validate: v => (v > 0 && v <= 1_000_000_000) ? true : 'Enter a value between 1 and 1,000,000,000'
    },
    {
      type:    'input',
      name:    'description',
      message: 'Token description (optional):',
      default: `Autonomous AI ${agent.type} agent token. Powered by Arbitrum AI Agent Platform.`
    }
  ]);

  // Confirm
  console.log('');
  console.log(chalk.bold('  Token Configuration:'));
  console.log(`  Name:    ${answers.tokenName}`);
  console.log(`  Symbol:  ${answers.tokenSymbol}`);
  console.log(`  Supply:  ${answers.totalSupply.toLocaleString()}`);
  console.log(`  Network: ${agent.network}`);
  console.log('');
  console.log(chalk.yellow('  ⚠  This will deploy a contract on-chain and cost gas.'));
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type:    'confirm',
    name:    'confirm',
    message: 'Deploy this token?',
    default: false
  }]);

  if (!confirm) { console.log(chalk.gray('  Cancelled.')); return; }

  const privateKey = await promptPrivateKey('token deployer');
  const spinner    = ora({ text: 'Compiling AgentToken contract...', color: 'cyan' }).start();

  try {
    spinner.text = 'Deploying AgentToken contract on ' + agent.network + '...';
    const result = await tokenService.tokenizeAgent(agent.name, privateKey, {
      ...answers,
      tokenSymbol: answers.tokenSymbol.toUpperCase()
    });

    spinner.succeed(chalk.green('Token deployed successfully!'));
    fmtToken(result);

  } catch (err) {
    spinner.fail(chalk.red('Deployment failed'));
    display.error(err.message);
  }
}

export async function tokenInfoCommand(options) {
  display.divider();
  const name = options.agent || agentManager.getActiveAgent()?.name;
  if (!name) { display.error('No active agent.'); return; }

  const spinner = ora({ text: `Fetching token info for ${name}...`, color: 'cyan' }).start();
  try {
    const info = await tokenService.getAgentToken(name);
    spinner.stop();
    fmtToken(info);
  } catch (err) {
    spinner.fail();
    display.error(err.message);
  }
}

export async function tokenListCommand() {
  display.divider();
  const tokens = tokenService.listTokenizedAgents();

  if (tokens.length === 0) {
    display.info('No agents have been tokenized yet.');
    display.info('Use: arb token create');
    return;
  }

  console.log(chalk.bold.cyan(`\n  Tokenized Agents (${tokens.length})\n`));
  for (const t of tokens) {
    console.log(`  ${chalk.bold(t.agentName)} — ${chalk.yellow(t.address)}`);
    console.log(`    Symbol: ${t.tokenSymbol || t.symbol}  |  Supply: ${parseFloat(t.totalSupply||0).toLocaleString()}  |  Network: ${t.agentNetwork}`);
  }
  console.log('');
}

export async function tokenHoldersCommand(options) {
  display.divider();
  const name = options.agent || agentManager.getActiveAgent()?.name;
  if (!name) { display.error('No active agent.'); return; }

  const spinner = ora({ text: `Fetching holders for ${name}...`, color: 'cyan' }).start();
  try {
    const { holders, totalHolders } = await tokenService.getHolders(name, parseInt(options.limit) || 20);
    spinner.stop();

    console.log(chalk.bold.cyan(`\n  Token Holders for ${name} (top ${holders.length} of ${totalHolders})\n`));
    if (holders.length === 0) {
      console.log('  No holders found (try after some transfers).');
    } else {
      holders.forEach((h, i) => {
        console.log(`  ${chalk.gray(String(i+1).padStart(2,'0'))}. ${chalk.yellow(h.address)}`);
        console.log(`      Balance: ${parseFloat(h.balance).toLocaleString()}  |  Ownership: ${h.ownershipPct}%`);
      });
    }
    console.log('');
  } catch (err) {
    spinner.fail();
    display.error(err.message);
  }
}

export async function tokenDistributeCommand(options) {
  display.divider();
  const name = options.agent || agentManager.getActiveAgent()?.name;
  if (!name) { display.error('No active agent.'); return; }

  console.log(chalk.bold.cyan(`\n  Distribute Revenue — ${name}\n`));
  console.log(chalk.gray('  Deposit ETH that will be claimable proportionally by all token holders.\n'));

  const { amount } = await inquirer.prompt([{
    type:     'input',
    name:     'amount',
    message:  'Amount of ETH to distribute:',
    default:  '0.001',
    validate: v => (parseFloat(v) > 0) ? true : 'Enter a positive amount'
  }]);

  const privateKey = await promptPrivateKey('distributor');
  const spinner    = ora({ text: `Depositing ${amount} ETH revenue...`, color: 'cyan' }).start();

  try {
    const result = await tokenService.depositRevenue(name, privateKey, parseFloat(amount));
    spinner.succeed(chalk.green('Revenue deposited!'));
    console.log(`\n  ${chalk.bold('Amount:')}   ${amount} ETH`);
    console.log(`  ${chalk.bold('TxHash:')}   ${result.txHash}`);
    console.log(`  ${chalk.bold('Explorer:')} ${chalk.blue(result.explorer)}`);
    console.log('');
  } catch (err) {
    spinner.fail();
    display.error(err.message);
  }
}

export async function tokenClaimCommand(options) {
  display.divider();
  const name = options.agent || agentManager.getActiveAgent()?.name;
  if (!name) { display.error('No active agent.'); return; }

  console.log(chalk.bold.cyan(`\n  Claim Revenue — ${name}\n`));

  const privateKey = await promptPrivateKey('holder (claimant)');
  const spinner    = ora({ text: 'Claiming pending revenue...', color: 'cyan' }).start();

  try {
    const result = await tokenService.claimRevenue(name, privateKey);
    if (!result.success) {
      spinner.info('Nothing to claim at this time.');
    } else {
      spinner.succeed(chalk.green('Revenue claimed!'));
      console.log(`\n  ${chalk.bold('Claimed:')}  ${result.claimed} ETH`);
      console.log(`  ${chalk.bold('TxHash:')}   ${result.txHash}`);
      console.log(`  ${chalk.bold('Explorer:')} ${chalk.blue(result.explorer)}`);
    }
    console.log('');
  } catch (err) {
    spinner.fail();
    display.error(err.message);
  }
}

export async function tokenTransferCommand(options) {
  display.divider();
  const name = options.agent || agentManager.getActiveAgent()?.name;
  if (!name) { display.error('No active agent.'); return; }

  const answers = await inquirer.prompt([
    { type: 'input',  name: 'to',     message: 'Recipient address (0x...):',
      validate: v => /^0x[0-9a-fA-F]{40}$/.test(v) ? true : 'Invalid address' },
    { type: 'input',  name: 'amount', message: 'Amount of tokens to transfer:',
      validate: v => parseFloat(v) > 0 ? true : 'Enter positive amount' }
  ]);

  const privateKey = await promptPrivateKey('token holder');
  const spinner    = ora({ text: 'Sending tokens...', color: 'cyan' }).start();

  try {
    const result = await tokenService.transferTokens(name, privateKey, answers.to, answers.amount);
    spinner.succeed(chalk.green('Transfer complete!'));
    console.log(`\n  ${chalk.bold('To:')}       ${result.to}`);
    console.log(`  ${chalk.bold('Amount:')}   ${answers.amount} tokens`);
    console.log(`  ${chalk.bold('TxHash:')}   ${result.txHash}`);
    console.log(`  ${chalk.bold('Explorer:')} ${chalk.blue(result.explorer)}`);
    console.log('');
  } catch (err) {
    spinner.fail();
    display.error(err.message);
  }
}

export async function tokenPrecompileCommand() {
  display.divider();
  const spinner = ora({ text: 'Compiling AgentToken.sol...', color: 'cyan' }).start();
  try {
    await tokenService.precompile();
    spinner.succeed(chalk.green('AgentToken contract compiled and cached.'));
  } catch (err) {
    spinner.fail();
    display.error(err.message);
  }
}
