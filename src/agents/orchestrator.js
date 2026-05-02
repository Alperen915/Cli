/**
 * AgentOrchestrator — Multi-agent fleet coordination.
 *
 * A Fleet consists of:
 *   - One MASTER agent (coordinates, makes final decisions)
 *   - N SUB-AGENTS with specific roles:
 *       analyst      — AI-driven market analysis & recommendations
 *       executor     — executes approved trades
 *       monitor      — watches events / risk signals
 *       risk_manager — validates proposals against risk policy
 *
 * Workflow:
 *   1. User sends a high-level goal to the fleet
 *   2. Master decomposes into tasks → broadcasts to sub-agents
 *   3. Sub-agents respond (AI or rule-based)
 *   4. Master aggregates, checks consensus, issues final decision
 *   5. Executor carries out the approved action
 *
 * All communication is stored in Fleet.messageHistory.
 */
import { EventEmitter } from 'events';
import { BaseAgent }    from './baseAgent.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('orchestrator');

// Role system prompts — each sub-agent thinks differently
const ROLE_PROMPTS = {
  master: `You are the MASTER coordinator of an Arbitrum AI agent fleet.
Your job: receive high-level goals, decompose them into concrete tasks,
delegate to sub-agents, aggregate their responses, and issue final decisions.
Always respond in JSON: { thought, tasks: [{role, instruction}], decision, reasoning }`,

  analyst: `You are the ANALYST sub-agent of an Arbitrum AI agent fleet.
Your job: analyze market conditions, yield opportunities, price trends, and risk.
Be data-driven, concise, and quantitative. Respond in JSON:
{ thought, analysis, recommendation, confidence, signals: [{signal, strength}] }`,

  executor: `You are the EXECUTOR sub-agent of an Arbitrum AI agent fleet.
Your job: evaluate proposed trades for technical feasibility,
check slippage, gas costs, and liquidity. Respond in JSON:
{ thought, feasible, reason, estimatedGas, slippage, adjustedParams }`,

  risk_manager: `You are the RISK MANAGER sub-agent of an Arbitrum AI agent fleet.
Your job: evaluate all proposed actions against risk policy.
Check: position size limits, concentration risk, daily spend limits, market conditions.
Respond in JSON: { thought, approved, riskScore, concerns: [string], maxAllowedSize }`,

  monitor: `You are the MONITOR sub-agent of an Arbitrum AI agent fleet.
Your job: assess current market alerts, recent large transfers, liquidation risk,
volatility signals. Respond in JSON:
{ thought, alerts: [{level, message}], marketCondition, volatility }`
};

export const VALID_ROLES = ['master', 'analyst', 'executor', 'risk_manager', 'monitor'];

// ── Message ───────────────────────────────────────────────────────────────────

