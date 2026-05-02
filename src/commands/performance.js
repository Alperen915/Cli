import chalk   from 'chalk';
import { performanceService } from '../services/performanceService.js';
import { storage }            from '../utils/storage.js';
import { display }            from '../utils/display.js';

function getActive(opts) {
  const name = opts?.agent || storage.loadActiveAgent();
  if (!name) throw new Error('No active agent. Run: arb agent select');
  return name;
}

function bar(value, max, width = 20, color = 'green') {
  const pct   = max > 0 ? Math.min(1, Math.abs(value) / Math.abs(max)) : 0;
  const filled = Math.round(pct * width);
  const empty  = width - filled;
  const b      = chalk[value >= 0 ? color : 'red']('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return b;
}

// ── arb perf show ─────────────────────────────────────────────────────────────

export async function perfShowCommand(opts) {
  const name = getActive(opts);
  const s    = performanceService.getSummary(name);

  console.log(chalk.bold(`\n  ╔══════════════════════════════════════════╗`));
  console.log(chalk.bold(`  ║   Performance Dashboard — ${name.padEnd(14)} ║`));
  console.log(chalk.bold(`  ╚══════════════════════════════════════════╝\n`));

  // Overview
  const pnlColor = s.totalRealizedPnL >= 0 ? 'green' : 'red';
  const roiColor = s.roi >= 0 ? 'green' : 'red';
  console.log(`  Total Trades    ${chalk.yellow(s.totalTrades)}   (${chalk.cyan(s.buyCount)} buys / ${chalk.cyan(s.sellCount)} sells)`);
  console.log(`  Win Rate        ${chalk[s.winRate >= 50 ? 'green' : 'red'](s.winRate.toFixed(1) + '%')}  (${s.winCount}W / ${s.lossCount}L)`);
  console.log(`  Invested        ${chalk.white('$' + s.totalInvestedUSD.toLocaleString())}`);
  console.log(`  Realized P&L    ${chalk[pnlColor]((s.totalRealizedPnL >= 0 ? '+' : '') + '$' + s.totalRealizedPnL.toFixed(2))}`);
  console.log(`  ROI             ${chalk[roiColor]((s.roi >= 0 ? '+' : '') + s.roi.toFixed(2) + '%')}`);
  console.log('');

  // Best / Worst
  if (s.bestTrade) {
    console.log(`  Best Trade      ${chalk.green('+$' + s.bestTrade.pnl.toFixed(2))}  ${chalk.gray(s.bestTrade.token)} ${chalk.gray(s.bestTrade.ts.slice(0,10))}`);
  }
  if (s.worstTrade) {
    console.log(`  Worst Trade     ${chalk.red('$' + s.worstTrade.pnl.toFixed(2))}  ${chalk.gray(s.worstTrade.token)} ${chalk.gray(s.worstTrade.ts.slice(0,10))}`);
  }

  // Open positions
  if (s.openPositions.length > 0) {
    console.log('');
    console.log(chalk.bold('  Open Positions:'));
    for (const p of s.openPositions) {
      console.log(`    ${chalk.cyan(p.token.padEnd(6))}  amt: ${chalk.white(p.amount.toFixed(4))}  avg cost: $${p.avgCost.toFixed(4)}`);
    }
  }

  // Strategy breakdown
  const strategies = Object.entries(s.byStrategy);
  if (strategies.length > 0) {
    console.log('');
    console.log(chalk.bold('  Strategy Breakdown:'));
    const maxPnl = Math.max(...strategies.map(([, v]) => Math.abs(v.pnl)));
    for (const [type, data] of strategies) {
      const col  = data.pnl >= 0 ? 'green' : 'red';
      const sign = data.pnl >= 0 ? '+' : '';
      console.log(`    ${type.padEnd(16)} triggers: ${chalk.yellow(String(data.count).padStart(3))}  P&L: ${chalk[col](sign + '$' + data.pnl.toFixed(2))}  ${bar(data.pnl, maxPnl)}`);
    }
  }

  console.log('');
  console.log(chalk.gray(`  Updated: ${s.lastUpdated.slice(0,19).replace('T',' ')}`));
  console.log('');
}

// ── arb perf history ─────────────────────────────────────────────────────────

export async function perfHistoryCommand(opts) {
  const name  = getActive(opts);
  const limit = parseInt(opts.limit || '20');
  const type  = opts.type || null;
  const items = performanceService.getHistory(name, limit, type);

  if (items.length === 0) {
    display.info(`No performance entries for "${name}" yet.`);
    display.info('Entries are logged automatically when strategies fire or trades execute.');
    return;
  }

  console.log(chalk.bold(`\n  Performance History — ${name} (${items.length} entries)\n`));

  for (const e of items) {
    const ts   = e.timestamp.slice(0, 19).replace('T', ' ');
    const icon = e.type === 'trade'
      ? (e.side === 'BUY' ? chalk.green('▲') : chalk.red('▼'))
      : (e.type === 'strategy_trigger' ? chalk.cyan('⚡') : chalk.gray('◆'));

    let line = `  ${icon} ${chalk.gray(ts)}  ${chalk.cyan(e.type.padEnd(18))}`;
    if (e.token) line += `  ${chalk.white(e.token.padEnd(6))}`;
    if (e.side)  line += `  ${e.side === 'BUY' ? chalk.green('BUY') : chalk.red('SELL')}`;
    if (e.amountUSD) line += `  $${e.amountUSD.toFixed(2)}`;
    if (e.pnl !== null) {
      const pnlStr = (e.pnl >= 0 ? '+' : '') + '$' + e.pnl.toFixed(2);
      line += `  P&L: ${chalk[e.pnl >= 0 ? 'green' : 'red'](pnlStr)}`;
    }
    if (e.strategyType) line += chalk.gray(`  [${e.strategyType}]`);
    console.log(line);
    if (e.note) console.log(`         ${chalk.gray(e.note.slice(0,90))}`);
  }
  console.log('');
}

// ── arb perf daily ────────────────────────────────────────────────────────────

export async function perfDailyCommand(opts) {
  const name = getActive(opts);
  const days = parseInt(opts.days || '14');
  const data = performanceService.getDailyPnL(name, days);

  if (data.length === 0) {
    display.info(`No daily P&L data for "${name}" in the last ${days} days.`);
    return;
  }

  console.log(chalk.bold(`\n  Daily P&L — ${name} (last ${days} days)\n`));

  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  for (const d of data) {
    const pnlStr = (d.pnl >= 0 ? '+' : '') + '$' + d.pnl.toFixed(2);
    console.log(`  ${chalk.gray(d.date)}  ${bar(d.pnl, maxAbs, 25)}  ${chalk[d.pnl >= 0 ? 'green' : 'red'](pnlStr.padStart(12))}  ${chalk.gray(d.trades + ' trades')}`);
  }

  const total = data.reduce((s, d) => s + d.pnl, 0);
  const sign  = total >= 0 ? '+' : '';
  console.log('');
  console.log(`  Total (${days}d)    ${chalk[total >= 0 ? 'green' : 'red'](sign + '$' + total.toFixed(2))}`);
  console.log('');
}

// ── arb perf log (manual entry — for testing / demo) ─────────────────────────

export async function perfLogCommand(opts) {
  const name = getActive(opts);
  const entry = performanceService.logTrade(name, {
    token:       opts.token   || 'ETH',
    side:        opts.side    || 'BUY',
    amountToken: parseFloat(opts.amount || '0.1'),
    amountUSD:   parseFloat(opts.usd    || '350'),
    priceUSD:    parseFloat(opts.price  || '3500'),
    note:        opts.note    || 'Manual entry',
    dryRun:      true
  });
  display.success(`Entry logged: ${entry.id}`);
  console.log(chalk.gray(`  type: ${entry.type}  token: ${entry.token}  side: ${entry.side}`));
  if (entry.pnl !== null) console.log(chalk.gray(`  pnl: ${entry.pnl.toFixed(4)}`));
}

// ── arb perf reset ────────────────────────────────────────────────────────────

export async function perfResetCommand(opts) {
  const name = getActive(opts);
  performanceService.reset(name);
  display.success(`Performance ledger cleared for "${name}"`);
}
