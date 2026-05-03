import chalk   from 'chalk';
import inquirer from 'inquirer';
import { networkService } from '../services/networkService.js';
import { display }        from '../utils/display.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function statusColor(s) {
  if (s === 'healthy')    return chalk.green('● healthy');
  if (s === 'degraded')   return chalk.yellow('◐ degraded');
  if (s === 'stalled')    return chalk.yellow('◑ stalled');
  if (s === 'down')       return chalk.red('○ down');
  if (s === 'unreachable')return chalk.red('✗ unreachable');
  return chalk.gray('? unknown');
}

function scoreBar(score) {
  const filled = Math.round((score || 0) / 10);
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const color  = score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
  return color(`[${bar}] ${score}/100`);
}

function msColor(ms) {
  if (ms < 200) return chalk.green(ms + 'ms');
  if (ms < 800) return chalk.yellow(ms + 'ms');
  return chalk.red(ms + 'ms');
}

// ── arb network status ────────────────────────────────────────────────────────

export async function networkStatusCommand(opts) {
  const single = opts?.network;

  if (single) {
    display.info(`Checking ${single}…`);
    const h = await networkService.getHealth(single);
    printNetworkCard(h);
    return;
  }

  display.info('Checking all Arbitrum networks…');
  const all = await networkService.getAllHealth();

  console.log(chalk.bold('\n  ══════════════════════════════════════════════'));
  console.log(chalk.bold('  Arbitrum Network Health Dashboard'));
  console.log(chalk.bold('  ══════════════════════════════════════════════\n'));

  for (const h of all) printNetworkCard(h);

  const healthy  = all.filter(h => (h.healthScore || 0) >= 80).length;
  const degraded = all.filter(h => (h.healthScore || 0) > 0 && (h.healthScore || 0) < 80).length;
  const down     = all.filter(h => (h.healthScore || 0) === 0).length;

  console.log('  ──────────────────────────────────────────────');
  console.log(`  Summary: ${chalk.green(healthy + ' healthy')}  ${chalk.yellow(degraded + ' degraded')}  ${chalk.red(down + ' down')}\n`);
}

function printNetworkCard(h) {
  const testnetTag = (h.network === 'sepolia') ? chalk.yellow(' [TESTNET]') : '';
  console.log(`  ${statusColor(h.status)}  ${chalk.bold(h.name || h.network)}${testnetTag}`);
  if (h.error && !h.blockNumber) {
    console.log(`           ${chalk.red('Error:')} ${h.error}`);
  } else {
    console.log(`           Health:   ${scoreBar(h.healthScore || 0)}`);
    console.log(`           Block:    ${chalk.white('#' + (h.blockNumber || '—'))}  ${chalk.gray(h.blockAge || '')}`);
    console.log(`           Gas:      ${chalk.cyan(h.gasPrice || '—')}`);
    console.log(`           Latency:  ${msColor(h.latencyMs || 0)}`);
    if (h.arbitrum) {
      if (h.arbitrum.l1BaseFeeGwei)
        console.log(`           L1 Base:  ${chalk.gray(h.arbitrum.l1BaseFeeGwei)} gwei`);
      if (h.arbitrum.gasBacklog != null)
        console.log(`           Backlog:  ${chalk.gray(h.arbitrum.gasBacklog)} tx`);
    }
    console.log(`           Explorer: ${chalk.gray(h.explorer || '—')}`);
  }
  console.log('');
}

// ── arb network sequencer ─────────────────────────────────────────────────────

export async function networkSequencerCommand(opts) {
  const network = opts?.network || 'mainnet';
  display.info(`Checking sequencer status for ${network}…`);

  const s = await networkService.getSequencerStatus(network);

  console.log(chalk.bold(`\n  Arbitrum Sequencer — ${s.name || network}\n`));
  console.log(`  Status:      ${statusColor(s.status)}`);
  console.log(`  Description: ${chalk.white(s.description || '—')}`);
  console.log(`  Block:       ${chalk.white('#' + (s.blockNumber || '—'))}`);
  console.log(`  Block Time:  ${chalk.gray(s.blockTimestamp || '—')}`);
  console.log(`  Lag:         ${s.lagSeconds != null
    ? (s.lagSeconds < 5 ? chalk.green(s.lagSeconds + 's') : chalk.yellow(s.lagSeconds + 's'))
    : chalk.gray('—')}`);
  console.log(`  Est. TPS:    ${s.estimatedTps != null ? chalk.cyan(s.estimatedTps) : chalk.gray('—')}`);
  console.log(`  Target:      ${chalk.gray((s.targetBlockTimeMs || 250) + 'ms blocks')}`);
  console.log(`  Checked:     ${chalk.gray(s.checkedAt || '—')}\n`);
}

// ── arb network tx ────────────────────────────────────────────────────────────

