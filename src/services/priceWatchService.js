import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import { priceService } from './priceService.js';
import { notificationService } from './notificationService.js';
import { webhookService } from './webhookService.js';

const log = createLogger('pricewatch');
const DATA_DIR   = process.env.HOME || process.cwd();
const WATCH_FILE = path.join(DATA_DIR, '.arb-agent', 'price_watches.json');
const DEFAULT_INTERVAL_MS = 60_000;

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

function saveJSON(file, data) {
  try {
    const d = path.dirname(file);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(file + '.tmp', file);
  } catch (e) { log.warn('save failed', { error: e.message }); }
}

class PriceWatchService {
  constructor() {
    this._watches  = null;
    this._timers   = new Map();
    this._started  = false;
  }

  _load()  { if (!this._watches) this._watches = loadJSON(WATCH_FILE, {}); return this._watches; }
  _save()  { saveJSON(WATCH_FILE, this._watches); }

  addWatch({ id, agentName, token, condition, targetPrice, intervalMs = DEFAULT_INTERVAL_MS, notifyChannels = [] }) {
    const watches = this._load();
    const watchId = id || `pw_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    if (watches[watchId]) throw new Error(`Watch "${watchId}" already exists`);

    if (!['above', 'below', 'change_pct'].includes(condition)) {
      throw new Error('condition must be above | below | change_pct');
    }

    const watch = {
      id: watchId, agentName, token: token.toUpperCase(),
      condition, targetPrice: parseFloat(targetPrice),
      intervalMs, notifyChannels,
      enabled: true,
      triggerCount: 0,
      lastPrice: null,
      basePrice:  null,
      created:    new Date().toISOString(),
      lastChecked: null,
      lastTriggered: null
    };
    watches[watchId] = watch;
    this._save();
    this._scheduleWatch(watchId);
    log.info('Price watch added', { watchId, token, condition, targetPrice });
    return watch;
  }

  removeWatch(watchId) {
    const watches = this._load();
    if (!watches[watchId]) throw new Error(`Watch "${watchId}" not found`);
    delete watches[watchId];
    this._save();
    if (this._timers.has(watchId)) {
      clearInterval(this._timers.get(watchId));
      this._timers.delete(watchId);
    }
    return { removed: watchId };
  }

  toggleWatch(watchId, enabled) {
    const watches = this._load();
    if (!watches[watchId]) throw new Error(`Watch "${watchId}" not found`);
    watches[watchId].enabled = enabled;
    this._save();
    if (enabled) this._scheduleWatch(watchId);
    else if (this._timers.has(watchId)) {
      clearInterval(this._timers.get(watchId));
      this._timers.delete(watchId);
    }
    return watches[watchId];
  }

  listWatches(agentName = null) {
    const watches = this._load();
    const all = Object.values(watches);
    return agentName ? all.filter(w => w.agentName === agentName) : all;
  }

  getWatch(watchId) {
    const watches = this._load();
    if (!watches[watchId]) throw new Error(`Watch "${watchId}" not found`);
    return watches[watchId];
  }

  startAll() {
    if (this._started) return;
    this._started = true;
    const watches = this._load();
    for (const watchId of Object.keys(watches)) {
      if (watches[watchId].enabled) this._scheduleWatch(watchId);
    }
    log.info('Price watch service started', { count: Object.keys(watches).length });
  }

  stopAll() {
    for (const [id, timer] of this._timers) {
      clearInterval(timer);
    }
    this._timers.clear();
    this._started = false;
    log.info('Price watch service stopped');
  }

  _scheduleWatch(watchId) {
    if (this._timers.has(watchId)) clearInterval(this._timers.get(watchId));
    const watches = this._load();
    const watch = watches[watchId];
    if (!watch || !watch.enabled) return;

    const interval = setInterval(() => this._checkWatch(watchId), watch.intervalMs);
    this._timers.set(watchId, interval);
    this._checkWatch(watchId);
  }

  async _checkWatch(watchId) {
    const watches = this._load();
    const watch = watches[watchId];
    if (!watch || !watch.enabled) return;

    try {
      const data = await priceService.getTokenPrice(watch.token);
      const price = data.price;
      watches[watchId].lastPrice   = price;
      watches[watchId].lastChecked = new Date().toISOString();
      if (!watches[watchId].basePrice) watches[watchId].basePrice = price;
      this._save();

      let triggered = false;
      let message = '';

      if (watch.condition === 'above' && price >= watch.targetPrice) {
        triggered = true;
        message = `${watch.token} is above $${watch.targetPrice.toLocaleString()} (current: $${price.toLocaleString()})`;
      } else if (watch.condition === 'below' && price <= watch.targetPrice) {
        triggered = true;
        message = `${watch.token} is below $${watch.targetPrice.toLocaleString()} (current: $${price.toLocaleString()})`;
      } else if (watch.condition === 'change_pct' && watch.basePrice) {
        const changePct = Math.abs((price - watch.basePrice) / watch.basePrice * 100);
        if (changePct >= watch.targetPrice) {
          triggered = true;
          const dir = price > watch.basePrice ? 'up' : 'down';
          message = `${watch.token} moved ${dir} ${changePct.toFixed(2)}% (base: $${watch.basePrice.toLocaleString()}, current: $${price.toLocaleString()})`;
          watches[watchId].basePrice = price;
        }
      }

      if (triggered) {
        watches[watchId].triggerCount  = (watch.triggerCount || 0) + 1;
        watches[watchId].lastTriggered = new Date().toISOString();
        this._save();
        log.info('Price watch triggered', { watchId, message });
        await this._notify(watch, price, message);
      }
    } catch (e) {
      log.warn('Price check failed', { watchId, error: e.message });
    }
  }

  async _notify(watch, price, message) {
    try {
      await notificationService.notifyPriceAlert(watch.agentName || 'system', watch.token, price, {
        threshold: watch.targetPrice,
        condition: watch.condition,
        watchId:   watch.id
      });
    } catch {}

    try {
      await webhookService.deliver('price_alert', {
        watchId:     watch.id,
        agentName:   watch.agentName,
        token:       watch.token,
        price,
        condition:   watch.condition,
        targetPrice: watch.targetPrice,
        message
      }, watch.agentName);
    } catch {}
  }
}

export const priceWatchService = new PriceWatchService();
