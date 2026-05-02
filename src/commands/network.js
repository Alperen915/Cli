import ora from 'ora';
import chalk from 'chalk';
import { ArbitrumWallet } from '../blockchain/wallet.js';
import { display } from '../utils/display.js';
import { config } from '../utils/config.js';

export async function networkListCommand() {
  display.divider();
  console.log(chalk.bold('\n🌐 Available Arbitrum Networks\n'));

  const networks = Object.entries(config.arbitrum);
  
  for (const [key, network] of networks) {
    const wallet = new ArbitrumWallet(key);
    const spinner = ora(`Checking ${network.name}...`).start();
    
    try {
      const blockNumber = await wallet.getBlockNumber();
      spinner.stop();
      display.network(network.name, network.chainId, 'connected');
      console.log(chalk.gray(`   Block: ${blockNumber} | RPC: ${network.rpcUrl}\n`));
    } catch (error) {
      spinner.stop();
      display.network(network.name, network.chainId, 'disconnected');
      console.log(chalk.red(`   Error: ${error.message}\n`));
    }
  }
}

export async function networkInfoCommand(options) {
  const networkKey = options.network || config.defaultNetwork;
  const network = config.arbitrum[networkKey];
  
  if (!network) {
    display.error(`Unknown network: ${networkKey}`);
    display.info('Available: mainnet, sepolia, nova');
    return;
  }

  display.divider();
  console.log(chalk.bold(`\n🔗 ${network.name} Details\n`));

  const wallet = new ArbitrumWallet(networkKey);
  const spinner = ora('Fetching network data...').start();

  try {
    const blockNumber = await wallet.getBlockNumber();
    const gasPrice = await wallet.getGasPrice();
    
    spinner.succeed('Network data retrieved');
    
    display.table(
      ['Property', 'Value'],
      [
        ['Name', network.name],
        ['Chain ID', network.chainId.toString()],
        ['RPC URL', network.rpcUrl],
        ['Explorer', network.explorer],
        ['Current Block', blockNumber.toString()],
        ['Gas Price', `${gasPrice.gasPrice} Gwei`]
      ]
    );

    console.log(chalk.cyan('\n📖 Arbitrum Info:'));
    console.log(chalk.gray('  Arbitrum is an Ethereum Layer 2 scaling solution'));
    console.log(chalk.gray('  using Optimistic Rollups for low-cost, fast transactions.'));
    console.log(chalk.gray('  Learn more: https://docs.arbitrum.io\n'));
  } catch (error) {
    spinner.fail(`Failed to fetch network data: ${error.message}`);
  }
}
