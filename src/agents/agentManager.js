import { BaseAgent } from './baseAgent.js';
import { TradingAgent } from './tradingAgent.js';
import { DeFiAgent } from './defiAgent.js';
import { OnchainAgent } from './onchainAgent.js';
import { NFTAgent } from './nftAgent.js';
import { SocialAgent } from './socialAgent.js';
import { CustomAgent } from './customAgent.js';
import { config } from '../utils/config.js';
import { storage } from '../utils/storage.js';

export class AgentManager {
  constructor() {
    this.agents = new Map();
    this.activeAgent = null;
    this.loadPersistedAgents();
  }

  loadPersistedAgents() {
    const savedAgents = storage.loadAgents();
    for (const agentData of savedAgents) {
      try {
        const options = { interestFreeMode: agentData.interestFreeMode === true };
        let agent;
        switch (agentData.type) {
          case 'trading':
            agent = new TradingAgent(agentData.name, agentData.network, options);
            break;
          case 'defi':
            agent = new DeFiAgent(agentData.name, agentData.network, options);
            break;
          case 'onchain':
            agent = new OnchainAgent(agentData.name, agentData.network, options);
            agent.isDeployed = agentData.isDeployed || false;
            agent.contractAddress = agentData.contractAddress || null;
            agent.deploymentTx = agentData.deploymentTx || null;
            break;
          case 'nft':
            agent = new NFTAgent(agentData.name, agentData.network, options);
            break;
          case 'social':
            agent = new SocialAgent(agentData.name, agentData.network, options);
            break;
          case 'custom':
            agent = new CustomAgent(agentData.name, agentData.network, options);
            break;
          default:
            agent = new BaseAgent(agentData.name, agentData.type, agentData.network, options);
        }
        agent.created = agentData.created;
        this.agents.set(agentData.name, agent);
      } catch (error) {
        console.error(`Failed to restore agent ${agentData.name}:`, error.message);
      }
    }
    
    const activeAgentName = storage.loadActiveAgent();
    if (activeAgentName && this.agents.has(activeAgentName)) {
      this.activeAgent = this.agents.get(activeAgentName);
    }
  }

  persistAgents() {
    const agents = Array.from(this.agents.values()).map(a => a.getInfo());
    storage.saveAgents(agents);
  }

  createAgent(name, type, network = 'sepolia', options = {}) {
    if (this.agents.has(name)) {
      throw new Error(`Agent "${name}" already exists`);
    }

    let agent;
    switch (type) {
      case 'trading':
        agent = new TradingAgent(name, network, options);
        break;
      case 'defi':
        agent = new DeFiAgent(name, network, options);
        break;
      case 'onchain':
        agent = new OnchainAgent(name, network, options);
        break;
      case 'nft':
        agent = new NFTAgent(name, network, options);
        break;
      case 'social':
        agent = new SocialAgent(name, network, options);
        break;
      case 'custom':
        agent = new CustomAgent(name, network, options);
        break;
      default:
        agent = new BaseAgent(name, type, network, options);
    }

    agent.created = new Date().toISOString();
    this.agents.set(name, agent);
    this.persistAgents();
    return agent;
  }

  getAgent(name) {
    return this.agents.get(name);
  }

  setActiveAgent(name) {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent "${name}" not found`);
    }
    this.activeAgent = agent;
    storage.saveActiveAgent(name);
    return agent;
  }

  getActiveAgent() {
    return this.activeAgent;
  }

  listAgents() {
    return Array.from(this.agents.values()).map(agent => agent.getInfo());
  }

  deleteAgent(name) {
    if (this.activeAgent?.name === name) {
      this.activeAgent = null;
    }
    const result = this.agents.delete(name);
    if (result) {
      this.persistAgents();
    }
    return result;
  }

  getAgentTypes() {
    return Object.entries(config.agentTypes).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }
}

export const agentManager = new AgentManager();
