import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const log = createLogger('webhook');
const DATA_DIR = process.env.HOME || process.cwd();
const WEBHOOKS_FILE = path.join(DATA_DIR, '.arb-agent', 'webhooks.json');
const HISTORY_FILE  = path.join(DATA_DIR, '.arb-agent', 'webhook_history.json');
const MAX_HISTORY   = 200;
const RETRY_DELAYS  = [1000, 5000, 15000];

function ensureDir(p) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

function saveJSON(file, data) {
  try {
    ensureDir(file);
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(file + '.tmp', file);
  } catch (e) { log.warn('Failed to save', { file, error: e.message }); }
}

class WebhookService {
  constructor() {
    this._hooks  = null;
    this._history = null;
  }

  _loadHooks()   { if (!this._hooks)    this._hooks   = loadJSON(WEBHOOKS_FILE, {}); return this._hooks; }
  _loadHistory() { if (!this._history)  this._history = loadJSON(HISTORY_FILE,  []); return this._history; }
  _saveHooks()   { saveJSON(WEBHOOKS_FILE, this._hooks); }
  _saveHistory() { saveJSON(HISTORY_FILE,  this._history.slice(-MAX_HISTORY)); }

  addWebhook({ name, url, events = ['*'], secret = null, enabled = true }) {
    if (!name || !url) throw new Error('name and url are required');
    try { new URL(url); } catch { throw new Error('Invalid URL'); }
    const hooks = this._loadHooks();
    if (hooks[name]) throw new Error(`Webhook "${name}" already exists`);
    const hook = {
      name, url, events, secret, enabled,
      created:      new Date().toISOString(),
      deliveryCount: 0,
      failCount:    0,
      lastDelivery: null
    };
    hooks[name] = hook;
    this._saveHooks();
    log.info('Webhook added', { name, url });
    return { ...hook, secret: secret ? '***' : null };
  }

  removeWebhook(name) {
    const hooks = this._loadHooks();
    if (!hooks[name]) throw new Error(`Webhook "${name}" not found`);
    delete hooks[name];
    this._saveHooks();
    return { removed: name };
  }

  toggleWebhook(name, enabled) {
    const hooks = this._loadHooks();
    if (!hooks[name]) throw new Error(`Webhook "${name}" not found`);
    hooks[name].enabled = enabled;
    this._saveHooks();
    return { ...hooks[name], secret: hooks[name].secret ? '***' : null };
  }

  listWebhooks() {
    const hooks = this._loadHooks();
    return Object.values(hooks).map(h => ({ ...h, secret: h.secret ? '***' : null }));
  }

  getWebhook(name) {
    const hooks = this._loadHooks();
    if (!hooks[name]) throw new Error(`Webhook "${name}" not found`);
    const h = hooks[name];
    return { ...h, secret: h.secret ? '***' : null };
  }

  async deliver(eventType, payload, agentName = null) {
    const hooks = this._loadHooks();
    const results = [];
    for (const hook of Object.values(hooks)) {
      if (!hook.enabled) continue;
      const matches = hook.events.includes('*') ||
                      hook.events.includes(eventType) ||
                      (agentName && hook.events.includes(`${agentName}:${eventType}`));
      if (!matches) continue;
      const result = await this._deliverToHook(hook, eventType, payload, agentName);
      results.push(result);
    }
    return results;
  }

  async _deliverToHook(hook, eventType, payload, agentName, attempt = 0) {
    const body = JSON.stringify({
      event:     eventType,
      agentName: agentName || null,
      payload,
      timestamp: new Date().toISOString()
    });

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent':   'ArbitrumAgent-Webhook/1.8',
      'X-Event-Type': eventType
    };
    if (hook.secret) {
      headers['X-Webhook-Secret'] = hook.secret;
    }

    let status = null;
    let error  = null;
    let ok     = false;

    try {
      const res = await fetch(hook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
      status = res.status;
      ok = res.ok;
    } catch (e) {
      error = e.message;
    }

    const entry = {
      id:        `wh_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      hookName:  hook.name,
      url:       hook.url,
      eventType,
      agentName: agentName || null,
      status,
      ok,
      error:     error || null,
      attempt:   attempt + 1,
      timestamp: new Date().toISOString()
    };

    const hooks = this._loadHooks();
    if (hooks[hook.name]) {
      hooks[hook.name].lastDelivery = entry.timestamp;
      if (ok) {
        hooks[hook.name].deliveryCount = (hooks[hook.name].deliveryCount || 0) + 1;
        hooks[hook.name].failCount = 0;
      } else {
        hooks[hook.name].failCount = (hooks[hook.name].failCount || 0) + 1;
      }
      this._saveHooks();
    }

    this._loadHistory().push(entry);
    this._saveHistory();

    if (!ok && attempt < RETRY_DELAYS.length - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      return this._deliverToHook(hook, eventType, payload, agentName, attempt + 1);
    }

    return entry;
  }

  async testWebhook(name) {
    const hooks = this._loadHooks();
    if (!hooks[name]) throw new Error(`Webhook "${name}" not found`);
    return this._deliverToHook(hooks[name], 'test', { message: 'Webhook test from Arbitrum AI Agent' }, null);
  }

  getHistory(limit = 50, hookName = null) {
    const h = this._loadHistory();
    const filtered = hookName ? h.filter(e => e.hookName === hookName) : h;
    return filtered.slice(-limit).reverse();
  }
}

export const webhookService = new WebhookService();
