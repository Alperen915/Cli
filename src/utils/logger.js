/**
 * Structured Logger
 * Consistent, leveled logging across the platform.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const ENV_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const MIN_LEVEL = LEVELS[ENV_LEVEL] ?? LEVELS.info;
const IS_PROD   = process.env.NODE_ENV === 'production';

function ts() { return new Date().toISOString(); }

function fmt(level, namespace, message, meta) {
  const prefix = `[${ts()}] [${level.toUpperCase()}] [${namespace}]`;
  if (IS_PROD) {
    const entry = { ts: ts(), level, ns: namespace, msg: message };
    if (meta && Object.keys(meta).length) entry.meta = meta;
    return JSON.stringify(entry);
  }
  const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

function log(level, namespace, message, meta = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const line = fmt(level, namespace, message, meta);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(namespace) {
  return {
    debug: (msg, meta) => log('debug', namespace, msg, meta),
    info:  (msg, meta) => log('info',  namespace, msg, meta),
    warn:  (msg, meta) => log('warn',  namespace, msg, meta),
    error: (msg, meta) => {
      if (meta instanceof Error) {
        log('error', namespace, msg, { error: meta.message, stack: IS_PROD ? undefined : meta.stack });
      } else {
        log('error', namespace, msg, meta);
      }
    }
  };
}

export const logger = createLogger('platform');
