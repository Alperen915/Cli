import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { agentManager } from '../agents/agentManager.js';
import { display } from '../utils/display.js';
import { config } from '../utils/config.js';

const SIMPLE_STORAGE_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "x", "type": "uint256"}],
    "name": "set",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "get",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export async function deployAgentCommand(options) {
  display.divider();
  
  const agent = agentManager.getActiveAgent();
  
  if (!agent) {
    display.error('No active agent. Create or select one first.');
    display.info('Use: node index.js agent create -t onchain');
    return;
  }

  if (agent.type !== 'onchain') {
    display.error('Active agent is not an on-chain agent.');
    display.info('Create an on-chain agent with: node index.js agent create -t onchain');
    return;
  }

  if (!agent.wallet.wallet) {
    display.error('No wallet connected to this agent.');
    display.info('Connect a wallet first with: node index.js wallet connect');
    return;
  }

  if (agent.isDeployed) {
    display.warning('This agent already has a deployed contract.');
    display.info(`Contract: ${agent.contractAddress}`);
    
    const { redeploy } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'redeploy',
        message: 'Deploy a new contract anyway?',
        default: false
      }
    ]);
    
    if (!redeploy) return;
  }

  console.log(chalk.bold('\n🚀 On-Chain Agent Deployment\n'));
  
  console.log(chalk.yellow('⚠️  DEPLOYMENT NOTICE'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white('This will deploy a smart contract to Arbitrum.'));
  console.log(chalk.white('• This action costs gas (real ETH on mainnet)'));
  console.log(chalk.white('• Deployments are permanent and irreversible'));
  console.log(chalk.white('• Always test on Sepolia first'));
  console.log(chalk.gray('─'.repeat(50) + '\n'));

  const networkInfo = agent.wallet.getNetworkInfo();
  display.info(`Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);

  console.log(chalk.cyan('📝 Contract Deployment Options:'));
  console.log('   To deploy a contract, you need compiled bytecode from:');
  console.log('   • Hardhat: npx hardhat compile → artifacts/');
  console.log('   • Foundry: forge build → out/');
  console.log('   • Remix: Compile → Copy bytecode\n');

  const { customBytecode } = await inquirer.prompt([
    {
      type: 'input',
      name: 'customBytecode',
      message: 'Enter contract bytecode (0x...):',
      validate: (input) => {
        if (!input.startsWith('0x')) {
          return 'Bytecode must start with 0x';
        }
        if (input.length < 10) {
          return 'Bytecode appears too short';
        }
        return true;
      }
    }
  ]);
  
  let bytecode = customBytecode;
  let abi = SIMPLE_STORAGE_ABI;

  const balanceSpinner = ora('Checking wallet balance...').start();
  
  try {
    const balance = await agent.wallet.getBalance();
    balanceSpinner.succeed(`Wallet balance: ${balance} ETH`);
    
    if (parseFloat(balance) < 0.001) {
      display.error('Insufficient balance for deployment.');
      display.info('Get testnet ETH from https://faucet.arbitrum.io/');
      return;
    }
  } catch (error) {
    balanceSpinner.fail('Failed to check balance');
    display.error(`Error: ${error.message}`);
    return;
  }

  const { confirmDeploy } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmDeploy',
      message: `Deploy contract to ${networkInfo.name}?`,
      default: false
    }
  ]);

  if (!confirmDeploy) {
    display.info('Deployment cancelled.');
    return;
  }

  const deploySpinner = ora('Deploying contract...').start();

  try {
    const result = await agent.deploy(bytecode, abi, []);
    
    agentManager.persistAgents();
    
    deploySpinner.succeed('Contract deployed successfully!');
    
    console.log(chalk.bold.green('\n✅ Deployment Complete\n'));
    
    display.table(
      ['Property', 'Value'],
      [
        ['Contract Address', result.contractAddress],
        ['Transaction Hash', result.transactionHash],
        ['Network', networkInfo.name]
      ]
    );
    
    console.log(chalk.cyan('\n📖 View on Explorer:'));
    console.log(`  Contract: ${result.explorer}`);
    console.log(`  Transaction: ${result.txExplorer}\n`);
    
    display.success('Deployment data saved to agent.');
    
  } catch (error) {
    deploySpinner.fail('Deployment failed');
    
    if (error.message.includes('insufficient funds')) {
      display.error('Insufficient ETH for gas fees.');
      display.info('Get testnet ETH from https://faucet.arbitrum.io/');
    } else if (error.message.includes('nonce')) {
      display.error('Transaction nonce issue. Try again in a moment.');
    } else if (error.message.includes('network')) {
      display.error('Network connection error. Check your internet connection.');
    } else {
      display.error(`Error: ${error.message}`);
    }
  }
}

export async function contractStatusCommand(options) {
  display.divider();
  
  const agent = agentManager.getActiveAgent();
  
  if (!agent || agent.type !== 'onchain') {
    display.error('No active on-chain agent.');
    display.info('Create one with: node index.js agent create -t onchain');
    return;
  }

  console.log(chalk.bold('\n📋 On-Chain Agent Status\n'));

  const info = agent.getDeploymentInfo();
  const networkInfo = agent.wallet.getNetworkInfo();
  
  if (!info.isDeployed) {
    display.info('Agent has not been deployed on-chain yet.');
    display.info('Use: node index.js onchain deploy');
    return;
  }

  display.table(
    ['Property', 'Value'],
    [
      ['Deployed', info.isDeployed ? 'Yes' : 'No'],
      ['Contract Address', info.contractAddress || 'N/A'],
      ['Deployment TX', info.deploymentTx || 'N/A'],
      ['Network', info.network]
    ]
  );
  
  console.log(chalk.cyan('\n📖 View on Explorer:'));
  console.log(`  ${networkInfo.explorer}/address/${info.contractAddress}\n`);
}

export async function verifyContractCommand(options) {
  const address = options.address;
  
  if (!address) {
    display.error('Please provide a contract address with --address');
    display.info('Example: node index.js onchain verify --address 0x...');
    return;
  }

  if (!address.startsWith('0x') || address.length !== 42) {
    display.error('Invalid address format. Must be 0x followed by 40 hex characters.');
    return;
  }

  display.divider();
  
  const agent = agentManager.getActiveAgent();
  
  if (!agent || agent.type !== 'onchain') {
    display.error('No active on-chain agent. Create one first.');
    return;
  }

  const spinner = ora('Checking contract...').start();

  try {
    const info = await agent.getContractCode(address);
    spinner.succeed('Contract checked');
    
    const networkInfo = agent.wallet.getNetworkInfo();
    
    display.table(
      ['Property', 'Value'],
      [
        ['Address', info.address],
        ['Has Code', info.hasCode ? 'Yes (is a contract)' : 'No (EOA or empty)'],
        ['Code Size', `${info.codeLength} bytes`],
        ['Network', networkInfo.name]
      ]
    );
    
    if (info.hasCode) {
      console.log(chalk.cyan(`\n📖 View: ${networkInfo.explorer}/address/${address}\n`));
    }
  } catch (error) {
    spinner.fail('Verification failed');
    
    if (error.message.includes('network')) {
      display.error('Network connection error. Check your internet connection.');
    } else {
      display.error(`Error: ${error.message}`);
    }
  }
}

export async function interactContractCommand(options) {
  display.divider();
  
  const agent = agentManager.getActiveAgent();
  
  if (!agent || agent.type !== 'onchain') {
    display.error('No active on-chain agent.');
    return;
  }

  console.log(chalk.bold('\n🔗 Contract Interaction\n'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Read contract state (free)', value: 'read' },
        { name: 'Write to contract (costs gas)', value: 'write' },
        { name: 'Get contract info', value: 'info' }
      ]
    }
  ]);

  let contractAddress;
  
  if (agent.isDeployed && agent.contractAddress) {
    const { useDeployed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useDeployed',
        message: `Use deployed contract at ${agent.contractAddress}?`,
        default: true
      }
    ]);
    
    if (useDeployed) {
      contractAddress = agent.contractAddress;
    }
  }
  
  if (!contractAddress) {
    const { inputAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputAddress',
        message: 'Enter contract address:',
        validate: (input) => {
          if (!input.startsWith('0x') || input.length !== 42) {
            return 'Please enter a valid Ethereum address (0x + 40 hex chars)';
          }
          return true;
        }
      }
    ]);
    contractAddress = inputAddress;
  }

  if (action === 'info') {
    const spinner = ora('Fetching contract info...').start();
    try {
      const info = await agent.getContractCode(contractAddress);
      spinner.succeed('Contract info retrieved');
      
      display.table(
        ['Property', 'Value'],
        [
          ['Address', info.address],
          ['Has Code', info.hasCode ? 'Yes (is a contract)' : 'No (EOA or empty)'],
          ['Code Size', `${info.codeLength} bytes`]
        ]
      );
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
    return;
  }

  display.info('For read/write operations, you need the contract ABI.');
  display.info('Import the ABI from your compiled contract artifacts.');
  
  console.log(chalk.cyan('\n📖 Next Steps:'));
  console.log('1. Compile your Solidity contract with Hardhat/Foundry');
  console.log('2. Import the ABI JSON from artifacts');
  console.log('3. Use ethers.js Contract class for interaction');
  console.log('4. See docs/COMMANDS.md for examples\n');
}
