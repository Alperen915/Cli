/**
 * NotificationService — Discord & Telegram bot notifications.
 *
 * Supports:
 *   - Discord webhooks (no library needed, plain fetch)
 *   - Telegram Bot API (plain fetch, no library)
 *
 * Notification types:
 *   strategy_trigger, event_fired, pnl_update, price_alert,
 *   fleet_decision, agent_status, whale_alert, custom
 *
 * Config stored at ~/.arb-agent/notifications.json
 */
import path from 'path';
import fs   from 'fs';
import { createLogger } from '../utils/logger.js';

const log = createLogger('notifications');

// ── Storage ───────────────────────────────────────────────────────────────────

function cfgDir() {
  const home = process.env.HOME || process.cwd();
  const dir  = path.join(home, '.arb-agent');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cfgFile() { return path.join(cfgDir(), 'notifications.json'); }

function loadCfg() {
  try {
    if (fs.existsSync(cfgFile())) return JSON.parse(fs.readFileSync(cfgFile(), 'utf-8'));
  } catch(e) { log.warn('Failed to load notification config', { err: e.message }); }
  return { channels: [], subscriptions: [], history: [] };
}

function saveCfg(cfg) {
  const tmp = cfgFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, cfgFile());
}

// ── Emoji map ─────────────────────────────────────────────────────────────────

const EMOJI = {
  strategy_trigger: '⚡',
  event_fired:      '🔔',
  pnl_update:       '💰',
  price_alert:      '📊',
  fleet_decision:   '🤖',
  agent_status:     '🟢',
  whale_alert:      '🐳',
  liquidation:      '🚨',
  large_transfer:   '💸',
  whale_swap:       '🔄',
  custom:           '📢',
};

// ── Discord Webhook ───────────────────────────────────────────────────────────

