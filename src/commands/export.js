import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { agentManager } from '../agents/agentManager.js';
import { display } from '../utils/display.js';
import { config } from '../utils/config.js';

export async function exportAgentsCommand(options) {
  display.divider();
  
  const agents = agentManager.listAgents();
  
  if (agents.length === 0) {
    display.info('No agents to export. Create agents first.');
    return;
  }

  console.log(chalk.bold('\n📦 Export Agents\n'));

  let selectedAgents = agents;
  
  if (!options.all) {
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select agents to export:',
        choices: agents.map(a => ({
          name: `${a.name} (${a.type}) - ${a.network}`,
          value: a.name,
          checked: true
        }))
      }
    ]);
    
    if (selected.length === 0) {
      display.info('No agents selected for export.');
      return;
    }
    
    selectedAgents = agents.filter(a => selected.includes(a.name));
  }

  const outputFile = options.output || `arbitrum-agents-${Date.now()}.json`;
  const spinner = ora('Exporting agents...').start();

  try {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      platform: 'Arbitrum AI Agent Platform',
      agents: selectedAgents.map(agent => ({
        name: agent.name,
        type: agent.type,
        network: agent.network,
        interestFreeMode: agent.interestFreeMode === true,
        capabilities: agent.capabilities,
        created: agent.created,
        isDeployed: agent.isDeployed === true,
        contractAddress: agent.contractAddress || null,
        deploymentTx: agent.deploymentTx || null
      }))
    };

    fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
    spinner.succeed(`Exported ${selectedAgents.length} agent(s) to ${outputFile}`);
    
    console.log(chalk.cyan('\n📄 Export Summary:'));
    selectedAgents.forEach(a => {
      console.log(`  • ${a.name} (${a.type})`);
    });
    console.log('');
    
  } catch (error) {
    spinner.fail('Export failed');
    display.error(`Error: ${error.message}`);
  }
}

export async function importAgentsCommand(options) {
  display.divider();
  
  const inputFile = options.file;
  
  if (!inputFile) {
    display.error('Please specify a file to import with --file');
    display.info('Example: node index.js export import --file agents.json');
    return;
  }

  if (!fs.existsSync(inputFile)) {
    display.error(`File not found: ${inputFile}`);
    return;
  }

  console.log(chalk.bold('\n📥 Import Agents\n'));

  const spinner = ora('Reading export file...').start();

  try {
    const content = fs.readFileSync(inputFile, 'utf-8');
    const data = JSON.parse(content);
    
    if (!data.agents || !Array.isArray(data.agents)) {
      spinner.fail('Invalid export file format');
      return;
    }

    spinner.succeed(`Found ${data.agents.length} agent(s) in export file`);
    
    console.log(chalk.gray(`  Exported: ${data.exportedAt}`));
    console.log(chalk.gray(`  Version: ${data.version}\n`));

    const existingAgents = agentManager.listAgents().map(a => a.name);
    const newAgents = data.agents.filter(a => !existingAgents.includes(a.name));
    const duplicates = data.agents.filter(a => existingAgents.includes(a.name));

    if (duplicates.length > 0) {
      display.warning(`${duplicates.length} agent(s) already exist and will be skipped:`);
      duplicates.forEach(a => console.log(`  • ${a.name}`));
      console.log('');
    }

    if (newAgents.length === 0) {
      display.info('No new agents to import.');
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Import ${newAgents.length} new agent(s)?`,
        default: true
      }
    ]);

    if (!confirm) {
      display.info('Import cancelled.');
      return;
    }

    const importSpinner = ora('Importing agents...').start();
    let imported = 0;

    for (const agentData of newAgents) {
      try {
        const options = { interestFreeMode: agentData.interestFreeMode === true };
        const agent = agentManager.createAgent(
          agentData.name,
          agentData.type,
          agentData.network,
          options
        );
        
        if (agentData.isDeployed && agentData.contractAddress) {
          agent.isDeployed = true;
          agent.contractAddress = agentData.contractAddress;
          agent.deploymentTx = agentData.deploymentTx;
        }
        
        imported++;
      } catch (error) {
        console.log(chalk.yellow(`  Skipped ${agentData.name}: ${error.message}`));
      }
    }

    importSpinner.succeed(`Imported ${imported} agent(s)`);
    
  } catch (error) {
    spinner.fail('Import failed');
    display.error(`Error: ${error.message}`);
  }
}

export async function exportConfigCommand(options) {
  display.divider();
  console.log(chalk.bold('\n⚙️  Export Configuration\n'));

  const outputFile = options.output || 'arbitrum-config.json';
  
  const exportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    config: {
      defaultNetwork: config.defaultNetwork,
      networks: Object.keys(config.arbitrum),
      agentTypes: Object.keys(config.agentTypes)
    }
  };

  try {
    fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
    display.success(`Configuration exported to ${outputFile}`);
  } catch (error) {
    display.error(`Export failed: ${error.message}`);
  }
}
