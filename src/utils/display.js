import chalk from 'chalk';
import figlet from 'figlet';
import Table from 'cli-table3';

export const display = {
  banner() {
    console.log(
      chalk.cyan(
        figlet.textSync('Arbitrum Agent', {
          font: 'Small',
          horizontalLayout: 'default'
        })
      )
    );
    console.log(chalk.gray('  AI-Powered Agent Platform for the Arbitrum Ecosystem\n'));
  },

  success(message) {
    console.log(chalk.green('✓ ') + message);
  },

  error(message) {
    console.log(chalk.red('✗ ') + message);
  },

  warning(message) {
    console.log(chalk.yellow('⚠ ') + message);
  },

  info(message) {
    console.log(chalk.blue('ℹ ') + message);
  },

  agent(message) {
    console.log(chalk.magenta('🤖 ') + chalk.bold('Agent: ') + message);
  },

  network(name, chainId, status) {
    const statusIcon = status === 'connected' ? chalk.green('●') : chalk.red('●');
    console.log(`${statusIcon} ${chalk.bold(name)} (Chain ID: ${chainId})`);
  },

  table(headers, rows) {
    const table = new Table({
      head: headers.map(h => chalk.cyan(h)),
      style: { head: [], border: [] }
    });
    rows.forEach(row => table.push(row));
    console.log(table.toString());
  },

  agentCard(agent) {
    const aiStatus = agent.aiEnabled ? chalk.green('Enabled') : chalk.yellow('Limited (set OPENAI_API_KEY)');
    const modeLabel = agent.interestFreeMode ? chalk.green('Interest-Free (Halal)') : chalk.gray('Standard');
    console.log(chalk.cyan('┌' + '─'.repeat(50) + '┐'));
    console.log(chalk.cyan('│') + chalk.bold(` 🤖 ${agent.name}`.padEnd(50)) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.gray(` Type: ${agent.type}`.padEnd(50)) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.gray(` Status: ${agent.status}`.padEnd(50)) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.gray(` Network: ${agent.network}`.padEnd(50)) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + ` Mode: ${modeLabel}`.padEnd(59) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + ` AI: ${aiStatus}`.padEnd(59) + chalk.cyan('│'));
    console.log(chalk.cyan('└' + '─'.repeat(50) + '┘'));
  },

  divider() {
    console.log(chalk.gray('─'.repeat(52)));
  },

  json(data) {
    console.log(chalk.gray(JSON.stringify(data, null, 2)));
  }
};
