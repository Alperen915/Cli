import { AgentManager } from '../agents/agentManager.js';

function freshManager() {
  return new AgentManager();
}

export const agentService = {
  createAgent(name, type, network = 'sepolia', options = {}) {
    if (!name || !type) {
      throw new Error('Name and type are required');
    }
    const validTypes = ['trading', 'defi', 'onchain', 'nft', 'social', 'custom'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
    const mgr = freshManager();
    const agent = mgr.createAgent(name, type, network, options);
    return this.serializeAgent(agent);
  },

  listAgents() {
    return freshManager().listAgents().map(agent => this.serializeAgent(agent));
  },

  getAgent(name) {
    const mgr = freshManager();
    const agent = mgr.getAgent(name);
    if (!agent) {
      throw new Error(`Agent "${name}" not found`);
    }
    return this.serializeAgent(agent);
  },

  deleteAgent(name) {
    const mgr = freshManager();
    const deleted = mgr.deleteAgent(name);
    if (!deleted) {
      throw new Error(`Agent "${name}" not found`);
    }
    return { success: true, message: `Agent "${name}" deleted` };
  },

  setActiveAgent(name) {
    const mgr = freshManager();
    const agent = mgr.setActiveAgent(name);
    if (!agent) {
      throw new Error(`Agent "${name}" not found`);
    }
    return this.serializeAgent(agent);
  },

  getActiveAgent() {
    const mgr = freshManager();
    const agent = mgr.getActiveAgent();
    if (!agent) return null;
    return this.serializeAgent(agent);
  },

  async chat(name, message, aiOptions = {}) {
    const mgr = freshManager();
    const agent = mgr.getAgent(name);
    if (!agent) {
      throw new Error(`Agent "${name}" not found`);
    }

    if (aiOptions.apiKey || aiOptions.provider) {
      agent._initAI(
        aiOptions.provider || 'openai',
        aiOptions.apiKey,
        { model: aiOptions.model }
      );
    }

    const response = await agent.think(message);
    return {
      agent: name,
      message,
      response,
      aiProvider: agent.aiProvider || null,
      aiModel: agent.aiModel || null
    };
  },

  serializeAgent(agent) {
    return {
      name: agent.name,
      type: agent.type,
      network: agent.network,
      interestFreeMode: agent.interestFreeMode === true,
      capabilities: agent.capabilities,
      created: agent.created,
      isDeployed: agent.isDeployed === true,
      contractAddress: agent.contractAddress || null,
      deploymentTx: agent.deploymentTx || null,
      aiEnabled: agent.hasAI ? agent.hasAI() : false,
      aiProvider: agent.aiProvider || null,
      aiModel: agent.aiModel || null
    };
  }
};
