import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';
import { display } from '../utils/display.js';
import { config, reloadConfig, SUPPORTED_PROVIDERS } from '../utils/config.js';

const ENV_FILE = '.env';

function getEnvPath() {
  return path.join(process.cwd(), ENV_FILE);
}

function readEnvFile() {
  const envPath = getEnvPath();
  if (fs.existsSync(envPath)) return fs.readFileSync(envPath, 'utf-8');
  return '';
}

function updateEnvVariable(key, value) {
  let content = readEnvFile();
  const lines = content.split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return value ? `${key}=${value}` : null;
    }
    return line;
  }).filter(Boolean);
  if (!found && value) updated.push(`${key}=${value}`);
  fs.writeFileSync(getEnvPath(), updated.join('\n') + '\n');
}

async function testOpenAIKey(apiKey) {
  const client = new OpenAI({ apiKey });
  await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'test' }],
    max_tokens: 5
  });
}

async function testAnthropicKey(apiKey) {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.anthropic.com/v1',
    defaultHeaders: { 'anthropic-version': '2023-06-01', 'x-api-key': apiKey }
  });
  await client.chat.completions.create({
    model: 'claude-haiku-4-5',
    messages: [{ role: 'user', content: 'test' }],
    max_tokens: 5
  });
}

async function testGeminiKey(apiKey) {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai'
  });
  await client.chat.completions.create({
    model: 'gemini-1.5-flash',
    messages: [{ role: 'user', content: 'test' }],
    max_tokens: 5
  });
}

export async function configureApiCommand() {
  display.divider();
  console.log(chalk.bold('\n🔑 AI Provider Configuration\n'));
  console.log(chalk.white('Connect your own AI API key to enable intelligent agents.'));
  console.log(chalk.gray('Keys are stored locally in .env and never shared.\n'));

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select AI provider:',
      choices: Object.entries(SUPPORTED_PROVIDERS).map(([id, p]) => {
        const key = config.getApiKey(id);
        const status = key ? chalk.green('✔ connected') : chalk.gray('not configured');
        return { name: `${p.name}  [${status}]`, value: id };
      })
    }
  ]);

  const providerInfo = SUPPORTED_PROVIDERS[provider];
  const currentKey = config.getApiKey(provider);

  if (currentKey) {
    display.success(`Current key: ${currentKey.slice(0, 8)}...${currentKey.slice(-4)}`);
  } else {
    display.warning(`No ${providerInfo.name} key configured.`);
  }

  console.log(chalk.cyan(`\n📖 Get your ${providerInfo.name} API key:`));
  console.log(`   ${providerInfo.docsUrl}\n`);

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: `Set ${providerInfo.name} API key`, value: 'set' },
        ...(currentKey ? [{ name: `Test ${providerInfo.name} connection`, value: 'test' }] : []),
        ...(currentKey ? [{ name: `Remove ${providerInfo.name} key`, value: 'remove' }] : []),
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);

  if (action === 'cancel') return;

  if (action === 'remove') {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Remove ${providerInfo.name} key?`,
        default: false
      }
    ]);
    if (confirm) {
      updateEnvVariable(providerInfo.envVar, null);
      reloadConfig();
      display.success(`${providerInfo.name} key removed.`);
    }
    return;
  }

  if (action === 'test') {
    const spinner = ora(`Testing ${providerInfo.name} connection...`).start();
    try {
      if (provider === 'openai') await testOpenAIKey(currentKey);
      else if (provider === 'anthropic') await testAnthropicKey(currentKey);
      else if (provider === 'gemini') await testGeminiKey(currentKey);
      spinner.succeed(`${providerInfo.name} connection successful!`);
    } catch (error) {
      spinner.fail('Connection failed');
      if (error.message.includes('401') || error.message.includes('invalid')) {
        display.error('Invalid API key. Please check and try again.');
      } else if (error.message.includes('429')) {
        display.error('Rate limit exceeded. Key is valid but hit usage limits.');
      } else {
        display.error(`Error: ${error.message}`);
      }
    }
    return;
  }

  if (action === 'set') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `Enter your ${providerInfo.name} API key:`,
        mask: '*',
        validate: (input) => {
          if (!input || !input.trim()) return 'API key cannot be empty';
          return true;
        }
      }
    ]);

    const spinner = ora('Validating API key...').start();
    try {
      if (provider === 'openai') await testOpenAIKey(apiKey.trim());
      else if (provider === 'anthropic') await testAnthropicKey(apiKey.trim());
      else if (provider === 'gemini') await testGeminiKey(apiKey.trim());

      spinner.succeed('API key validated!');
      updateEnvVariable(providerInfo.envVar, apiKey.trim());
      reloadConfig();
      display.success(`${providerInfo.name} key saved to .env file.`);
      display.info('Restart the CLI to activate AI features.');

      console.log(chalk.cyan('\n🚀 Next steps:'));
      console.log('   1. Restart the CLI');
      console.log('   2. Create an agent: node index.js agent create');
      console.log('   3. Chat with your agent: node index.js chat\n');
    } catch (error) {
      spinner.fail('API key validation failed');
      if (error.message.includes('401') || error.message.includes('invalid')) {
        display.error('Invalid API key. Please check and try again.');
      } else if (error.message.includes('insufficient_quota')) {
        display.error(`Key valid but no credits. Add credits at ${providerInfo.docsUrl}`);
      } else {
        display.error(`Error: ${error.message}`);
      }
    }
  }
}

export async function showConfigCommand() {
  display.divider();
  console.log(chalk.bold('\n⚙️  AI Configuration\n'));

  const rows = Object.entries(SUPPORTED_PROVIDERS).map(([id, p]) => {
    const key = config.getApiKey(id);
    const status = key ? chalk.green('Enabled') : chalk.gray('Not configured');
    const masked = key ? key.slice(0, 8) + '...' + key.slice(-4) : '—';
    return [p.name, masked, status];
  });

  display.table(
    ['Provider', 'API Key', 'Status'],
    rows
  );

  const active = config.getActiveProvider();
  if (active) {
    console.log(chalk.green(`\n✔ Active provider: ${SUPPORTED_PROVIDERS[active].name}`));
    console.log(chalk.gray(`  Default model: ${SUPPORTED_PROVIDERS[active].defaultModel}`));
  } else {
    console.log(chalk.yellow('\n💡 No AI provider configured.'));
    console.log('   node index.js config set');
    console.log('\n   Supported providers:');
    Object.entries(SUPPORTED_PROVIDERS).forEach(([id, p]) => {
      console.log(`     • ${p.name}  →  ${p.docsUrl}`);
    });
  }

  console.log(chalk.gray(`\n  Default Network: ${config.defaultNetwork}\n`));
}