async function sendDiscord(webhookUrl, embed) {
  const body = {
    username:   'Arbitrum AI Agent',
    avatar_url: 'https://arbitrum.io/wp-content/uploads/2023/09/arb.png',
    embeds: [embed]
  };

  const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(8000)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord webhook failed: ${res.status} — ${text.slice(0, 100)}`);
  }
  return true;
}

function buildDiscordEmbed(notification) {
  const emoji  = EMOJI[notification.type] || '📢';
  const color  = notification.severity === 'danger'  ? 0xED4245
               : notification.severity === 'warning' ? 0xFEE75C
               : notification.severity === 'success' ? 0x57F287
               : 0x5865F2; // default blurple

  const embed = {
    title:       `${emoji} ${notification.title}`,
    description: notification.body,
    color,
    timestamp:   notification.timestamp,
    footer:      { text: `Arbitrum AI Agent • ${notification.agentName || 'system'}` },
    fields:      []
  };

  if (notification.fields) {
    embed.fields = notification.fields.map(f => ({
      name:   f.name,
      value:  String(f.value),
      inline: f.inline !== false
    }));
  }

  if (notification.url) embed.url = notification.url;
  return embed;
}

// ── Telegram Bot API ──────────────────────────────────────────────────────────

async function sendTelegram(botToken, chatId, text, parseMode = 'HTML') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true }),
    signal:  AbortSignal.timeout(8000)
  });

  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`Telegram API failed: ${JSON.stringify(json).slice(0, 150)}`);
  return json;
}

function buildTelegramMessage(notification) {
  const emoji = EMOJI[notification.type] || '📢';
  let msg = `<b>${emoji} ${escapeHtml(notification.title)}</b>\n`;
  msg    += `${escapeHtml(notification.body)}\n`;

  if (notification.fields?.length) {
    msg += '\n';
    for (const f of notification.fields) {
      msg += `<b>${escapeHtml(f.name)}:</b> ${escapeHtml(String(f.value))}\n`;
    }
  }

  msg += `\n<i>Agent: ${escapeHtml(notification.agentName || 'system')} • ${notification.timestamp?.slice(0,19).replace('T',' ')}</i>`;
  return msg;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── NotificationService ───────────────────────────────────────────────────────

export const notificationService = {

  // ── Channel management ────────────────────────────────────────────────────

  addChannel({ name, type, webhookUrl, botToken, chatId, enabled = true }) {
    const cfg = loadCfg();
    if (!/^[a-z0-9_-]+$/i.test(name) || name.length > 64) {
      throw new Error('Channel name must be alphanumeric (a-z, 0-9, -, _), max 64 chars');
    }
    if (cfg.channels.find(c => c.name === name)) {
      throw new Error(`Channel "${name}" already exists`);
    }
    if (!['discord', 'telegram'].includes(type)) {
      throw new Error('type must be "discord" or "telegram"');
    }
    if (type === 'discord' && !webhookUrl?.startsWith('https://discord.com/api/webhooks/')) {
      throw new Error('Discord webhookUrl must start with https://discord.com/api/webhooks/');
    }
    if (type === 'telegram' && (!botToken || !chatId)) {
      throw new Error('Telegram requires botToken and chatId');
    }

    const channel = {
      id:         `ch_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name, type, enabled,
      webhookUrl: webhookUrl || null,
      botToken:   botToken   || null,
      chatId:     chatId     || null,
      createdAt:  new Date().toISOString(),
      sentCount:  0
    };

    cfg.channels.push(channel);
    saveCfg(cfg);
    log.info(`Channel added: "${name}" [${type}]`);

    // Return masked version
    return this._maskChannel(channel);
  },

  removeChannel(name) {
    const cfg = loadCfg();
    const before = cfg.channels.length;
    cfg.channels       = cfg.channels.filter(c => c.name !== name);
    cfg.subscriptions  = cfg.subscriptions.filter(s => s.channelName !== name);
    saveCfg(cfg);
    return { removed: cfg.channels.length < before };
  },

  listChannels() {
    const cfg = loadCfg();
    return cfg.channels.map(c => this._maskChannel(c));
  },

  toggleChannel(name, enabled) {
    const cfg = loadCfg();
    const ch  = cfg.channels.find(c => c.name === name);
    if (!ch) throw new Error(`Channel "${name}" not found`);
    ch.enabled = enabled;
    saveCfg(cfg);
    return this._maskChannel(ch);
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────

  subscribe({ channelName, agentName = '*', eventTypes = ['*'], minSeverity = 'info' }) {
    const cfg = loadCfg();
    if (!cfg.channels.find(c => c.name === channelName)) {
      throw new Error(`Channel "${channelName}" not found`);
    }

    // Dedup: remove existing sub for same channel+agent
    cfg.subscriptions = cfg.subscriptions.filter(
      s => !(s.channelName === channelName && s.agentName === agentName)
    );

    const sub = {
      id:          `sub_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      channelName, agentName,
      eventTypes:  Array.isArray(eventTypes) ? eventTypes : [eventTypes],
      minSeverity,
      createdAt:   new Date().toISOString()
    };
    cfg.subscriptions.push(sub);
    saveCfg(cfg);
    return sub;
  },

  unsubscribe(subId) {
    const cfg = loadCfg();
    const before = cfg.subscriptions.length;
    cfg.subscriptions = cfg.subscriptions.filter(s => s.id !== subId);
    saveCfg(cfg);
    return { removed: cfg.subscriptions.length < before };
  },

  listSubscriptions() {
    return loadCfg().subscriptions;
  },

  // ── Send notification ─────────────────────────────────────────────────────

  async send(notification) {
    const cfg = loadCfg();

    const n = {
      id:        `n_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      type:      notification.type      || 'custom',
      severity:  notification.severity  || 'info',
      title:     notification.title     || 'Arbitrum Agent Alert',
      body:      notification.body      || '',
      agentName: notification.agentName || null,
      fields:    notification.fields    || [],
      url:       notification.url       || null,
      timestamp: new Date().toISOString(),
      results:   []
    };

    // Find matching subscriptions
    const matchingSubs = cfg.subscriptions.filter(sub => {
      if (!cfg.channels.find(c => c.name === sub.channelName && c.enabled)) return false;
      if (sub.agentName !== '*' && sub.agentName !== n.agentName) return false;
      if (!sub.eventTypes.includes('*') && !sub.eventTypes.includes(n.type)) return false;
      const levels = ['info','warning','danger'];
      if (levels.indexOf(n.severity) < levels.indexOf(sub.minSeverity)) return false;
      return true;
    });

    const results = await Promise.allSettled(
      matchingSubs.map(async sub => {
        const channel = cfg.channels.find(c => c.name === sub.channelName);
        if (!channel) return;

        try {
          if (channel.type === 'discord') {
            await sendDiscord(channel.webhookUrl, buildDiscordEmbed(n));
          } else if (channel.type === 'telegram') {
            await sendTelegram(channel.botToken, channel.chatId, buildTelegramMessage(n));
          }
          channel.sentCount = (channel.sentCount || 0) + 1;
          log.info(`Notification sent → ${sub.channelName} [${channel.type}]`, { type: n.type });
          return { channel: sub.channelName, ok: true };
        } catch(err) {
          log.warn(`Notification failed → ${sub.channelName}`, { err: err.message });
          return { channel: sub.channelName, ok: false, error: err.message };
        }
      })
    );

    n.results = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, error: r.reason?.message });

    // Persist history (last 200)
    cfg.history.unshift({ id: n.id, type: n.type, title: n.title, agentName: n.agentName,
      timestamp: n.timestamp, sentTo: matchingSubs.length, results: n.results });
    if (cfg.history.length > 200) cfg.history = cfg.history.slice(0, 200);
    saveCfg(cfg);

    return { sent: matchingSubs.length, results: n.results };
  },

  // ── Test channel ──────────────────────────────────────────────────────────

  async testChannel(name) {
    const cfg = loadCfg();
    const ch  = cfg.channels.find(c => c.name === name);
    if (!ch) throw new Error(`Channel "${name}" not found`);

    const testNotif = {
      type: 'custom', severity: 'info',
      title: '✅ Connection Test',
      body:  'Your Arbitrum AI Agent notification channel is working correctly.',
      agentName: 'system',
      fields: [
        { name: 'Channel',  value: ch.name },
        { name: 'Type',     value: ch.type },
        { name: 'Status',   value: 'Connected' },
        { name: 'Time',     value: new Date().toISOString().slice(0,19).replace('T',' ') + ' UTC' }
      ]
    };

    try {
      if (ch.type === 'discord') {
        await sendDiscord(ch.webhookUrl, buildDiscordEmbed({ ...testNotif, timestamp: new Date().toISOString() }));
      } else if (ch.type === 'telegram') {
        await sendTelegram(ch.botToken, ch.chatId, buildTelegramMessage({ ...testNotif, timestamp: new Date().toISOString() }));
      }
      return { ok: true, channel: name };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  // ── Notification history ──────────────────────────────────────────────────

  getHistory(limit = 50) {
    return loadCfg().history.slice(0, limit);
  },

  // ── Convenience senders (called by other services) ────────────────────────

  async notifyStrategyTrigger(agentName, strategy, outcome) {
    return this.send({
      type: 'strategy_trigger', severity: 'info', agentName,
      title: `Strategy Triggered — ${strategy.name || strategy.type}`,
      body:  outcome?.message || `${strategy.type} strategy executed on ${agentName}`,
      fields: [
        { name: 'Strategy', value: strategy.name || strategy.type },
        { name: 'Token',    value: strategy.token || '—' },
        { name: 'Outcome',  value: outcome?.status || 'executed' },
        { name: 'Mode',     value: strategy.dryRun !== false ? 'Dry Run' : 'Live' },
      ]
    });
  },

  async notifyEventFired(agentName, event) {
    const emoji = EMOJI[event.type] || EMOJI.event_fired;
    return this.send({
      type: 'event_fired', severity: event.type === 'liquidation' ? 'danger' : 'warning', agentName,
      title: `${emoji} On-Chain Event — ${event.watcherLabel || event.type}`,
      body:  `Watcher "${event.watcherLabel}" fired on block ${event.blockNumber}`,
      fields: [
        { name: 'Type',    value: event.type },
        { name: 'Block',   value: String(event.blockNumber) },
        { name: 'Tx',      value: event.txHash ? event.txHash.slice(0,20) + '…' : '—' },
        { name: 'Contract',value: event.contract ? event.contract.slice(0,20) + '…' : '—' },
      ],
      url: event.txHash ? `https://sepolia.arbiscan.io/tx/${event.txHash}` : null
    });
  },

  async notifyPnLUpdate(agentName, summary) {
    const sign    = summary.totalRealizedPnL >= 0 ? '+' : '';
    const sev     = summary.totalRealizedPnL >= 0 ? 'success' : 'warning';
    return this.send({
      type: 'pnl_update', severity: sev, agentName,
      title: `P&L Update — ${agentName}`,
      body:  `Realized P&L: ${sign}$${summary.totalRealizedPnL.toFixed(2)} (ROI: ${sign}${summary.roi.toFixed(2)}%)`,
      fields: [
        { name: 'Trades',   value: String(summary.totalTrades) },
        { name: 'Win Rate', value: summary.winRate.toFixed(1) + '%' },
        { name: 'P&L',      value: `${sign}$${summary.totalRealizedPnL.toFixed(2)}` },
        { name: 'ROI',      value: `${sign}${summary.roi.toFixed(2)}%` },
      ]
    });
  },

  async notifyPriceAlert(agentName, symbol, currentPrice, targetPrice, condition) {
    const sev = condition === 'below' ? 'danger' : 'success';
    return this.send({
      type: 'price_alert', severity: sev, agentName,
      title: `Price Alert — ${symbol} ${condition === 'above' ? '▲' : '▼'} $${targetPrice}`,
      body:  `${symbol} is now $${currentPrice.toFixed(4)} (target: ${condition} $${targetPrice})`,
      fields: [
        { name: 'Token',     value: symbol },
        { name: 'Current',   value: `$${currentPrice.toFixed(4)}` },
        { name: 'Target',    value: `${condition} $${targetPrice}` },
        { name: 'Direction', value: condition === 'above' ? '📈 Above target' : '📉 Below target' },
      ]
    });
  },

  async notifyFleetDecision(fleetName, goal, decision, approved) {
    return this.send({
      type: 'fleet_decision', severity: approved ? 'success' : 'warning', agentName: fleetName,
      title: `Fleet Decision — ${fleetName}`,
      body:  `${approved ? '✅ Approved' : '❌ Rejected'}: ${goal.slice(0, 120)}`,
      fields: [
        { name: 'Fleet',    value: fleetName },
        { name: 'Decision', value: approved ? 'APPROVED' : 'REJECTED' },
        { name: 'Action',   value: String(decision?.action || '—').slice(0, 80) },
      ]
    });
  },

  async notifyWhaleAlert(agentName, event) {
    return this.send({
      type: 'whale_alert', severity: 'warning', agentName,
      title: `🐳 Whale Alert — ${event.watcherLabel}`,
      body:  `Large on-chain movement detected on block ${event.blockNumber}`,
      fields: [
        { name: 'Watcher', value: event.watcherLabel },
        { name: 'Block',   value: String(event.blockNumber) },
        { name: 'Tx',      value: event.txHash ? event.txHash.slice(0,20) + '…' : '—' },
      ],
      url: event.txHash ? `https://arbiscan.io/tx/${event.txHash}` : null
    });
  },

  // ── Internal helpers ──────────────────────────────────────────────────────

  _maskChannel(ch) {
    return {
      id:         ch.id,
      name:       ch.name,
      type:       ch.type,
      enabled:    ch.enabled,
      sentCount:  ch.sentCount || 0,
      createdAt:  ch.createdAt,
      webhookUrl: ch.webhookUrl ? ch.webhookUrl.slice(0, 40) + '…' : null,
      botToken:   ch.botToken   ? ch.botToken.slice(0, 10) + '…'  : null,
      chatId:     ch.chatId     || null,
    };
  }
};
