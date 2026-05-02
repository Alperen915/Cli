import chalk   from 'chalk';
import inquirer from 'inquirer';
import { notificationService } from '../services/notificationService.js';
import { storage }             from '../utils/storage.js';
import { display }             from '../utils/display.js';

function activeAgent(opts) {
  return opts?.agent || storage.loadActiveAgent() || 'system';
}

// ── arb notify channel add ────────────────────────────────────────────────────

export async function notifyChannelAddCommand(opts) {
  let { name, type } = opts;

  if (!name || !type) {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Channel name (e.g. my-discord):',
        validate: v => /^[a-z0-9_-]+$/i.test(v) ? true : 'Letters, numbers, - and _ only' },
      { type: 'list',  name: 'type', message: 'Platform:',
        choices: [
          { name: 'Discord  — Webhook URL', value: 'discord' },
          { name: 'Telegram — Bot Token + Chat ID', value: 'telegram' }
        ]}
    ]);
    name = ans.name; type = ans.type;
  }

  let channelData = { name, type };

  if (type === 'discord') {
    const { webhookUrl } = await inquirer.prompt([{
      type: 'input', name: 'webhookUrl',
      message: 'Discord Webhook URL:',
      validate: v => v.startsWith('https://discord.com/api/webhooks/') ? true : 'Must be a Discord webhook URL'
    }]);
    channelData.webhookUrl = webhookUrl;

  } else if (type === 'telegram') {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'botToken', message: 'Telegram Bot Token (from @BotFather):',
        validate: v => v.length > 10 ? true : 'Enter a valid bot token' },
      { type: 'input', name: 'chatId',   message: 'Chat ID (use @userinfobot to find yours):',
        validate: v => v.length > 2 ? true : 'Enter a valid chat ID' }
    ]);
    channelData.botToken = ans.botToken;
    channelData.chatId   = ans.chatId;
  }

  const channel = notificationService.addChannel(channelData);
  display.success(`Channel "${channel.name}" added [${channel.type}]`);

  // Offer to send test message
  const { doTest } = await inquirer.prompt([{
    type: 'confirm', name: 'doTest',
    message: 'Send a test notification now?',
    default: true
  }]);

  if (doTest) {
    display.info('Sending test notification…');
    const result = await notificationService.testChannel(name);
    if (result.ok) display.success('Test notification sent successfully!');
    else           display.error(`Test failed: ${result.error}`);
  }
}

// ── arb notify channel list ───────────────────────────────────────────────────

export async function notifyChannelListCommand() {
  const channels = notificationService.listChannels();

  if (channels.length === 0) {
    display.info('No notification channels. Add one with: arb notify channel add');
    return;
  }

  console.log(chalk.bold(`\n  Notification Channels (${channels.length})\n`));

  for (const ch of channels) {
    const status = ch.enabled ? chalk.green('● enabled') : chalk.gray('○ disabled');
    console.log(`  ${status}  ${chalk.white(ch.name)}  ${chalk.cyan('[' + ch.type + ']')}`);
    if (ch.webhookUrl) console.log(`           webhook: ${chalk.gray(ch.webhookUrl)}`);
    if (ch.botToken)   console.log(`           token:   ${chalk.gray(ch.botToken)}`);
    if (ch.chatId)     console.log(`           chatId:  ${chalk.gray(ch.chatId)}`);
    console.log(`           sent: ${chalk.yellow(ch.sentCount)}  |  created: ${chalk.gray(ch.createdAt.slice(0,10))}`);
    console.log('');
  }
}

// ── arb notify channel remove ─────────────────────────────────────────────────

export async function notifyChannelRemoveCommand(name) {
  const { removed } = notificationService.removeChannel(name);
  if (removed) display.success(`Channel "${name}" removed`);
  else         display.error(`Channel "${name}" not found`);
}

// ── arb notify channel test ───────────────────────────────────────────────────

export async function notifyChannelTestCommand(name, opts) {
  if (!name) {
    const channels = notificationService.listChannels();
    if (channels.length === 0) { display.error('No channels configured'); return; }
    const ans = await inquirer.prompt([{
      type: 'list', name: 'name', message: 'Channel to test:',
      choices: channels.map(c => ({ name: `${c.name} [${c.type}]`, value: c.name }))
    }]);
    name = ans.name;
  }

  display.info(`Testing channel "${name}"…`);
  const result = await notificationService.testChannel(name);
  if (result.ok) display.success('Test notification sent!');
  else           display.error(`Failed: ${result.error}`);
}

// ── arb notify subscribe ──────────────────────────────────────────────────────

