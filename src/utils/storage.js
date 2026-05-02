import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

const log = createLogger('storage');
const DATA_DIR         = '.arb-agent';
const AGENTS_FILE      = 'agents.json';
const ACTIVE_AGENT_FILE = 'active_agent.json';
const STRATEGIES_DIR   = 'strategies';

function ensureDataDir() {
  const homeDir = process.env.HOME || process.cwd();
  const dataDir = path.join(homeDir, DATA_DIR);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function getFilePath(filename) {
  return path.join(ensureDataDir(), filename);
}

function safeParse(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    log.warn(`Failed to parse file: ${filePath}`, { error: err.message });
    return fallback;
  }
}

function safeWrite(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
    return true;
  } catch (err) {
    log.error(`Failed to write file: ${filePath}`, { error: err.message });
    return false;
  }
}

export const storage = {

  saveActiveAgent(agentName) {
    return safeWrite(getFilePath(ACTIVE_AGENT_FILE), { name: agentName });
  },

  loadActiveAgent() {
    const filePath = getFilePath(ACTIVE_AGENT_FILE);
    if (!fs.existsSync(filePath)) return null;
    const data = safeParse(filePath, null);
    return data?.name || null;
  },

  saveAgents(agents) {
    const data = agents.map(agent => ({
      name:            agent.name,
      type:            agent.type,
      network:         agent.network,
      interestFreeMode: agent.interestFreeMode === true,
      capabilities:    agent.capabilities,
      created:         agent.created || new Date().toISOString(),
      isDeployed:      agent.isDeployed === true,
      contractAddress: agent.contractAddress || null,
      deploymentTx:    agent.deploymentTx || null
    }));
    const ok = safeWrite(getFilePath(AGENTS_FILE), data);
    if (!ok) log.warn('Failed to save agents to disk');
    return ok;
  },

  loadAgents() {
    const filePath = getFilePath(AGENTS_FILE);
    if (!fs.existsSync(filePath)) return [];
    return safeParse(filePath, []);
  },

  deleteAgent(name) {
    const agents  = this.loadAgents();
    const filtered = agents.filter(a => a.name !== name);
    this.saveAgents(filtered);
    // Clean up strategies
    this.deleteAgentStrategies(name);
    return agents.length !== filtered.length;
  },

  getDataDir() {
    return ensureDataDir();
  },

  // ── Strategy Persistence ─────────────────────────────────────────────────

  saveStrategies(agentName, strategies) {
    const dir  = path.join(ensureDataDir(), STRATEGIES_DIR);
    const file = path.join(dir, `${agentName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    const serialized = [...strategies.values()].map(s => ({
      id:          s.id,
      type:        s.type,
      description: s.description,
      trigger:     s.trigger,
      action:      s.action,
      status:      s.status,
      executions:  s.executions,
      created:     s.created
    }));
    return safeWrite(file, serialized);
  },

  loadStrategies(agentName) {
    const dir  = path.join(ensureDataDir(), STRATEGIES_DIR);
    const file = path.join(dir, `${agentName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    if (!fs.existsSync(file)) return [];
    return safeParse(file, []);
  },

  deleteAgentStrategies(agentName) {
    const dir  = path.join(ensureDataDir(), STRATEGIES_DIR);
    const file = path.join(dir, `${agentName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return true;
    } catch (err) {
      log.warn('Failed to delete strategy file', { agentName, error: err.message });
      return false;
    }
  }
};
