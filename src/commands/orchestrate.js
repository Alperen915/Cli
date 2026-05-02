import chalk   from 'chalk';
import inquirer from 'inquirer';
import { orchestrationService } from '../services/orchestrationService.js';
import { display }              from '../utils/display.js';
import { VALID_ROLES }          from '../agents/orchestrator.js';

// ── arb fleet create ──────────────────────────────────────────────────────────

export async function fleetCreateCommand(opts) {
  let name        = opts.name;
  let description = opts.description || '';
  let network     = opts.network     || 'sepolia';
  let threshold   = parseFloat(opts.threshold || '0.6');

  if (!name) {
    const ans = await inquirer.prompt([
      { type: 'input',  name: 'name',        message: 'Fleet name (e.g. alpha-fleet):',
        validate: v => /^[a-z0-9_-]+$/i.test(v) ? true : 'Letters, numbers, - and _ only' },
      { type: 'input',  name: 'description', message: 'Description (optional):', default: '' },
      { type: 'list',   name: 'network',     message: 'Network:', choices: ['sepolia', 'mainnet', 'nova'] },
      { type: 'number', name: 'threshold',   message: 'Consensus threshold (0.0–1.0):', default: 0.6 }
    ]);
    name = ans.name; description = ans.description;
    network = ans.network; threshold = ans.threshold;
  }

  const status = orchestrationService.createFleet({ name, description, network, consensusThreshold: threshold });

  display.success(`Fleet "${name}" created`);
  console.log(chalk.gray(`  Network:   ${status.network}`));
  console.log(chalk.gray(`  Consensus: ${(threshold * 100).toFixed(0)}% approval required`));
  console.log('');
  display.info(`Add agents with: arb fleet add --fleet ${name}`);
}

// ── arb fleet list ────────────────────────────────────────────────────────────

export async function fleetListCommand() {
  const fleets = orchestrationService.listFleets();

  if (fleets.length === 0) {
    display.info('No fleets yet. Create one with: arb fleet create');
    return;
  }

  console.log(chalk.bold(`\n  Agent Fleets (${fleets.length} total)\n`));
  for (const f of fleets) {
    console.log(`  ${chalk.cyan('●')} ${chalk.white(f.name)}  ${chalk.gray('(' + f.network + ')')}  agents: ${chalk.yellow(f.agentCount)}`);
    if (f.description) console.log(`       ${chalk.gray(f.description)}`);
    console.log(`       created: ${chalk.gray(f.createdAt.slice(0,10))}`);
    console.log('');
  }
}

// ── arb fleet status ──────────────────────────────────────────────────────────

export async function fleetStatusCommand(opts) {
  const name   = await resolveFleet(opts);
  const status = orchestrationService.getFleet(name);

  console.log(chalk.bold(`\n  Fleet: ${status.name}  ${chalk.gray('(' + status.network + ')')}`));
  if (status.description) console.log(`  ${chalk.gray(status.description)}`);
  console.log(`  Status:     ${status.status === 'idle' ? chalk.green('idle') : chalk.yellow(status.status)}`);
  console.log(`  Agents:     ${chalk.yellow(status.agentCount)}`);
  console.log(`  Consensus:  ${chalk.cyan((status.consensusThreshold * 100).toFixed(0) + '%')} approval needed`);
  console.log(`  Messages:   ${chalk.gray(status.messageCount)}`);
  console.log('');

  if (status.agents.length > 0) {
    console.log(chalk.bold('  Agents:'));
    for (const a of status.agents) {
      const roleColor = { master: 'magenta', analyst: 'cyan', executor: 'green', risk_manager: 'red', monitor: 'yellow' };
      const col = roleColor[a.role] || 'white';
      console.log(`    ${chalk[col](a.role.padEnd(14))} ${chalk.white(a.name)}`);
    }
    console.log('');
  } else {
    display.info('No agents yet. Add with: arb fleet add');
  }
}

// ── arb fleet add ─────────────────────────────────────────────────────────────