export async function notifySubscribeCommand(opts) {
  const channels = notificationService.listChannels();
  if (channels.length === 0) {
    display.error('No channels. Add one first: arb notify channel add');
    return;
  }

  const EVENT_TYPES = [
    { name: 'strategy_trigger — DCA, stop-loss, take-profit fired', value: 'strategy_trigger' },
    { name: 'event_fired      — on-chain event watcher triggered',  value: 'event_fired'      },
    { name: 'pnl_update       — P&L summary change',                value: 'pnl_update'       },
    { name: 'price_alert      — price alert triggered',             value: 'price_alert'       },
    { name: 'fleet_decision   — multi-agent fleet decision',        value: 'fleet_decision'    },
    { name: 'whale_alert      — whale activity detected',           value: 'whale_alert'       },
    { name: '* (all events)',                                        value: '*'                },
  ];

  const ans = await inquirer.prompt([
    { type: 'list',     name: 'channelName', message: 'Send to channel:',
      choices: channels.map(c => ({ name: `${c.name} [${c.type}]`, value: c.name })) },
    { type: 'input',    name: 'agentName', message: 'Agent name (* for all):',
      default: storage.loadActiveAgent() || '*' },
    { type: 'checkbox', name: 'eventTypes', message: 'Event types (Space to select):',
      choices: EVENT_TYPES },
    { type: 'list',     name: 'minSeverity', message: 'Minimum severity:',
      choices: [
        { name: 'info    — all notifications', value: 'info' },
        { name: 'warning — warnings and above', value: 'warning' },
        { name: 'danger  — critical only',      value: 'danger' }
      ]}
  ]);

  const types = ans.eventTypes.length > 0 ? ans.eventTypes : ['*'];
  const sub = notificationService.subscribe({
    channelName:  ans.channelName,
    agentName:    ans.agentName || '*',
    eventTypes:   types,
    minSeverity:  ans.minSeverity
  });

  display.success(`Subscription created: ${sub.id}`);
  console.log(chalk.gray(`  Channel:  ${sub.channelName}`));
  console.log(chalk.gray(`  Agent:    ${sub.agentName}`));
  console.log(chalk.gray(`  Events:   ${sub.eventTypes.join(', ')}`));
  console.log(chalk.gray(`  Severity: ≥${sub.minSeverity}`));
}

// ── arb notify subscriptions ──────────────────────────────────────────────────

export async function notifySubscriptionsCommand() {
  const subs = notificationService.listSubscriptions();

  if (subs.length === 0) {
    display.info('No subscriptions. Create one with: arb notify subscribe');
    return;
  }

  console.log(chalk.bold(`\n  Subscriptions (${subs.length})\n`));

  for (const s of subs) {
    console.log(`  ${chalk.cyan(s.id.slice(-8))}  ${chalk.white(s.channelName.padEnd(20))}  agent: ${chalk.yellow(s.agentName)}`);
    console.log(`           events: ${chalk.gray(s.eventTypes.join(', '))}  |  severity: ≥${s.minSeverity}`);
    console.log('');
  }
}

// ── arb notify send ───────────────────────────────────────────────────────────

export async function notifySendCommand(opts) {
  const agentName = activeAgent(opts);

  const ans = await inquirer.prompt([
    { type: 'input',  name: 'title',    message: 'Notification title:' },
    { type: 'input',  name: 'body',     message: 'Message body:' },
    { type: 'list',   name: 'severity', message: 'Severity:',
      choices: ['info', 'warning', 'danger'], default: 'info' }
  ]);

  const result = await notificationService.send({
    type: 'custom', agentName,
    title:    ans.title,
    body:     ans.body,
    severity: ans.severity
  });

  if (result.sent > 0) display.success(`Sent to ${result.sent} channel(s)`);
  else                 display.info('No matching subscriptions for this notification');
}

// ── arb notify history ────────────────────────────────────────────────────────

export async function notifyHistoryCommand(opts) {
  const limit   = parseInt(opts?.limit || '20');
  const history = notificationService.getHistory(limit);

  if (history.length === 0) {
    display.info('No notifications sent yet.');
    return;
  }

  console.log(chalk.bold(`\n  Notification History (last ${history.length})\n`));

  for (const n of history) {
    const ts      = n.timestamp.slice(0, 19).replace('T', ' ');
    const okCount = (n.results || []).filter(r => r?.ok).length;
    const status  = okCount > 0 ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${status} ${chalk.gray(ts)}  ${chalk.cyan(n.type.padEnd(20))}  ${chalk.white(n.title.slice(0,50))}`);
    console.log(`           agent: ${chalk.gray(n.agentName || '—')}  sent: ${chalk.yellow(n.sentTo)}  ok: ${chalk.green(okCount)}`);
    console.log('');
  }
}
