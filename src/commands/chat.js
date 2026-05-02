import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { agentManager } from '../agents/agentManager.js';
import { display } from '../utils/display.js';

const COMMANDS = {
  '/clear':      'Clear agent memory',
  '/info':       'Show agent info',
  '/wallet':     'Show wallet status',
  '/portfolio':  'Show on-chain portfolio',
  '/quote <tokenIn> <tokenOut> <amount>':   'Get Uniswap V3 quote',
  '/lifi <tokenIn> <tokenOut> <amountWei>': 'Get multi-DEX LiFi quote (free)',
  '/swap <tokenIn> <tokenOut> <amount>':    'Execute swap (wallet required)',
  '/intent <prompt>':                        'Natural language → tx (Brian API)',
  '/strategy list':                          'List all strategies',
  '/strategy dca <token> <amount> <hours>':  'Add DCA strategy',
  '/strategy stop-loss <token> <pct>':       'Add stop-loss',
  '/strategy take-profit <token> <pct>':     'Add take-profit',
  '/strategy run':                           'Trigger strategy check now',
  '/policy':     'Show policy / spending limits',
  '/policy pause':                           'Pause all agent transactions',
  '/policy resume':                          'Resume agent transactions',
  '/loop start [dryRun=true]':              'Start autonomous trading loop',
  '/loop stop':                              'Stop autonomous loop',
  '/loop status':                            'Show loop status',
  '/help':       'Show commands',
  'exit':        'Exit chat'
};