export async function networkTxCommand(hash, opts) {
  const network = opts?.network || 'mainnet';

  if (!hash) {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'hash',    message: 'Transaction hash (0x…):',
        validate: v => /^0x[0-9a-fA-F]{64}$/.test(v) ? true : 'Enter a valid 0x tx hash (64 hex chars)' },
      { type: 'list',  name: 'network', message: 'Network:',
        choices: ['mainnet','sepolia','nova'], default: 'mainnet' }
    ]);
    hash = ans.hash;
  }

  display.info(`Looking up ${hash.slice(0,20)}… on ${network}…`);
  const tx = await networkService.trackTransaction(hash, network);

  if (!tx.found) {
    display.error(`Transaction not found: ${hash}`);
    return;
  }

  const statusEmoji = tx.status === 'success' ? chalk.green('✅ SUCCESS')
                    : tx.status === 'failed'  ? chalk.red('❌ FAILED')
                    : chalk.yellow('⏳ PENDING');

  console.log(chalk.bold(`\n  Transaction Lifecycle — ${network}\n`));
  console.log(`  Status:      ${statusEmoji}`);
  console.log(`  Hash:        ${chalk.gray(tx.txHash)}`);
  console.log(`  From:        ${chalk.white(tx.from || '—')}`);
  console.log(`  To:          ${chalk.white(tx.to || '—')}`);
  console.log(`  Value:       ${chalk.cyan(tx.value || '0 ETH')}`);
  console.log(`  Gas Price:   ${chalk.gray(tx.gasPrice || '—')}`);
  console.log(`  Gas Used:    ${chalk.gray(tx.gasUsed || '—')}`);
  console.log(`  Block:       ${chalk.white('#' + (tx.blockNumber || 'pending'))}`);
  console.log(`  Confirms:    ${chalk.yellow(tx.confirmations)}`);
  console.log('');

  const lc = tx.arbitrumLifecycle;
  console.log(chalk.bold('  Arbitrum L2 → L1 Lifecycle:'));
  const stage = (done, label) =>
    `  ${done ? chalk.green('✓') : chalk.gray('○')} ${done ? chalk.white(label) : chalk.gray(label)}`;
  console.log(stage(!lc.l2Pending,  'L2 Pending'));
  console.log(stage(lc.l2Confirmed, 'L2 Confirmed (mined)'));
  console.log(stage(lc.l2Safe,      'L2 Safe (10+ confirms)'));
  console.log(stage(lc.l1Batched,   'L1 Batched (included in L1)'));
  console.log(stage(lc.l1Finalized, 'L1 Finalized (challenge period expired)'));

  if (tx.challengePeriodEnd)
    console.log(`\n  Challenge Period Ends: ${chalk.gray(tx.challengePeriodEnd)}`);
  console.log(`  Explorer: ${chalk.blue(tx.explorerUrl)}\n`);
}

// ── arb network address ───────────────────────────────────────────────────────

export async function networkAddressCommand(address, opts) {
  const network = opts?.network || 'mainnet';

  if (!address) {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'address', message: 'Address (0x…):',
        validate: v => /^0x[0-9a-fA-F]{40}$/.test(v) ? true : 'Must be a valid Ethereum address' },
      { type: 'list',  name: 'network', message: 'Network:',
        choices: ['mainnet','sepolia','nova'], default: 'mainnet' }
    ]);
    address = ans.address;
  }

  display.info(`Inspecting ${address.slice(0,10)}… on ${network}…`);
  const info = await networkService.inspectAddress(address, network);

  console.log(chalk.bold(`\n  Address Info — ${info.name}\n`));
  console.log(`  Address:     ${chalk.white(info.address)}`);
  console.log(`  Type:        ${info.isContract ? chalk.yellow('📜 Smart Contract') : chalk.cyan('👤 EOA (Wallet)')}`);
  console.log(`  ETH Balance: ${chalk.cyan(info.ethBalance)}`);
  console.log(`  Nonce:       ${chalk.white(info.nonce)}`);

  const tokens = Object.entries(info.tokenBalances || {});
  if (tokens.length > 0) {
    console.log('\n  Token Balances:');
    tokens.forEach(([sym, bal]) => console.log(`    ${sym.padEnd(6)} ${chalk.yellow(bal)}`));
  } else {
    console.log(`  Tokens:      ${chalk.gray('none (or zero balance)')}`);
  }
  console.log(`\n  Explorer:    ${chalk.blue(info.explorerUrl)}`);
  console.log(`  Checked:     ${chalk.gray(info.checkedAt)}\n`);
}

// ── arb network rpc ───────────────────────────────────────────────────────────

