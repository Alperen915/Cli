import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { agentManager } from '../agents/agentManager.js';
import { display } from '../utils/display.js';
import { config } from '../utils/config.js';

export async function createAgentCommand(options) {
  display.divider();
  
  let name = options.name;
  let type = options.type;
  let network = options.network || config.defaultNetwork;

  let interestFreeMode = options.interestFree || false;

  if (!name || !type) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter agent name:',
        default: name || 'MyAgent',
        when: !name
      },
      {
        type: 'list',
        name: 'type',
        message: 'Select agent type:',
        choices: agentManager.getAgentTypes().map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.id
        })),
        when: !type
      },
      {
        type: 'list',
        name: 'network',
        message: 'Select network:',
        choices: [
          { name: 'Arbitrum Sepolia (Testnet)', value: 'sepolia' },
          { name: 'Arbitrum One (Mainnet)', value: 'mainnet' },
          { name: 'Arbitrum Nova', value: 'nova' }
        ],
        default: network
      },
      {
        type: 'list',
        name: 'transactionMode',
        message: 'Select transaction mode:',
        choices: [
          { name: 'Standard Mode - All DeFi features (lending, borrowing, leverage, yield farming)', value: 'standard' },
          { name: 'Interest-Free Mode - Halal-compliant (no interest/riba, spot trading only)', value: 'interest-free' }
        ],
        default: 'standard'
      }
    ]);

    name = name || answers.name;
    type = type || answers.type;
    network = answers.network || network;
    interestFreeMode = answers.transactionMode === 'interest-free';
  }

  const spinner = ora('Creating agent...').start();

  try {
    const agent = agentManager.createAgent(name, type, network, { interestFreeMode });
    await agent.initialize();
    agentManager.setActiveAgent(name);
    
    spinner.succeed(`Agent "${name}" created successfully!`);
    display.agentCard(agent.getInfo());
    
    if (interestFreeMode) {
      display.info('Interest-Free Mode enabled. This agent will only suggest halal-compliant activities.');
    }
    
    if (!config.openaiApiKey) {
      display.warning('OPENAI_API_KEY not set. AI features will be limited.');
    }
  } catch (error) {
    spinner.fail(`Failed to create agent: ${error.message}`);
  }
}

export async function listAgentsCommand() {
  const agents = agentManager.listAgents();
  
  if (agents.length === 0) {
    display.info('No agents created yet. Use "agent create" to create one.');
    return;
  }

  display.divider();
  console.log(chalk.bold('\n📋 Your Agents:\n'));
  
  agents.forEach(agent => {
    display.agentCard(agent);
    console.log('');
  });
}

export async function selectAgentCommand(name) {
  if (!name) {
    const agents = agentManager.listAgents();
    
    if (agents.length === 0) {
      display.info('No agents available. Create one first.');
      return;
    }

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select an agent:',
        choices: agents.map(a => ({
          name: `${a.name} (${a.type}) - ${a.network}`,
          value: a.name
        }))
      }
    ]);
    name = selected;
  }

  try {
    const agent = agentManager.setActiveAgent(name);
    display.success(`Active agent set to: ${name}`);
    display.agentCard(agent.getInfo());
  } catch (error) {
    display.error(error.message);
  }
}

export async function deleteAgentCommand(name) {
  if (!name) {
    const agents = agentManager.listAgents();
    
    if (agents.length === 0) {
      display.info('No agents to delete.');
      return;
    }

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select agent to delete:',
        choices: agents.map(a => a.name)
      }
    ]);
    name = selected;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete agent "${name}"?`,
      default: false
    }
  ]);

  if (confirm) {
    if (agentManager.deleteAgent(name)) {
      display.success(`Agent "${name}" deleted.`);
    } else {
      display.error(`Agent "${name}" not found.`);
    }
  }
}
