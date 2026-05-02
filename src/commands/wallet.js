import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { ArbitrumWallet } from '../blockchain/wallet.js';
import { display } from '../utils/display.js';
import { config } from '../utils/config.js';

let currentWallet = null;

export async function walletStatusCommand(options) {
  const network = options.network || config.defaultNetwork;
  const wallet = new ArbitrumWallet(network);
  
  display.divider();
  console.log(chalk.bold('\n🔗 Network Status\n'));

  const spinner = ora('Fetching network info...').start();

  try {
    const networkInfo = wallet.getNetworkInfo();
    const blockNumber = await wallet.getBlockNumber();
    const gasPrice = await wallet.getGasPrice();

    spinner.succeed('Connected to network');
    
    display.table(
      ['Property', 'Value'],
      [
        ['Network', networkInfo.name],
        ['Chain ID', networkInfo.chainId.toString()],
        ['Block', blockNumber.toString()],
        ['Gas Price', `${gasPrice.gasPrice} Gwei`],
        ['Explorer', networkInfo.explorer]
      ]
    );
  } catch (error) {
    spinner.fail(`Failed to connect: ${error.message}`);
  }
}

export async function walletGenerateCommand() {
  display.divider();
  
  console.log(chalk.yellow('\n⚠️  SECURITY NOTICE'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white('This will generate a new Arbitrum wallet.'));
  console.log(chalk.white('• The private key will be shown ONCE'));
  console.log(chalk.white('• This CLI does NOT store your private key'));
  console.log(chalk.white('• You MUST save it securely yourself'));
  console.log(chalk.white('• Lost keys cannot be recovered'));
  console.log(chalk.gray('─'.repeat(50) + '\n'));
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'I understand and want to generate a new wallet',
      default: false
    }
  ]);

  if (!confirm) return;

  const spinner = ora('Generating wallet...').start();
  
  try {
    const wallet = new ArbitrumWallet();
    const newWallet = wallet.generateWallet();
    
    spinner.succeed('Wallet generated!');
    
    console.log(chalk.bold.red('\n🔐 CRITICAL: Save this information NOW!\n'));
    
    console.log(chalk.green('Address (safe to share):'));
    console.log(`  ${newWallet.address}\n`);
    
    console.log(chalk.yellow('Private Key (NEVER SHARE):'));
    console.log(`  ${newWallet.privateKey}\n`);
    
    console.log(chalk.cyan('Recovery Phrase (NEVER SHARE):'));
    console.log(`  ${newWallet.mnemonic}\n`);
    
    console.log(chalk.gray('─'.repeat(50)));
    display.warning('This information will not be shown again!');
    display.warning('Never share your private key or recovery phrase!');
    display.warning('Store in a password manager or write it down securely.');
  } catch (error) {
    spinner.fail(`Failed to generate wallet: ${error.message}`);
  }
}

export async function walletBalanceCommand(options) {
  const network = options.network || config.defaultNetwork;
  const address = options.address;

  if (!address) {
    display.error('Please provide an address with --address');
    return;
  }

  const wallet = new ArbitrumWallet(network);
  const spinner = ora('Fetching balance...').start();

  try {
    const balance = await wallet.getBalance(address);
    const networkInfo = wallet.getNetworkInfo();
    
    spinner.succeed('Balance retrieved');
    
    display.table(
      ['Property', 'Value'],
      [
        ['Address', address],
        ['Network', networkInfo.name],
        ['Balance', `${balance} ETH`]
      ]
    );
  } catch (error) {
    spinner.fail(`Failed to get balance: ${error.message}`);
  }
}

export async function walletConnectCommand(options) {
  const network = options.network || config.defaultNetwork;
  
  console.log(chalk.yellow('\n⚠️  SESSION-ONLY CONNECTION'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white('Your private key will be used for this session only.'));
  console.log(chalk.white('• Keys are stored in memory, not on disk'));
  console.log(chalk.white('• Connection ends when CLI exits'));
  console.log(chalk.white('• You will need to reconnect next time'));
  console.log(chalk.gray('─'.repeat(50) + '\n'));
  
  const { privateKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'privateKey',
      message: 'Enter your private key:',
      mask: '*'
    }
  ]);

  const spinner = ora('Connecting wallet...').start();

  try {
    const wallet = new ArbitrumWallet(network);
    const result = await wallet.connect(privateKey);
    currentWallet = wallet;
    
    spinner.succeed('Wallet connected (session only)!');
    
    display.table(
      ['Property', 'Value'],
      [
        ['Address', result.address],
        ['Network', result.network],
        ['Session', 'Active until CLI exits']
      ]
    );
    
    display.info('Your key is NOT stored. Reconnect on next session.');
  } catch (error) {
    spinner.fail(`Failed to connect: ${error.message}`);
  }
}
