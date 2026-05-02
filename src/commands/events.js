import chalk   from 'chalk';
import inquirer from 'inquirer';
import { eventService } from '../services/eventService.js';
import { storage }      from '../utils/storage.js';
import { display }      from '../utils/display.js';
import { KNOWN_POOLS, TOKEN_ADDRS, AAVE_POOL } from '../blockchain/eventListener.js';

function getActiveAgentName() {
  const name = storage.loadActiveAgent();
  if (!name) throw new Error('No active agent. Run: arb agent select');
  return name;
}

// ── arb events start ─────────────────────────────────────────────────────────

export async function eventsStartCommand(opts) {
  const name     = opts.agent || getActiveAgentName();
  const interval = parseInt(opts.interval || '15') * 1000;

  display.info(`Starting event listener for agent "${name}" (poll every ${interval/1000}s)…`);
  const status = eventService.startListener(name, interval);

  display.success('Event listener started');
  console.log(chalk.gray(`  Network:  ${status.network}`));
  console.log(chalk.gray(`  Watchers: ${status.watcherCount}`));
  console.log(chalk.gray(`  Interval: ${status.intervalMs / 1000}s`));
  if (status.watcherCount === 0) {
    display.info('No watchers yet. Add one with: arb events watch');
  }
}

// ── arb events stop ──────────────────────────────────────────────────────────

export async function eventsStopCommand(opts) {
  const name = opts.agent || getActiveAgentName();
  eventService.stopListener(name);
  display.success(`Event listener stopped for agent "${name}"`);
}

// ── arb events status ─────────────────────────────────────────────────────────

export async function eventsStatusCommand(opts) {
  const name   = opts.agent || getActiveAgentName();
  const status = eventService.getStatus(name);

  console.log(chalk.bold(`\n  Event Listener — ${name}`));
  console.log(`  Running:  ${status.running ? chalk.green('yes') : chalk.red('no')}`);
  console.log(`  Network:  ${chalk.cyan(status.network)}`);
  console.log(`  Watchers: ${chalk.yellow(status.watcherCount)}`);
  console.log(`  Events:   ${chalk.yellow(status.eventCount)} (in history)`);
  console.log(`  Last blk: ${status.lastBlock ?? chalk.gray('—')}`);
  console.log(`  Interval: ${status.intervalMs ? status.intervalMs / 1000 + 's' : chalk.gray('—')}`);
  console.log('');
}

// ── arb events watch (interactive) ───────────────────────────────────────────

export async function eventsWatchCommand(opts) {
  const name    = opts.agent || getActiveAgentName();
  const options = eventService.getKnownOptions(name);

  const TYPES = [
    { name: 'Large Transfer  — whale ERC-20 transfer above threshold', value: 'large_transfer' },
    { name: 'Whale Swap      — Uniswap V3 pool swap event',            value: 'whale_swap'     },
    { name: 'Liquidation     — Aave V3 LiquidationCall event',         value: 'liquidation'    },
    { name: 'Custom Event    — any contract + event + ABI fragment',   value: 'custom'         },
  ];

  const ACTIONS = [
    { name: 'alert   — log & stream via SSE (default)', value: 'alert'   },
    { name: 'webhook — POST event JSON to a URL',       value: 'webhook' },
  ];

  const { type } = await inquirer.prompt([{
    type: 'list', name: 'type',
    message: 'Event type to watch:',
    choices: TYPES
  }]);

  const { action } = await inquirer.prompt([{
    type: 'list', name: 'action',
    message: 'Action when event fires:',
    choices: ACTIONS
  }]);

  let webhookUrl = null;
  if (action === 'webhook') {
    const { url } = await inquirer.prompt([{
      type: 'input', name: 'url',
      message: 'Webhook URL (POST target):',
      validate: v => v.startsWith('http') ? true : 'Must be a valid URL'
    }]);
    webhookUrl = url;
  }

  let watcher;

  if (type === 'large_transfer') {
    const tokenChoices = Object.keys(options.tokens).map(sym => ({
      name: `${sym}  (${options.tokens[sym].slice(0,12)}…)`, value: sym
    }));
    const { token, threshold } = await inquirer.prompt([
      { type: 'list',  name: 'token',     message: 'Token:',           choices: tokenChoices },
      { type: 'input', name: 'threshold', message: 'Min amount (ETH/token units):', default: '1000',
        validate: v => !isNaN(parseFloat(v)) ? true : 'Enter a number' }
    ]);
    watcher = eventService.addLargeTransferWatcher(name, token, threshold, action);
    if (action === 'webhook') watcher.actionParams.url = webhookUrl;

  } else if (type === 'whale_swap') {
    const poolChoices = Object.entries(options.pools).map(([k, v]) => ({
      name: `${k}  (${v.slice(0,12)}…)`, value: k
    }));
    if (poolChoices.length === 0) {
      display.error('No known pools on this network. Use "custom" type instead.');
      return;
    }
    const { pool } = await inquirer.prompt([{
      type: 'list', name: 'pool', message: 'Uniswap V3 pool:', choices: poolChoices
    }]);
    watcher = eventService.addWhaleSwapWatcher(name, pool, action);
    if (action === 'webhook') watcher.actionParams.url = webhookUrl;

  } else if (type === 'liquidation') {
    if (!options.aavePool) {
      display.error('Aave V3 not available on this network (Sepolia).');
      display.info('Tip: Deploy mainnet agent with: arb agent create --network mainnet');
      return;
    }
    watcher = eventService.addLiquidationWatcher(name, action);
    if (action === 'webhook') watcher.actionParams.url = webhookUrl;

  } else if (type === 'custom') {
    const { address, abiFragment, eventName, label, threshold } = await inquirer.prompt([
      { type: 'input', name: 'address',     message: 'Contract address (0x…):',
        validate: v => v.startsWith('0x') && v.length === 42 ? true : 'Invalid address' },
      { type: 'input', name: 'eventName',   message: 'Event name (e.g. Transfer):' },
      { type: 'input', name: 'abiFragment', message: 'ABI fragment (e.g. "event Transfer(address indexed from, address indexed to, uint256 value)"):' },
      { type: 'input', name: 'label',       message: 'Label (human-readable):' },
      { type: 'input', name: 'threshold',   message: 'Min value threshold (wei, leave empty for none):', default: '' }
    ]);
    watcher = eventService.addCustomWatcher(
      name, address, abiFragment, eventName, label,
      action, threshold || null
    );
    if (action === 'webhook') watcher.actionParams.url = webhookUrl;
  }

  display.success(`Watcher added: ${watcher.id}`);
  console.log(chalk.gray(`  Type:   ${watcher.type}`));
  console.log(chalk.gray(`  Label:  ${watcher.label}`));
  console.log(chalk.gray(`  Action: ${watcher.action}`));
  console.log(chalk.gray(`  Addr:   ${watcher.address || 'any'}`));
  console.log('');
  display.info('Start listening with: arb events start');
}

