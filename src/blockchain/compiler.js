/**
 * Solidity Compiler Wrapper
 * Compiles AgentToken.sol using the solc npm package.
 * Caches compiled output to avoid recompiling on every deployment.
 */
import { createRequire } from 'module';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const log      = createLogger('compiler');
const require  = createRequire(import.meta.url);
const __dir    = dirname(fileURLToPath(import.meta.url));
const SOL_PATH = join(__dir, '../contracts/AgentToken.sol');
const CACHE    = join(__dir, '../contracts/AgentToken.cache.json');

let _cached = null;

export async function compileAgentToken() {
  // Return in-memory cache first
  if (_cached) return _cached;

  // Return disk cache if exists
  if (existsSync(CACHE)) {
    try {
      _cached = JSON.parse(readFileSync(CACHE, 'utf-8'));
      log.info('Loaded AgentToken from disk cache');
      return _cached;
    } catch {}
  }

  log.info('Compiling AgentToken.sol...');
  const solc   = require('solc');
  const source = readFileSync(SOL_PATH, 'utf-8');

  const input = JSON.stringify({
    language: 'Solidity',
    sources: { 'AgentToken.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
    }
  });

  const output = JSON.parse(solc.compile(input));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`Solidity compilation failed:\n${errors.map(e => e.message).join('\n')}`);
    }
    output.errors.forEach(w => log.warn(`Compiler warning: ${w.message}`));
  }

  const contract = output.contracts?.['AgentToken.sol']?.AgentToken;
  if (!contract) throw new Error('AgentToken contract not found in compiler output');

  _cached = {
    abi:      contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
    compiledAt: new Date().toISOString()
  };

  // Cache to disk
  try {
    writeFileSync(CACHE, JSON.stringify(_cached, null, 2));
    log.info('AgentToken compiled and cached');
  } catch (err) {
    log.warn('Failed to write compiler cache', { error: err.message });
  }

  return _cached;
}

export function clearCompilerCache() {
  _cached = null;
  try { require('fs').unlinkSync(CACHE); } catch {}
}