export async function networkRpcSetCommand(opts) {
  let { network, url } = opts || {};

  if (!network || !url) {
    console.log(chalk.bold('\n  Supported RPC Providers (examples):\n'));
    [
      'Alchemy Mainnet  → https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY',
      'Alchemy Sepolia  → https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY',
      'QuickNode        → https://<endpoint>.arbitrum-mainnet.quiknode.pro/KEY/',
      'Infura Mainnet   → https://arbitrum-mainnet.infura.io/v3/YOUR_KEY',
    ].forEach(l => console.log(`  ${chalk.gray(l)}`));
    console.log('');

    const ans = await inquirer.prompt([
      { type: 'list',  name: 'network', message: 'Network:',
        choices: ['mainnet','sepolia','nova'] },
      { type: 'input', name: 'url', message: 'RPC URL:',
        validate: v => v.startsWith('http') ? true : 'Must be an HTTP/HTTPS URL' },
    ]);
    network = ans.network; url = ans.url;
  }

  display.info(`Testing connection to ${url.slice(0, 50)}…`);
  const result = await networkService.setCustomRpc(network, url);
  display.success(`Custom RPC saved for ${network}`);
  console.log(chalk.gray(`  Block: #${result.blockNumber}  Chain: ${result.chainId}  Latency: ${result.latencyMs}ms  Gas: ${result.gasPrice}`));
}

export async function networkRpcListCommand() {
  const rpcs = networkService.listCustomRpcs();
  if (rpcs.length === 0) {
    display.info('No custom RPCs set. Using default public endpoints.');
    return;
  }
  console.log(chalk.bold(`\n  Custom RPC Endpoints (${rpcs.length})\n`));
  rpcs.forEach(r => console.log(`  ${chalk.cyan(r.network.padEnd(10))} ${chalk.white(r.url)}`));
  console.log('');
}

export async function networkRpcRemoveCommand(network) {
  if (!network) {
    const rpcs = networkService.listCustomRpcs();
    if (rpcs.length === 0) { display.error('No custom RPCs configured'); return; }
    const ans = await inquirer.prompt([{
      type: 'list', name: 'network', message: 'Remove custom RPC for:',
      choices: rpcs.map(r => r.network)
    }]);
    network = ans.network;
  }
  const { removed } = networkService.removeCustomRpc(network);
  if (removed) display.success(`Custom RPC removed for ${network} — reverting to public endpoint`);
  else         display.error(`No custom RPC configured for ${network}`);
}

export async function networkRpcTestCommand(opts) {
  let { network, url } = opts || {};
  if (!network || !url) {
    const ans = await inquirer.prompt([
      { type: 'list',  name: 'network', message: 'Network:', choices: ['mainnet','sepolia','nova'] },
      { type: 'input', name: 'url', message: 'RPC URL to test:',
        validate: v => v.startsWith('http') ? true : 'Must be an HTTP/HTTPS URL' },
    ]);
    network = ans.network; url = ans.url;
  }
  display.info('Testing…');
  const r = await networkService.testRpc(network, url);
  if (r.ok) {
    display.success('RPC is reachable');
    console.log(chalk.gray(`  Block: #${r.blockNumber}  Chain: ${r.chainId}  Latency: ${r.latencyMs}ms  Gas: ${r.gasPrice}`));
    if (r.warning) console.log(chalk.yellow(`  Warning: ${r.warning}`));
  } else {
    display.error(`RPC failed: ${r.error}`);
  }
}

// ── arb network faucet ────────────────────────────────────────────────────────

export async function networkFaucetCommand() {
  const faucets = networkService.getSepoliaFaucets();

  console.log(chalk.bold('\n  Arbitrum Sepolia Faucets (Testnet ETH)\n'));
  console.log(`  ${chalk.gray('Need Sepolia ETH to test your agents? Use one of these:')}\n`);

  faucets.forEach((f, i) => {
    console.log(`  ${chalk.yellow((i + 1) + '.')} ${chalk.bold(f.name)}`);
    console.log(`     URL:         ${chalk.blue(f.url)}`);
    console.log(`     Amount:      ${chalk.cyan(f.amount)}`);
    console.log(`     Requirement: ${chalk.gray(f.requirement)}`);
    console.log(`     Daily limit: ${f.dailyLimit ? chalk.gray('Yes') : chalk.green('No')}`);
    console.log('');
  });

  console.log(`  ${chalk.gray('After getting Sepolia ETH, create a test agent with:')}`);
  console.log(`  ${chalk.white('arb agent create --network sepolia')}\n`);
}

// ── arb network txhistory ─────────────────────────────────────────────────────

export async function networkTxHistoryCommand(opts) {
  const limit   = parseInt(opts?.limit || '10');
  const history = networkService.getTxHistory(limit);

  if (history.length === 0) {
    display.info('No tracked transactions yet. Use: arb network tx <hash>');
    return;
  }

  console.log(chalk.bold(`\n  Tracked Transactions (last ${history.length})\n`));
  history.forEach(t => {
    const s = t.status === 'success' ? chalk.green('✓')
            : t.status === 'failed'  ? chalk.red('✗')
            : chalk.yellow('⏳');
    console.log(`  ${s} ${chalk.gray(t.txHash.slice(0,22))}…  ${chalk.cyan((t.network || '').padEnd(8))}  ${chalk.white((t.l2Stage || '—').padEnd(14))}  ${t.value || ''}`);
  });
  console.log('');
}

// ── Legacy compatibility (kept for existing CLI registrations) ─────────────────

export async function networkListCommand() {
  return networkStatusCommand({});
}

export async function networkInfoCommand(opts) {
  return networkStatusCommand({ network: opts?.network });
}
