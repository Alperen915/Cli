import fs from 'fs';
import path from 'path';

const DATA_DIR = '.arb-agent';
const AGENTS_FILE = 'agents.json';

function ensureDataDir() {
  const homeDir = process.env.HOME || process.cwd();
  const dataDir = path.join(homeDir, DATA_DIR);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function getFilePath(filename) {
  const dataDir = ensureDataDir();
  return path.join(dataDir, filename);
}

const ACTIVE_AGENT_FILE = 'active_agent.json';

export const storage = {
  saveActiveAgent(agentName) {
    try {
      const filePath = getFilePath(ACTIVE_AGENT_FILE);
      fs.writeFileSync(filePath, JSON.stringify({ name: agentName }));
      return true;
    } catch (error) {
      return false;
    }
  },

  loadActiveAgent() {
    try {
      const filePath = getFilePath(ACTIVE_AGENT_FILE);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return data.name;
      }
    } catch (error) {
      console.warn('[storage] Failed to load active agent:', error.message);
    }
    return null;
  },

  saveAgents(agents) {
    try {
      const filePath = getFilePath(AGENTS_FILE);
      const data = agents.map(agent => ({
        name: agent.name,
        type: agent.type,
        network: agent.network,
        interestFreeMode: agent.interestFreeMode === true,
        capabilities: agent.capabilities,
        created: agent.created || new Date().toISOString(),
        isDeployed: agent.isDeployed === true,
        contractAddress: agent.contractAddress || null,
        deploymentTx: agent.deploymentTx || null
      }));
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save agents:', error.message);
      return false;
    }
  },

  loadAgents() {
    try {
      const filePath = getFilePath(AGENTS_FILE);
      if (!fs.existsSync(filePath)) {
        return [];
      }
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load agents:', error.message);
      return [];
    }
  },

  deleteAgent(name) {
    const agents = this.loadAgents();
    const filtered = agents.filter(a => a.name !== name);
    this.saveAgents(filtered);
    return agents.length !== filtered.length;
  },

  getDataDir() {
    return ensureDataDir();
  }
};