// ── arb events list ───────────────────────────────────────────────────────────

export async function eventsListCommand(opts) {
  const name     = opts.agent || getActiveAgentName();
  const watchers = eventService.listWatchers(name);

  if (watchers.length === 0) {
    display.info(`No watchers for agent "${name}". Add one with: arb events watch`);
    return;
  }

  console.log(chalk.bold(`\n  Watchers — ${name} (${watchers.length} total)\n`));

  for (const w of watchers) {
    const status = w.enabled ? chalk.green('●') : chalk.gray('○');
    console.log(`  ${status} ${chalk.cyan(w.id.slice(-8))}  ${chalk.white(w.label)}`);
    console.log(`         type: ${w.type}  |  action: ${w.action}  |  triggers: ${chalk.yellow(w.triggerCount)}`);
    if (w.address) console.log(`         contract: ${chalk.gray(w.address)}`);
    if (w.threshold) console.log(`         threshold: ${chalk.gray(w.threshold + ' wei')}`);
    console.log('');
  }
}

// ── arb events remove ─────────────────────────────────────────────────────────

export async function eventsRemoveCommand(watcherId, opts) {
  const name = opts.agent || getActiveAgentName();
  const { removed } = eventService.removeWatcher(name, watcherId);
  if (removed) display.success(`Watcher ${watcherId} removed`);
  else         display.error(`Watcher ${watcherId} not found`);
}

// ── arb events history ────────────────────────────────────────────────────────

export async function eventsHistoryCommand(opts) {
  const name   = opts.agent || getActiveAgentName();
  const limit  = parseInt(opts.limit || '20');
  const events = eventService.getHistory(name, limit);

  if (events.length === 0) {
    display.info(`No events captured yet for agent "${name}"`);
    display.info('Make sure the listener is running: arb events start');
    return;
  }

  console.log(chalk.bold(`\n  Event History — ${name} (last ${events.length})\n`));

  for (const ev of events) {
    const time = ev.timestamp.slice(11, 19);
    console.log(`  ${chalk.gray(time)}  ${chalk.cyan(ev.type.padEnd(18))}  ${chalk.white(ev.watcherLabel)}`);
    console.log(`           tx: ${chalk.gray(ev.txHash?.slice(0, 24) + '…')}  block: ${chalk.yellow(ev.blockNumber)}`);
    if (ev.decoded?.args) {
      const preview = Object.entries(ev.decoded.args)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${String(v).slice(0, 20)}`)
        .join('  ');
      if (preview) console.log(`           ${chalk.gray(preview)}`);
    }
    console.log('');
  }
}
