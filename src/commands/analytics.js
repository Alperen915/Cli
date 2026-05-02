import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { display } from '../utils/display.js';
import { priceService } from '../services/priceService.js';
import { protocolService } from '../services/protocolService.js';
import { portfolioService } from '../services/portfolioService.js';
import { whaleService } from '../services/whaleService.js';
import { alertService } from '../services/alertService.js';
import { simulatorService } from '../services/simulatorService.js';

export async function analyticsCommand(subcommand, options = {}) {
  const commands = {
    prices: showPrices,
    price: showSinglePrice,
    tvl: showTVL,
    protocols: showProtocols,
    yields: showYields,
    gas: showGas,
    portfolio: showPortfolio,
    whales: showWhales,
    alerts: manageAlerts,
    simulate: runSimulation,
    volume: showVolume
  };

  if (!subcommand) {
    await showAnalyticsMenu();
    return;
  }

  const handler = commands[subcommand];
  if (handler) {
    await handler(options);
  } else {
    display.error(`Unknown analytics command: ${subcommand}`);
    console.log(chalk.gray('Available: prices, price, tvl, protocols, yields, gas, portfolio, whales, alerts, simulate, volume'));
  }
}

async function showAnalyticsMenu() {
  display.divider();
  console.log(chalk.bold.cyan('\n📊 Analytics Dashboard\n'));

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to analyze?',
    choices: [
      { name: '💰 Live Token Prices', value: 'prices' },
      { name: '📈 Protocol TVL & Rankings', value: 'protocols' },
      { name: '🌾 Top Yield Opportunities', value: 'yields' },
      { name: '⛽ Gas Estimator', value: 'gas' },
      { name: '💼 Portfolio Tracker', value: 'portfolio' },
      { name: '🐋 Whale Tracker', value: 'whales' },
      { name: '🔔 Price Alerts', value: 'alerts' },
      { name: '🎯 Strategy Simulator', value: 'simulate' },
      { name: '📊 DEX Volume', value: 'volume' },
      new inquirer.Separator(),
      { name: '← Back', value: 'back' }
    ]
  }]);

  if (action !== 'back') {
    await analyticsCommand(action);
  }
}

async function showPrices() {
  const spinner = ora('Fetching live prices...').start();
  
  try {
    const prices = await priceService.getAllPrices();
    spinner.stop();

    console.log(chalk.bold.cyan('\n💰 Live Arbitrum Token Prices\n'));

    const table = new Table({
      head: [chalk.white('Token'), chalk.white('Price'), chalk.white('24h Change')],
      colWidths: [15, 18, 15]
    });

    for (const token of prices) {
      const { priceStr, changeStr } = priceService.formatPrice(token.price, token.change24h);
      table.push([
        chalk.yellow(token.symbol),
        priceStr,
        changeStr
      ]);
    }

    console.log(table.toString());
    console.log(chalk.gray(`\nData from DefiLlama • Updated: ${new Date().toLocaleTimeString()}`));
  } catch (e) {
    spinner.fail('Failed to fetch prices');
    display.error(e.message);
  }
}

