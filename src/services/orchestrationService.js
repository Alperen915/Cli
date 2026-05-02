/**
 * OrchestrationService — manages named AgentFleets.
 * Persists fleet configurations to disk.
 * Keeps live orchestrator instances in memory.
 */
import path   from 'path';
import fs     from 'fs';
import { AgentOrchestrator, VALID_ROLES } from '../agents/orchestrator.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('orchestrationService');

// ── Persistence ───────────────────────────────────────────────────────────────

function fleetDir() {
  const home = process.env.HOME || process.cwd();
  const dir  = path.join(home, '.arb-agent', 'fleets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fleetFile(name) {
  return path.join(fleetDir(), `${name}.json`);
}

function loadFleetConfig(name) {
  const file = fleetFile(name);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch(e) { return null; }
}

function saveFleetConfig(cfg) {
  const file = fleetFile(cfg.name);
  const tmp  = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, file);
}

function deleteFleetConfig(name) {
  const file = fleetFile(name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function listFleetConfigs() {
  const dir = fleetDir();
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); }
      catch(e) { return null; }
    })
    .filter(Boolean);
}

// ── In-memory registry ────────────────────────────────────────────────────────

const fleets = new Map(); // name → AgentOrchestrator

function getOrCreate(name) {
  if (fleets.has(name)) return fleets.get(name);

  const cfg = loadFleetConfig(name);
  if (!cfg) throw new Error(`Fleet "${name}" not found. Create it first.`);

  const fleet = new AgentOrchestrator(cfg);

  // Restore agents
  for (const agentCfg of cfg.agents || []) {
    try {
      fleet.addAgent(agentCfg.role, agentCfg.name, agentCfg.type || 'trading', agentCfg.options || {});
    } catch(e) {
      log.warn(`Skipped agent restore`, { role: agentCfg.role, err: e.message });
    }
  }

  fleets.set(name, fleet);
  log.info(`Fleet "${name}" loaded from disk`);
  return fleet;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const orchestrationService = {

  // Create a new fleet
  createFleet({ name, description = '', network = 'sepolia', consensusThreshold = 0.6 }) {
    if (!/^[a-z0-9_-]+$/i.test(name) || name.length > 64) {
      throw new Error('Fleet name must be alphanumeric (a-z, 0-9, -, _), max 64 chars');
    }
    if (loadFleetConfig(name)) throw new Error(`Fleet "${name}" already exists`);

    const cfg = { name, description, network, consensusThreshold, createdAt: new Date().toISOString(), agents: [] };
    saveFleetConfig(cfg);

    const fleet = new AgentOrchestrator(cfg);
    fleets.set(name, fleet);
    log.info(`Fleet created: "${name}"`);
    return fleet.getStatus();
  },

  // Delete fleet
  deleteFleet(name) {
    const fleet = fleets.get(name);
    if (fleet) fleets.delete(name);
    deleteFleetConfig(name);
    return { deleted: true };
  },

  // List all fleets
  listFleets() {
    return listFleetConfigs().map(cfg => ({
      name:        cfg.name,
      description: cfg.description,
      network:     cfg.network,
      agentCount:  (cfg.agents || []).length,
      createdAt:   cfg.createdAt
    }));
  },

  // Get fleet status
  getFleet(name) {
    return getOrCreate(name).getStatus();
  },

  // Add sub-agent to fleet
  addAgent(fleetName, { role, agentName, agentType = 'trading', options = {} }) {
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role. Valid roles: ${VALID_ROLES.join(', ')}`);
    }

    const fleet = getOrCreate(fleetName);
    const result = fleet.addAgent(role, agentName, agentType, options);

    // Persist
    const cfg = loadFleetConfig(fleetName);
    cfg.agents = cfg.agents.filter(a => a.role !== role); // replace if same role
    cfg.agents.push({ role, name: agentName, type: agentType, options });
    saveFleetConfig(cfg);

    return result;
  },

  // Remove sub-agent
  removeAgent(fleetName, role) {
    const fleet = getOrCreate(fleetName);
    const ok    = fleet.removeAgent(role);

    const cfg = loadFleetConfig(fleetName);
    cfg.agents = cfg.agents.filter(a => a.role !== role);
    saveFleetConfig(cfg);

    return { removed: ok };
  },

  // Coordinate — send goal to entire fleet
  async coordinate(fleetName, goal, options = {}) {
    const fleet = getOrCreate(fleetName);
    return fleet.coordinate(goal, options);
  },

  // Ask a specific role
  async askAgent(fleetName, role, message) {
    const fleet = getOrCreate(fleetName);
    return fleet.askAgent(role, message);
  },

  // Vote on a proposal
  async vote(fleetName, proposal) {
    const fleet = getOrCreate(fleetName);
    return fleet.vote(proposal);
  },

  // Message history
  getHistory(fleetName, limit = 50) {
    const fleet = getOrCreate(fleetName);
    return fleet.getHistory(limit);
  },

  // Raw orchestrator instance (for SSE)
  getRawFleet(fleetName) {
    return fleets.get(fleetName) || null;
  }
};