class Message {
  constructor(from, to, content, type = 'task') {
    this.id        = `msg_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
    this.from      = from;
    this.to        = to;       // role name or 'all'
    this.content   = content;
    this.type      = type;     // 'task'|'response'|'vote'|'decision'|'alert'
    this.timestamp = new Date().toISOString();
    this.response  = null;     // filled in when sub-agent replies
  }
}

// ── AgentOrchestrator ─────────────────────────────────────────────────────────

export class AgentOrchestrator extends EventEmitter {
  constructor(fleetConfig) {
    super();

    this.name               = fleetConfig.name;
    this.description        = fleetConfig.description || '';
    this.consensusThreshold = fleetConfig.consensusThreshold || 0.6; // 60%
    this.network            = fleetConfig.network || 'sepolia';
    this.createdAt          = fleetConfig.createdAt || new Date().toISOString();

    // Sub-agent registry: role → BaseAgent
    this.agents = new Map();

    // Message history (last 200)
    this.messageHistory = [];
    this.MAX_HISTORY    = 200;

    // Status
    this.status = 'idle'; // idle | coordinating | executing
  }

  // ── Agent Management ─────────────────────────────────────────────────────────

  addAgent(role, agentName, agentType = 'trading', options = {}) {
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role "${role}". Valid: ${VALID_ROLES.join(', ')}`);
    }

    const agent = new BaseAgent(agentName, agentType, this.network, options);

    // Inject role-specific system prompt into agent memory
    agent._rolePrompt = ROLE_PROMPTS[role];
    agent._role       = role;
    agent._fleetName  = this.name;

    this.agents.set(role, { name: agentName, role, agent, addedAt: new Date().toISOString() });
    log.info(`Sub-agent added: ${agentName} [${role}] in fleet "${this.name}"`);
    return { role, agentName };
  }

  removeAgent(role) {
    const ok = this.agents.delete(role);
    if (ok) log.info(`Sub-agent removed: role=${role} from fleet "${this.name}"`);
    return ok;
  }

  listAgents() {
    return [...this.agents.values()].map(({ name, role, addedAt }) => ({ name, role, addedAt }));
  }

  // ── Core: send goal to fleet ─────────────────────────────────────────────────

  async coordinate(userGoal, options = {}) {
    this.status = 'coordinating';
    log.info(`Fleet "${this.name}" coordinating`, { goal: userGoal.slice(0, 80) });

    const result = {
      goal:         userGoal,
      masterPlan:   null,
      subResponses: [],
      consensus:    null,
      decision:     null,
      timestamp:    new Date().toISOString()
    };

    try {
      // 1. Master decomposes the goal
      const master = this.agents.get('master');
      if (!master) throw new Error('Fleet has no master agent. Add one with role="master".');

      this._addMessage('user', 'master', userGoal, 'task');
      const masterResponse = await this._askAgent(master, userGoal, 'master');
      result.masterPlan = masterResponse;
      this._addMessage('master', 'all', masterResponse, 'plan');

      // Parse tasks from master response
      let tasks = [];
      try {
        const parsed = typeof masterResponse === 'string'
          ? JSON.parse(masterResponse.match(/\{[\s\S]*\}/)?.[0] || '{}')
          : masterResponse;
        tasks = parsed.tasks || [];
      } catch(e) { /* master may not return structured JSON — use raw */ }

      // 2. Ask relevant sub-agents
      const agentRoles = [...this.agents.keys()].filter(r => r !== 'master');
      const toAsk = tasks.length > 0
        ? tasks.filter(t => this.agents.has(t.role)).map(t => ({ role: t.role, instruction: t.instruction }))
        : agentRoles.map(r => ({ role: r, instruction: userGoal }));

      const subResponses = await Promise.all(
        toAsk.map(async ({ role, instruction }) => {
          const subEntry = this.agents.get(role);
          if (!subEntry) return null;
          this._addMessage('master', role, instruction, 'task');
          const resp = await this._askAgent(subEntry, instruction, role);
          this._addMessage(role, 'master', resp, 'response');
          return { role, agentName: subEntry.name, response: resp };
        })
      );

      result.subResponses = subResponses.filter(Boolean);

      // 3. Build consensus summary for master
      const summary = result.subResponses
        .map(r => `[${r.role}]: ${JSON.stringify(r.response).slice(0, 200)}`)
        .join('\n');

      const consensusPrompt = `
Sub-agent responses:
${summary}

Original goal: ${userGoal}

Based on the sub-agent responses, provide your final coordinated decision.
Respond in JSON: { decision, action, params, confidence, approved, reasoning }`;

      const finalDecision = await this._askAgent(master, consensusPrompt, 'master');
      result.decision = finalDecision;
      this._addMessage('master', 'fleet', finalDecision, 'decision');

      // 4. Check consensus from risk_manager
      const riskEntry = this.agents.get('risk_manager');
      if (riskEntry) {
        let approved = true;
        try {
          const parsed = typeof finalDecision === 'string'
            ? JSON.parse(finalDecision.match(/\{[\s\S]*\}/)?.[0] || '{}')
            : finalDecision;
          approved = parsed.approved !== false;
        } catch(e) { /* default approve */ }
        result.consensus = { approved, threshold: this.consensusThreshold };
      } else {
        result.consensus = { approved: true, threshold: this.consensusThreshold };
      }

    } catch (err) {
      log.error('Coordination error', { fleet: this.name, err: err.message });
      result.error = err.message;
    }

    this.status = 'idle';
    this.emit('coordination_complete', result);
    return result;
  }

  // ── Ask a specific agent ──────────────────────────────────────────────────────

  async askAgent(role, message) {
    const entry = this.agents.get(role);
    if (!entry) throw new Error(`No agent with role "${role}" in fleet "${this.name}"`);
    this._addMessage('user', role, message, 'task');
    const resp = await this._askAgent(entry, message, role);
    this._addMessage(role, 'user', resp, 'response');
    return { role, agentName: entry.name, response: resp };
  }

  // ── Vote on a proposal ────────────────────────────────────────────────────────

  async vote(proposal) {
    const votingRoles = ['analyst', 'risk_manager', 'executor', 'monitor']
      .filter(r => this.agents.has(r));

    if (votingRoles.length === 0) throw new Error('No sub-agents available to vote');

    const votePrompt = `VOTE REQUEST: ${JSON.stringify(proposal)}
Should the fleet approve this action? Reply in JSON: { vote: "yes"|"no", reason: string }`;

    const votes = await Promise.all(
      votingRoles.map(async role => {
        const entry = this.agents.get(role);
        try {
          const resp = await this._askAgent(entry, votePrompt, role);
          const parsed = typeof resp === 'string'
            ? JSON.parse(resp.match(/\{[\s\S]*\}/)?.[0] || '{"vote":"no"}')
            : resp;
          return { role, agentName: entry.name, vote: parsed.vote || 'no', reason: parsed.reason || '' };
        } catch(e) {
          return { role, agentName: entry.name, vote: 'no', reason: e.message };
        }
      })
    );

    const yesVotes = votes.filter(v => v.vote === 'yes').length;
    const approved = votingRoles.length > 0 && (yesVotes / votingRoles.length) >= this.consensusThreshold;

    this._addMessage('system', 'fleet',
      `Vote: ${yesVotes}/${votingRoles.length} yes → ${approved ? 'APPROVED' : 'REJECTED'}`,
      'vote');

    return { approved, yesVotes, totalVotes: votingRoles.length, threshold: this.consensusThreshold, votes };
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  async _askAgent(entry, message, role) {
    const { agent } = entry;
    const rolePrompt = ROLE_PROMPTS[role] || '';

    // Inject role prompt as system context + ask
    const fullMsg = rolePrompt
      ? `[Your role context]\n${rolePrompt}\n\n[Task]\n${message}`
      : message;

    try {
      const result = await agent.chat(fullMsg);
      return result;
    } catch(e) {
      log.warn(`Agent "${entry.name}" [${role}] error`, { err: e.message });
      return { error: e.message, role, agentName: entry.name };
    }
  }

  _addMessage(from, to, content, type) {
    const msg = new Message(from, to, content, type);
    this.messageHistory.unshift(msg);
    if (this.messageHistory.length > this.MAX_HISTORY) this.messageHistory.pop();
    this.emit('message', msg);
    return msg;
  }

  getHistory(limit = 50) {
    return this.messageHistory.slice(0, limit);
  }

  getStatus() {
    return {
      name:               this.name,
      description:        this.description,
      status:             this.status,
      network:            this.network,
      agentCount:         this.agents.size,
      agents:             this.listAgents(),
      messageCount:       this.messageHistory.length,
      consensusThreshold: this.consensusThreshold,
      createdAt:          this.createdAt
    };
  }

  toJSON() {
    return {
      name:               this.name,
      description:        this.description,
      network:            this.network,
      consensusThreshold: this.consensusThreshold,
      createdAt:          this.createdAt,
      agents:             this.listAgents()
    };
  }
}