async function showSinglePrice(options) {
  const symbol = options.symbol || 'ETH';
  const spinner = ora(`Fetching ${symbol} price...`).start();

  try {
    const price = await priceService.getTokenPrice(symbol);
    spinner.stop();

    console.log(chalk.bold.cyan(`\n💰 ${price.name} (${price.symbol})\n`));
    
    const { priceStr, changeStr } = priceService.formatPrice(price.price, price.change24h);
    console.log(`  Price: ${chalk.bold(priceStr)}`);
    console.log(`  24h Change: ${changeStr}`);
    
    if (price.confidence) {
      console.log(`  Confidence: ${(price.confidence * 100).toFixed(1)}%`);
    }
    console.log('');
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}

async function showTVL() {
  const spinner = ora('Fetching Arbitrum TVL...').start();

  try {
    const tvl = await protocolService.getArbitrumTVL();
    spinner.stop();

    console.log(chalk.bold.cyan('\n📈 Arbitrum Chain TVL\n'));
    console.log(`  Total Value Locked: ${chalk.bold.green(protocolService.formatTVL(tvl.tvl))}`);
    
    const change1d = tvl.change1d >= 0 ? chalk.green(`+${tvl.change1d.toFixed(2)}%`) : chalk.red(`${tvl.change1d.toFixed(2)}%`);
    const change7d = tvl.change7d >= 0 ? chalk.green(`+${tvl.change7d.toFixed(2)}%`) : chalk.red(`${tvl.change7d.toFixed(2)}%`);
    
    console.log(`  24h Change: ${change1d}`);
    console.log(`  7d Change: ${change7d}`);
    console.log('');
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}

async function showProtocols() {
  const spinner = ora('Fetching top protocols...').start();

  try {
    const protocols = await protocolService.getTopArbitrumProtocols(15);
    spinner.stop();

    console.log(chalk.bold.cyan('\n🏆 Top Arbitrum Protocols by TVL\n'));

    const table = new Table({
      head: [chalk.white('#'), chalk.white('Protocol'), chalk.white('Category'), chalk.white('TVL'), chalk.white('24h')],
      colWidths: [4, 20, 15, 15, 10]
    });

    protocols.forEach((p, i) => {
      const tvl = protocolService.formatTVL(p.arbitrumTvl || p.tvl);
      const change = p.change1d >= 0 ? chalk.green(`+${p.change1d.toFixed(1)}%`) : chalk.red(`${p.change1d.toFixed(1)}%`);
      table.push([
        i + 1,
        chalk.yellow(p.name),
        p.category || 'DeFi',
        tvl,
        change
      ]);
    });

    console.log(table.toString());
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}

async function showYields() {
  const spinner = ora('Fetching yield opportunities...').start();

  try {
    const pools = await protocolService.getYieldPools(1, 500);
    spinner.stop();

    console.log(chalk.bold.cyan('\n🌾 Top Yield Opportunities on Arbitrum\n'));

    const table = new Table({
      head: [chalk.white('Pool'), chalk.white('Protocol'), chalk.white('APY'), chalk.white('TVL')],
      colWidths: [25, 15, 12, 15]
    });

    pools.slice(0, 15).forEach(pool => {
      const apy = pool.apy >= 100 
        ? chalk.yellow(`${pool.apy.toFixed(0)}%`) 
        : chalk.green(`${pool.apy.toFixed(2)}%`);
      table.push([
        pool.symbol.slice(0, 22),
        pool.project,
        apy,
        protocolService.formatTVL(pool.tvl)
      ]);
    });

    console.log(table.toString());
    console.log(chalk.red('\n⚠️  High APY = High Risk. Always DYOR!'));
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}

async function showGas(options) {
  const network = options.network || 'mainnet';
  const spinner = ora('Estimating gas costs...').start();

  try {
    const gas = await portfolioService.estimateGas(network);
    spinner.stop();

    if (gas.error) {
      display.error(gas.error);
      return;
    }

    console.log(chalk.bold.cyan(`\n⛽ Gas Estimator (${network})\n`));
    console.log(`  Current Gas Price: ${chalk.yellow(gas.gasPrice)} gwei`);
    console.log(`  Max Fee: ${chalk.yellow(gas.maxFee)} gwei`);
    console.log(`  Priority Fee: ${chalk.yellow(gas.priorityFee)} gwei`);
    console.log(`  ETH Price: ${chalk.green('$' + gas.ethPrice.toFixed(2))}`);

    console.log(chalk.bold('\n  Estimated Costs:'));
    console.log(`    ETH Transfer: ${chalk.green('$' + gas.estimates.transfer.cost.toFixed(4))}`);
    console.log(`    Token Transfer: ${chalk.green('$' + gas.estimates.erc20Transfer.cost.toFixed(4))}`);
    console.log(`    Swap: ${chalk.green('$' + gas.estimates.swap.cost.toFixed(4))}`);
    console.log(`    Add Liquidity: ${chalk.green('$' + gas.estimates.addLiquidity.cost.toFixed(4))}`);
    console.log(`    Deploy Contract: ${chalk.green('$' + gas.estimates.contractDeploy.cost.toFixed(4))}`);

    console.log(chalk.gray(`\n  💡 Arbitrum L2 fees are 10-100x cheaper than Ethereum mainnet`));
    console.log('');
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}

async function showPortfolio(options) {
  const address = options.address;
  
  if (!address) {
    const { walletAddress } = await inquirer.prompt([{
      type: 'input',
      name: 'walletAddress',
      message: 'Enter wallet address to track:',
      validate: input => /^0x[a-fA-F0-9]{40}$/.test(input) || 'Invalid address format'
    }]);
    options.address = walletAddress;
  }

  const spinner = ora('Scanning wallet...').start();

  try {
    const portfolio = await portfolioService.getFullPortfolio(options.address, options.network || 'mainnet');
    spinner.stop();

    console.log(chalk.bold.cyan('\n💼 Portfolio Overview\n'));
    console.log(`  Address: ${chalk.gray(portfolio.address)}`);
    console.log(`  Network: ${chalk.yellow(portfolio.network)}`);

    if (portfolio.holdings.length === 0) {
      console.log(chalk.gray('\n  No token holdings found.'));
      return;
    }

    const table = new Table({
      head: [chalk.white('Token'), chalk.white('Balance'), chalk.white('Price'), chalk.white('Value'), chalk.white('24h')],
      colWidths: [10, 15, 12, 15, 10]
    });

    for (const h of portfolio.holdings) {
      const change = h.change24h >= 0 ? chalk.green(`+${h.change24h?.toFixed(1) || 0}%`) : chalk.red(`${h.change24h?.toFixed(1) || 0}%`);
      table.push([
        chalk.yellow(h.symbol),
        portfolioService.formatBalance(h.balance),
        '$' + (h.price?.toFixed(2) || '0'),
        chalk.green('$' + (h.value?.toFixed(2) || '0')),
        change
      ]);
    }

    console.log(table.toString());

    const totalChange = portfolio.change24h >= 0 
      ? chalk.green(`+${portfolio.change24h.toFixed(2)}%`)
      : chalk.red(`${portfolio.change24h.toFixed(2)}%`);
    
    console.log(`\n  💰 Total Value: ${chalk.bold.green('$' + portfolio.totalValue.toFixed(2))} (${totalChange})`);
    console.log('');
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}

async function showWhales(options) {
  const network = options.network || 'mainnet';
  const spinner = ora('Scanning for whale activity...').start();

  try {
    const whaleData = await whaleService.getRecentLargeTransactions(network, 10);
    spinner.stop();

    if (whaleData.error) {
      display.error(whaleData.error);
      return;
    }

    console.log(chalk.bold.cyan('\n🐋 Recent Whale Transactions\n'));
    console.log(chalk.gray(`  Threshold: ${whaleData.threshold.eth} ETH / $${whaleData.threshold.usd}`));
    console.log(chalk.gray(`  ETH Price: $${whaleData.ethPrice.toFixed(2)}\n`));

    if (whaleData.transactions.length === 0) {
      console.log(chalk.gray('  No recent whale transactions found.'));
      return;
    }

    const table = new Table({
      head: [chalk.white('Value (ETH)'), chalk.white('Value (USD)'), chalk.white('Type'), chalk.white('Time')],
      colWidths: [15, 18, 20, 22]
    });

    for (const tx of whaleData.transactions) {
      table.push([
        chalk.yellow(tx.valueEth),
        chalk.green('$' + tx.valueUsd),
        tx.type.replace(/_/g, ' '),
        new Date(tx.timestamp).toLocaleString()
      ]);
    }

    console.log(table.toString());
    console.log(chalk.gray(`\n  Scanned ${whaleData.scannedBlocks} recent blocks`));
    console.log('');
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}

async function manageAlerts(options) {
  if (options.list) {
    const alerts = alertService.getAlerts();
    console.log(chalk.bold.cyan('\n🔔 Your Alerts\n'));
    
    if (alerts.length === 0) {
      console.log(chalk.gray('  No alerts configured.'));
      return;
    }

    alerts.forEach(alert => {
      console.log(`  ${alertService.formatAlert(alert)}`);
      console.log(chalk.gray(`    ID: ${alert.id}`));
    });
    return;
  }

  if (options.check) {
    const spinner = ora('Checking alerts...').start();
    const triggered = await alertService.checkAlerts();
    spinner.stop();

    if (triggered.length === 0) {
      console.log(chalk.gray('\nNo alerts triggered.'));
    } else {
      console.log(chalk.bold.yellow('\n🔔 Triggered Alerts:\n'));
      triggered.forEach(alert => {
        console.log(chalk.yellow(`  ⚡ ${alert.message}`));
      });
    }
    return;
  }

  if (options.clear) {
    alertService.clearAllAlerts();
    display.success('All alerts cleared.');
    return;
  }

  // Interactive alert creation
  const { alertType } = await inquirer.prompt([{
    type: 'list',
    name: 'alertType',
    message: 'What type of alert?',
    choices: [
      { name: 'Price reaches target', value: 'price' },
      { name: 'Price changes by percentage', value: 'percentage' },
      { name: 'View existing alerts', value: 'view' },
      { name: 'Check alerts now', value: 'check' }
    ]
  }]);

  if (alertType === 'view') {
    await manageAlerts({ list: true });
    return;
  }

  if (alertType === 'check') {
    await manageAlerts({ check: true });
    return;
  }

  if (alertType === 'price') {
    const { symbol, condition, target } = await inquirer.prompt([
      { type: 'input', name: 'symbol', message: 'Token symbol:', default: 'ETH' },
      { type: 'list', name: 'condition', message: 'Alert when price is:', choices: ['above', 'below'] },
      { type: 'number', name: 'target', message: 'Target price ($):' }
    ]);

    const alert = alertService.createPriceAlert(symbol, condition, target);
    display.success(`Alert created: ${symbol} ${condition} $${target}`);
  }

  if (alertType === 'percentage') {
    const { symbol, percent } = await inquirer.prompt([
      { type: 'input', name: 'symbol', message: 'Token symbol:', default: 'ETH' },
      { type: 'number', name: 'percent', message: 'Alert when 24h change exceeds (%):', default: 10 }
    ]);

    const alert = alertService.createPercentageAlert(symbol, percent);
    display.success(`Alert created: ${symbol} moves ${percent}% in 24h`);
  }
}

async function runSimulation(options) {
  console.log(chalk.bold.cyan('\n🎯 Strategy Simulator\n'));

  const strategies = simulatorService.getAvailableStrategies();

  const { strategy } = await inquirer.prompt([{
    type: 'list',
    name: 'strategy',
    message: 'Select a strategy to simulate:',
    choices: strategies.map(s => ({ name: `${s.name}: ${s.description}`, value: s.name }))
  }]);

  const { symbol, investment } = await inquirer.prompt([
    { type: 'input', name: 'symbol', message: 'Token to simulate:', default: 'ETH' },
    { type: 'number', name: 'investment', message: 'Investment amount ($):', default: 1000 }
  ]);

  const spinner = ora('Running simulation...').start();

  try {
    const result = await simulatorService.runSimulation(strategy, {
      symbol,
      totalInvestment: investment
    });
    spinner.stop();

    console.log(chalk.bold.cyan(`\n📊 ${result.strategy} Simulation\n`));
    console.log(chalk.gray(`  Token: ${result.symbol}`));
    
    console.log(chalk.bold('\n  Parameters:'));
    for (const [key, value] of Object.entries(result.params)) {
      console.log(`    ${key}: ${value}`);
    }

    console.log(chalk.bold('\n  Results:'));
    for (const [key, value] of Object.entries(result.results)) {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      const color = key.includes('pnl') && parseFloat(value) < 0 ? chalk.red : chalk.green;
      console.log(`    ${label}: ${color(value)}`);
    }

    console.log(chalk.bold.yellow(`\n  💡 ${result.analysis}`));
    console.log(chalk.red('\n  ⚠️  Simulations use historical/simulated data. Past performance ≠ future results.'));
    console.log('');
  } catch (e) {
    spinner.fail('Simulation failed');
    display.error(e.message);
  }
}

async function showVolume() {
  const spinner = ora('Fetching DEX volumes...').start();

  try {
    const volume = await protocolService.getDexVolume();
    spinner.stop();

    if (volume.error) {
      display.error(volume.error);
      return;
    }

    console.log(chalk.bold.cyan('\n📊 Arbitrum DEX Volume\n'));
    console.log(`  24h Volume: ${chalk.bold.green(protocolService.formatTVL(volume.total24h))}`);
    console.log(`  7d Volume: ${chalk.bold.green(protocolService.formatTVL(volume.total7d))}`);

    if (volume.protocols.length > 0) {
      console.log(chalk.bold('\n  Top DEXs by Volume:'));
      const table = new Table({
        head: [chalk.white('DEX'), chalk.white('24h Volume'), chalk.white('Change')],
        colWidths: [20, 18, 12]
      });

      volume.protocols.forEach(p => {
        const change = p.change24h >= 0 
          ? chalk.green(`+${p.change24h?.toFixed(1) || 0}%`)
          : chalk.red(`${p.change24h?.toFixed(1) || 0}%`);
        table.push([
          chalk.yellow(p.name),
          protocolService.formatTVL(p.volume24h),
          change
        ]);
      });

      console.log(table.toString());
    }
    console.log('');
  } catch (e) {
    spinner.fail('Failed');
    display.error(e.message);
  }
}