export async function fleetAddCommand(opts) {
  const fleetName = await resolveFleet(opts);

  let role      = opts.role;
  let agentName = opts.agent;
  let agentType = opts.type || 'trading';

  if (!role || !agentName) {
    const ans = await inquirer.prompt([
      { type: 'list',  name: 'role',  message: 'Agent role in fleet:',
        choices: VALID_ROLES.map(r => ({
          name: {
            master:       'master       — coordinates all sub-agents',
            analyst:      'analyst      — AI market analysis & signals',
            executor:     'executor     — evaluates and executes trades',
            risk_manager: 'risk_manager — validates risk policy',
            monitor:      'monitor      — event & alert monitoring'
          }[r] || r,
          value: r
        }))
      },
      { type: 'input', name: 'agentName', message: 'Agent name (new or existing):',
        validate: v => /^[a-z0-9_-]+$/i.test(v) ? true : 'Letters, numbers, - and _ only' },
      { type: 'list',  name: 'agentType', message: 'Agent type:',
        choices: ['trading', 'defi', 'onchain', 'nft', 'social', 'custom'] }
    ]);
    role = ans.role; agentName = ans.agentName; agentType = ans.agentType;
  }

  const result = orchestrationService.addAgent(fleetName, { role, agentName, agentType });

  display.success(`Agent "${agentName}" added to fleet "${fleetName}" as ${role}`);
  console.log(chalk.gray(`  Role: ${role}`));
  console.log(chalk.gray(`  Type: ${agentType}`));
}

// ── arb fleet remove ──────────────────────────────────────────────────────────

export async function fleetRemoveAgentCommand(role, opts) {
  const fleetName = await resolveFleet(opts);
  const { removed } = orchestrationService.removeAgent(fleetName, role);
  if (removed) display.success(`Agent with role "${role}" removed from fleet "${fleetName}"`);
  else         display.error(`No agent with role "${role}" in fleet "${fleetName}"`);
}

// ── arb fleet ask ─────────────────────────────────────────────────────────────

export async function fleetAskCommand(message, opts) {
  const fleetName = await resolveFleet(opts);
  const role      = opts.role || null;

  if (!message) {
    const ans = await inquirer.prompt([{
      type: 'input', name: 'message', message: 'Message / goal for the fleet:'
    }]);
    message = ans.message;
  }

  if (role) {
    display.info(`Asking ${role} agent in fleet "${fleetName}"…`);
    console.log('');
    const result = await orchestrationService.askAgent(fleetName, role, message);
    _printResponse(role, result.agentName, result.response);
  } else {
    display.info(`Coordinating fleet "${fleetName}" with goal: "${message.slice(0,60)}…"`);
    console.log('');
    const result = await orchestrationService.coordinate(fleetName, message);
    _printCoordinationResult(result);
  }
}

// ── arb fleet vote ────────────────────────────────────────────────────────────

export async function fleetVoteCommand(opts) {
  const fleetName = await resolveFleet(opts);

  const { proposal } = await inquirer.prompt([{
    type: 'input', name: 'proposal',
    message: 'Proposal to vote on (JSON or plain text):',
    validate: v => v.length > 2 ? true : 'Enter a proposal'
  }]);

  display.info('Collecting votes from fleet agents…');
  console.log('');

  const result = await orchestrationService.vote(fleetName, proposal);

  console.log(chalk.bold('  Vote Results:'));
  for (const v of result.votes) {
    const col = v.vote === 'yes' ? 'green' : 'red';
    console.log(`    ${chalk.cyan(v.role.padEnd(14))} ${chalk[col](v.vote.toUpperCase())}  ${chalk.gray(v.reason.slice(0,70))}`);
  }
  console.log('');
  console.log(`  Result: ${result.approved ? chalk.green('✓ APPROVED') : chalk.red('✗ REJECTED')}  (${result.yesVotes}/${result.totalVotes} yes, need ${(result.threshold*100).toFixed(0)}%)`);
  console.log('');
}

// ── arb fleet history ─────────────────────────────────────────────────────────