export async function chatCommand() {
  const agent = agentManager.getActiveAgent();

  if (!agent) {
    display.error('No active agent. Create or select one first.');
    display.info('Use: arb agent create');
    return;
  }

  display.divider();
  console.log(chalk.bold(`\n💬 Chat with ${chalk.cyan(agent.name)} (${agent.type} agent)\n`));
  if (agent.hasWallet()) {
    console.log(chalk.green(`  Wallet: ${agent.getAddress()} [${agent.network}]`));
  } else {
    console.log(chalk.gray('  No wallet connected (read-only mode)'));
  }
  if (agent.hasAI()) {
    console.log(chalk.green(`  AI: ${agent.aiProvider} / ${agent.aiModel}`));
  } else {
    console.log(chalk.yellow('  AI: not configured (use /config set to connect)'));
  }
  console.log(chalk.gray('\n  Type /help for commands, "exit" to quit.\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question(chalk.green('You: '), async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      // ── Built-in commands ─────────────────────────────────────────────────

      if (trimmed.toLowerCase() === 'exit') {
        if (agent._loop?.running) agent.stopAutonomousLoop();
        console.log(chalk.gray('\nGoodbye!\n'));
        rl.close();
        return;
      }

      if (trimmed === '/clear') {
        agent.clearMemory();
        display.success('Agent memory cleared.');
        prompt(); return;
      }

      if (trimmed === '/info') {
        const info = agent.getInfo();
        display.agentCard(info);
        if (info.walletConnected) {
          console.log(chalk.green(`  Wallet: ${info.walletAddress}`));
        }
        if (info.loopRunning) {
          console.log(chalk.cyan(`  Loop: running (${agent.getLoopStatus().cycles} cycles)`));
        }
        prompt(); return;
      }

      if (trimmed === '/wallet') {
        if (!agent.hasWallet()) {
          console.log(chalk.yellow('\n  No wallet connected.'));
          console.log(chalk.gray('  To connect: use "arb wallet connect" or agent.attachWallet(privateKey) in SDK.\n'));
        } else {
          const spinner = ora('Fetching balance...').start();
          try {
            const bal = await agent.getEthBalance();
            spinner.stop();
            console.log(chalk.green(`\n  Address: ${agent.getAddress()}`));
            console.log(chalk.green(`  Network: ${agent.network}`));
            console.log(chalk.white(`  ETH Balance: ${parseFloat(bal.formatted).toFixed(6)} ETH\n`));
          } catch (err) {
            spinner.fail(err.message);
          }
        }
        prompt(); return;
      }

      if (trimmed === '/portfolio') {
        if (!agent.hasWallet()) {
          display.warning('No wallet connected. Use "arb wallet connect" first.');
          prompt(); return;
        }
        const spinner = ora('Fetching portfolio...').start();
        try {
          const data = await agent.getPortfolio();
          spinner.stop();
          console.log(chalk.bold(`\n  Portfolio — ${agent.getAddress()}`));
          console.log(chalk.white(`  ETH: ${parseFloat(data.ETH.formatted).toFixed(6)}`));
          for (const [sym, info] of Object.entries(data.tokens || {})) {
            console.log(chalk.white(`  ${sym}: ${parseFloat(info.formatted).toFixed(4)}`));
          }
          console.log('');
        } catch (err) {
          spinner.fail(err.message);
        }
        prompt(); return;
      }

      if (trimmed.startsWith('/quote ')) {
        const parts = trimmed.split(' ');
        if (parts.length < 4) {
          display.error('Usage: /quote <tokenIn> <tokenOut> <amount>');
          prompt(); return;
        }
        const [, tokenIn, tokenOut, amount] = parts;
        const spinner = ora(`Getting quote ${tokenIn} → ${tokenOut}...`).start();
        try {
          const q = await agent.getSwapQuote(tokenIn, tokenOut, amount);
          spinner.stop();
          console.log(chalk.bold(`\n  Quote: ${amount} ${tokenIn} → ${q.amountOut} ${tokenOut}`));
          console.log(chalk.gray(`  Price: 1 ${tokenIn} = ${q.price} ${tokenOut}`));
          console.log(chalk.gray(`  Fee tier: ${q.fee}\n`));
        } catch (err) {
          spinner.fail(err.message);
        }
        prompt(); return;
      }

      if (trimmed.startsWith('/swap ')) {
        const parts = trimmed.split(' ');
        if (parts.length < 4) {
          display.error('Usage: /swap <tokenIn> <tokenOut> <amount>');
          prompt(); return;
        }
        if (!agent.hasWallet()) {
          display.error('No wallet connected. Use "arb wallet connect" first.');
          prompt(); return;
        }
        const [, tokenIn, tokenOut, amount] = parts;
        const spinner = ora(`Executing swap ${tokenIn} → ${tokenOut}...`).start();
        try {
          const result = await agent.executeSwap(tokenIn, tokenOut, amount);
          spinner.succeed('Swap executed!');
          console.log(chalk.green(`\n  ${amount} ${tokenIn} → ${result.amountOut} ${tokenOut}`));
          console.log(chalk.gray(`  Tx: ${result.txHash}`));
          console.log(chalk.cyan(`  Explorer: ${result.explorer}\n`));
        } catch (err) {
          spinner.fail(err.message);
        }
        prompt(); return;
      }

      // ── LiFi multi-DEX quote ──────────────────────────────────────────────

      if (trimmed.startsWith('/lifi ')) {
        const parts = trimmed.split(' ');
        if (parts.length < 4) {
          display.error('Usage: /lifi <fromToken> <toToken> <amountWei>');
          prompt(); return;
        }
        const [, fromToken, toToken, amountWei] = parts;
        const spinner = ora(`LiFi quote: ${fromToken} → ${toToken}...`).start();
        try {
          const q = await agent.lifiQuote(fromToken, toToken, amountWei);
          spinner.stop();
          console.log(chalk.bold(`\n  LiFi Quote: ${fromToken} → ${toToken}`));
          console.log(chalk.white(`  Input:  ${amountWei} (wei)`));
          console.log(chalk.white(`  Output: ${q.toAmount || 'N/A'}`));
          if (q.toAmountMin) console.log(chalk.gray(`  Min:    ${q.toAmountMin}`));
          if (q.tool)        console.log(chalk.gray(`  Solver: ${q.tool}`));
          if (q.gasCostUSD)  console.log(chalk.gray(`  Gas:    ~$${parseFloat(q.gasCostUSD).toFixed(2)}\n`));
          else               console.log('');
        } catch (err) {
          spinner.fail(err.message);
        }
        prompt(); return;
      }

      // ── Brian API — Natural Language Intent ───────────────────────────────

      if (trimmed.startsWith('/intent ')) {
        const intentPrompt = trimmed.slice('/intent '.length).trim();
        if (!intentPrompt) {
          display.error('Usage: /intent <natural language prompt>');
          display.info('Example: /intent Swap 0.01 ETH to USDC');
          prompt(); return;
        }
        if (!agent.hasBrian()) {
          display.error('Brian API key not set. Set BRIAN_API_KEY environment variable.');
          display.info('Get a free key at: https://brianknows.org');
          prompt(); return;
        }
        const spinner = ora(`Building transaction: "${intentPrompt}"...`).start();
        try {
          const results = await agent.buildIntent(intentPrompt);
          spinner.stop();
          console.log(chalk.bold(`\n  Intent: ${intentPrompt}`));
          results.forEach((r, i) => {
            console.log(chalk.cyan(`\n  [${i + 1}] ${r.action?.toUpperCase() || 'TX'} via ${r.solver || 'solver'}`));
            if (r.description) console.log(chalk.gray(`  ${r.description}`));
            if (r.fromToken && r.toToken) {
              console.log(chalk.white(`  ${r.fromAmount || '?'} ${r.fromToken.symbol || r.fromToken} → ${r.toAmount || '?'} ${r.toToken.symbol || r.toToken}`));
            }
            if (r.gasCost)  console.log(chalk.gray(`  Est. Gas: $${parseFloat(r.gasCost).toFixed(2)}`));
            if (r.transaction) {
              console.log(chalk.green(`  ✔ Calldata ready`));
              console.log(chalk.gray(`  To: ${r.transaction.to}`));
              if (!agent.hasWallet()) {
                display.info('Attach wallet to execute: arb wallet connect');
              } else {
                display.info('Use /intent-exec to execute this transaction');
              }
            }
          });
          console.log('');
        } catch (err) {
          spinner.fail(err.message);
        }
        prompt(); return;
      }

      // ── Strategy commands ─────────────────────────────────────────────────

      if (trimmed.startsWith('/strategy')) {
        const parts = trimmed.split(' ');
        const sub   = parts[1];

        if (sub === 'list') {
          const list = agent.strategyEngine.list();
          if (!list.length) {
            console.log(chalk.gray('\n  No strategies configured.\n'));
          } else {
            console.log(chalk.bold(`\n  Strategies (${list.length}):`));
            for (const s of list) {
              const status = s.enabled ? chalk.green('✔ active') : chalk.gray('◦ paused');
              const runs   = s.runCount > 0 ? chalk.gray(` [${s.runCount} runs]`) : '';
              console.log(`  ${status}  ${chalk.white(s.name)} ${chalk.gray(s.type)}${runs}`);
              if (s.lastRun) console.log(chalk.gray(`         Last run: ${new Date(s.lastRun).toLocaleString()}`));
            }
            console.log('');
          }

        } else if (sub === 'dca') {
          // /strategy dca ETH 10 24
          const [,, token = 'ETH', amount = '10', hours = '24'] = parts;
          const s = agent.strategyEngine.addDCA({
            token, quoteToken: 'USDC', amount, intervalHours: parseFloat(hours), dryRun: true
          });
          display.success(`DCA strategy added: buy ${amount} USDC worth of ${token} every ${hours}h (dry-run)`);
          console.log(chalk.gray(`  ID: ${s.id}\n`));

        } else if (sub === 'stop-loss') {
          // /strategy stop-loss ETH 10
          const [,, token = 'ETH', pct = '10'] = parts;
          const s = agent.strategyEngine.addStopLoss({
            token, lossPercent: parseFloat(pct), currentPrice: null, dryRun: true
          });
          display.success(`Stop-loss added: sell ${token} if down ${pct}% (dry-run)`);
          console.log(chalk.gray(`  ID: ${s.id}\n`));

        } else if (sub === 'take-profit') {
          // /strategy take-profit ETH 20
          const [,, token = 'ETH', pct = '20'] = parts;
          const s = agent.strategyEngine.addTakeProfit({
            token, profitPercent: parseFloat(pct), currentPrice: null, dryRun: true
          });
          display.success(`Take-profit added: sell ${token} if up ${pct}% (dry-run)`);
          console.log(chalk.gray(`  ID: ${s.id}\n`));

        } else if (sub === 'run') {
          const spinner = ora('Checking strategies...').start();
          try {
            const prices    = await agent.strategyEngine._fetchPrices();
            const triggered = await agent.strategyEngine.runNow(prices);
            spinner.stop();
            console.log(chalk.bold(`\n  Current Prices:`));
            for (const [sym, price] of Object.entries(prices)) {
              console.log(chalk.white(`  ${sym.padEnd(6)} $${price.toLocaleString()}`));
            }
            console.log(chalk.cyan(`\n  Triggered: ${triggered} / ${agent.strategyEngine.strategies.size} strategies\n`));
          } catch (err) {
            spinner.fail(err.message);
          }

        } else {
          console.log(chalk.gray('\n  /strategy list                     - View all strategies'));
          console.log(chalk.gray('  /strategy dca ETH 10 24            - Buy $10 ETH every 24h'));
          console.log(chalk.gray('  /strategy stop-loss ETH 10         - Sell ETH if down 10%'));
          console.log(chalk.gray('  /strategy take-profit ETH 20       - Sell ETH if up 20%'));
          console.log(chalk.gray('  /strategy run                      - Check conditions now\n'));
        }
        prompt(); return;
      }

      // ── Policy commands ───────────────────────────────────────────────────

      if (trimmed.startsWith('/policy')) {
        const sub = trimmed.split(' ')[1];

        if (sub === 'pause') {
          agent.policy.pause();
          display.warning('Policy PAUSED — all transactions blocked.');

        } else if (sub === 'resume') {
          agent.policy.resume();
          display.success('Policy RESUMED — transactions allowed.');

        } else {
          const status = agent.policy.getStatus();
          console.log(chalk.bold('\n  Policy / Spending Limits:'));
          console.log(`  Status:         ${status.paused ? chalk.red('PAUSED') : chalk.green('active')}`);
          console.log(`  Max tx size:    ${chalk.white(status.maxTxSizeEth)} ETH`);
          console.log(`  Max hourly:     ${chalk.white(status.maxHourlySpendEth)} ETH (spent: ${status.hourlySpent})`);
          console.log(`  Max daily:      ${chalk.white(status.maxDailySpendEth)} ETH (spent: ${status.dailySpent})`);
          console.log(`  Max slippage:   ${chalk.white(status.maxSlippageBps / 100)}%`);
          console.log(`  Interest-free:  ${status.interestFreeMode ? chalk.yellow('yes') : chalk.gray('no')}`);
          if (status.allowedTokens)
            console.log(`  Allowed tokens: ${chalk.white(status.allowedTokens.join(', '))}`);
          console.log(`  Tx count (24h): ${chalk.white(status.txCount24h)}\n`);
        }
        prompt(); return;
      }

      if (trimmed.startsWith('/loop')) {
        const sub = trimmed.split(' ')[1];

        if (sub === 'start') {
          const dryRun = !trimmed.includes('dryRun=false');
          try {
            const loop = agent.startAutonomousLoop({
              dryRun,
              intervalMs: 30000,
              strategy: 'balanced'
            });
            loop.on('decision', d => {
              console.log(chalk.cyan(`\n  [Loop] Cycle ${d.cycle}: ${d.thought}`));
              console.log(chalk.gray(`  → ${d.action}: ${d.reasoning}\n`));
            });
            loop.on('action', a => {
              console.log(chalk.green(`\n  [Loop] Action: ${a.type} [${a.mode || 'N/A'}]`));
              if (a.result?.txHash) console.log(chalk.gray(`  Tx: ${a.result.txHash}`));
              console.log('');
            });
            loop.on('error', e => {
              console.log(chalk.red(`\n  [Loop Error] ${e.error}\n`));
            });
            display.success(`Autonomous loop started (${dryRun ? 'SIMULATION' : 'LIVE'} mode, 30s interval)`);
            if (dryRun) display.info('Using dry-run mode. Add "dryRun=false" for real transactions.');
          } catch (err) {
            display.error(err.message);
          }

        } else if (sub === 'stop') {
          agent.stopAutonomousLoop();
          display.success('Autonomous loop stopped.');

        } else if (sub === 'status') {
          const status = agent.getLoopStatus();
          if (!status.running) {
            console.log(chalk.gray('\n  Loop is not running.\n'));
          } else {
            console.log(chalk.bold(`\n  Loop Status:`));
            console.log(`  Running: ${chalk.green('yes')}`);
            console.log(`  Mode: ${status.dryRun ? chalk.yellow('simulation') : chalk.red('LIVE')}`);
            console.log(`  Cycles: ${status.cycles}`);
            console.log(`  Strategy: ${status.strategy}\n`);
          }

        } else {
          console.log(chalk.gray('\n  /loop start          - Start (simulation mode)'));
          console.log(chalk.gray('  /loop start dryRun=false - Start LIVE mode'));
          console.log(chalk.gray('  /loop stop           - Stop loop'));
          console.log(chalk.gray('  /loop status         - Show status\n'));
        }
        prompt(); return;
      }

      if (trimmed === '/help') {
        console.log(chalk.bold('\n  Commands:'));
        for (const [cmd, desc] of Object.entries(COMMANDS)) {
          console.log(`  ${chalk.cyan(cmd.padEnd(42))} ${chalk.gray(desc)}`);
        }
        console.log('');
        prompt(); return;
      }

      // ── AI Chat ───────────────────────────────────────────────────────────

      const spinner = ora('Thinking...').start();
      try {
        const response = await agent.chat(trimmed);
        spinner.stop();
        console.log('');
        display.agent(response.thought || response.message || JSON.stringify(response));

        if (response.action && !['none', 'error'].includes(response.action)) {
          console.log(chalk.yellow(`  → Action: ${response.action}`));
        }
        if (response.reasoning)  console.log(chalk.gray(`  💭 ${response.reasoning}`));
        if (response.execution) {
          console.log(chalk.green(`  ✔ Executed: ${response.execution.txHash || 'N/A'}`));
          if (response.execution.explorer) console.log(chalk.cyan(`  Explorer: ${response.execution.explorer}`));
        }
        if (response.executionError) console.log(chalk.red(`  ✖ Error: ${response.executionError}`));

        for (const key of ['steps','dexes','protocols','strategies','tools','options','features','links','risks','halalOptions']) {
          if (Array.isArray(response[key])) {
            const labels = { steps:'Steps', dexes:'DEXs', protocols:'Protocols', strategies:'Strategies',
              tools:'Tools', options:'Options', features:'Features', links:'Links', risks:'⚠️ Risks', halalOptions:'Halal Options' };
            console.log(chalk.cyan(`\n  ${labels[key] || key}:`));
            response[key].forEach(i => console.log(chalk.white(`     ${i}`)));
          }
        }
        if (response.warning) console.log(chalk.red(`\n  ⚠️  ${response.warning}`));
        if (response.tip)     console.log(chalk.green(`\n  💡 ${response.tip}`));
        if (response.method)  console.log(chalk.cyan(`\n  Method: ${response.method}`));
        console.log('');

      } catch (error) {
        spinner.fail('Error');
        display.error(error.message);
      }

      prompt();
    });
  };

  prompt();
}
