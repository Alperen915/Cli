import fs from 'fs';
import path from 'path';
import os from 'os';
import { priceService } from './priceService.js';

const ALERTS_FILE = path.join(os.homedir(), '.arb-agent', 'alerts.json');

class AlertService {
  constructor() {
    this.alerts = this.loadAlerts();
  }

  loadAlerts() {
    try {
      if (fs.existsSync(ALERTS_FILE)) {
        return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load alerts:', e.message);
    }
    return [];
  }

  saveAlerts() {
    try {
      const dir = path.dirname(ALERTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(ALERTS_FILE, JSON.stringify(this.alerts, null, 2));
    } catch (e) {
      console.error('Failed to save alerts:', e.message);
    }
  }

  createAlert(type, params) {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert = {
      id,
      type,
      ...params,
      createdAt: new Date().toISOString(),
      triggered: false,
      triggeredAt: null
    };

    this.alerts.push(alert);
    this.saveAlerts();
    return alert;
  }

  createPriceAlert(symbol, condition, targetPrice) {
    return this.createAlert('price', {
      symbol: symbol.toUpperCase(),
      condition, // 'above' or 'below'
      targetPrice: parseFloat(targetPrice)
    });
  }

  createPercentageAlert(symbol, changePercent, timeframe = '24h') {
    return this.createAlert('percentage', {
      symbol: symbol.toUpperCase(),
      changePercent: parseFloat(changePercent),
      timeframe
    });
  }

  createWhaleAlert(minValueUsd = 100000) {
    return this.createAlert('whale', {
      minValueUsd: parseFloat(minValueUsd)
    });
  }

  getAlerts() {
    return this.alerts;
  }

  getActiveAlerts() {
    return this.alerts.filter(a => !a.triggered);
  }

  getTriggeredAlerts() {
    return this.alerts.filter(a => a.triggered);
  }

  deleteAlert(id) {
    const index = this.alerts.findIndex(a => a.id === id);
    if (index >= 0) {
      this.alerts.splice(index, 1);
      this.saveAlerts();
      return true;
    }
    return false;
  }

  clearAllAlerts() {
    this.alerts = [];
    this.saveAlerts();
  }

  async checkAlerts() {
    const triggered = [];

    for (const alert of this.alerts) {
      if (alert.triggered) continue;

      try {
        if (alert.type === 'price') {
          const price = await priceService.getTokenPrice(alert.symbol);
          const currentPrice = price.price;

          let isTriggered = false;
          if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
            isTriggered = true;
          } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
            isTriggered = true;
          }

          if (isTriggered) {
            alert.triggered = true;
            alert.triggeredAt = new Date().toISOString();
            alert.triggeredPrice = currentPrice;
            triggered.push({
              ...alert,
              message: `${alert.symbol} is now ${alert.condition} $${alert.targetPrice} (current: $${currentPrice.toFixed(4)})`
            });
          }
        }

        if (alert.type === 'percentage') {
          const price = await priceService.getTokenPrice(alert.symbol);
          const change = Math.abs(price.change24h);

          if (change >= Math.abs(alert.changePercent)) {
            alert.triggered = true;
            alert.triggeredAt = new Date().toISOString();
            alert.triggeredChange = price.change24h;
            triggered.push({
              ...alert,
              message: `${alert.symbol} moved ${price.change24h.toFixed(2)}% in 24h (threshold: ${alert.changePercent}%)`
            });
          }
        }
      } catch (e) {
        // Skip failed checks
      }
    }

    if (triggered.length > 0) {
      this.saveAlerts();
    }

    return triggered;
  }

  formatAlert(alert) {
    const status = alert.triggered ? '✅ Triggered' : '⏳ Active';
    
    if (alert.type === 'price') {
      return `[${status}] ${alert.symbol} ${alert.condition} $${alert.targetPrice}`;
    }
    
    if (alert.type === 'percentage') {
      return `[${status}] ${alert.symbol} moves ${alert.changePercent}% in ${alert.timeframe}`;
    }
    
    if (alert.type === 'whale') {
      return `[${status}] Whale activity > $${alert.minValueUsd}`;
    }
    
    return `[${status}] Unknown alert type`;
  }
}

export const alertService = new AlertService();