export async function fleetHistoryCommand(opts) {
  const fleetName = await resolveFleet(opts);
  const limit     = parseInt(opts.limit || '20');
  const messages  = orchestrationService.getHistory(fleetName, limit);

  if (messages.length === 0) {
    display.info(`No messages in fleet "${fleetName}" yet.`);
    return;
  }

  console.log(chalk.bold(`\n  Fleet Message History — ${fleetName} (${messages.length} msgs)\n`));

  for (const m of messages) {
    const ts   = m.timestamp.slice(11, 19);
    const from = chalk.cyan(m.from.padEnd(14));
    const to   = chalk.gray('→ ' + m.to.padEnd(14));
    const type = chalk.yellow(`[${m.type}]`);
    const preview = typeof m.content === 'string'
      ? m.content.slice(0, 80)
      : JSON.stringify(m.content).slice(0, 80);
    console.log(`  ${chalk.gray(ts)}  ${from} ${to} ${type}`);
    console.log(`           ${chalk.gray(preview)}`);
    console.log('');
  }
}

// ── arb fleet delete ──────────────────────────────────────────────────────────

export async function fleetDeleteCommand(opts) {
  const fleetName = await resolveFleet(opts);

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: `Delete fleet "${fleetName}"? This cannot be undone.`,
    default: false
  }]);

  if (!confirm) { display.info('Cancelled.'); return; }

  orchestrationService.deleteFleet(fleetName);
  display.success(`Fleet "${fleetName}" deleted`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveFleet(opts) {
  if (opts?.fleet) return opts.fleet;
  const fleets = orchestrationService.listFleets();
  if (fleets.length === 0) throw new Error('No fleets. Create one with: arb fleet create');
  if (fleets.length === 1) return fleets[0].name;

  const { fleet } = await inquirer.prompt([{
    type: 'list', name: 'fleet',
    message: 'Select fleet:',
    choices: fleets.map(f => ({ name: `${f.name}  (${f.agentCount} agents, ${f.network})`, value: f.name }))
  }]);
  return fleet;
}

function _printResponse(role, agentName, response) {
  console.log(chalk.bold(`  [${role}] ${agentName}:`));

  const tryParse = (r) => {
    if (typeof r !== 'string') return r;
    const m = r.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch(e) { return null; }
  };

  const parsed = tryParse(response);
  if (parsed) {
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'string') {
        console.log(`  ${chalk.cyan(key.padEnd(14))} ${val.slice(0,120)}`);
      } else if (Array.isArray(val)) {
        console.log(`  ${chalk.cyan(key.padEnd(14))} [${val.slice(0,3).map(v => JSON.stringify(v).slice(0,40)).join(', ')}]`);
      } else {
        console.log(`  ${chalk.cyan(key.padEnd(14))} ${JSON.stringify(val).slice(0,80)}`);
      }
    }
  } else {
    const txt = typeof response === 'string' ? response : JSON.stringify(response);
    console.log(`  ${chalk.gray(txt.slice(0, 300))}`);
  }
  console.log('');
}

function _printCoordinationResult(result) {
  console.log(chalk.bold('  ── Master Plan ──'));
  const plan = result.masterPlan;
  if (plan?.thought) console.log(`  ${chalk.cyan('thought')}       ${String(plan.thought).slice(0,100)}`);
  if (plan?.decision) console.log(`  ${chalk.cyan('decision')}      ${String(plan.decision).slice(0,100)}`);

  if (result.subResponses.length > 0) {
    console.log('');
    console.log(chalk.bold('  ── Sub-Agent Responses ──'));
    for (const r of result.subResponses) {
      _printResponse(r.role, r.agentName, r.response);
    }
  }

  if (result.decision) {
    console.log(chalk.bold('  ── Final Decision ──'));
    _printResponse('master', 'final', result.decision);
  }

  if (result.consensus) {
    const approved = result.consensus.approved;
    console.log(`  Consensus: ${approved ? chalk.green('✓ APPROVED') : chalk.red('✗ REJECTED')}`);
    console.log('');
  }

  if (result.error) {
    display.error(`Coordination error: ${result.error}`);
  }
}
