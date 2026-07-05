const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level) {
  const current = (globalThis.LOG_LEVEL || globalThis.DEBUG) ? 'debug' : 'info';
  return LOG_LEVELS[level] >= LOG_LEVELS[current];
}

function log(level, msg, data = null) {
  if (!shouldLog(level)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: msg,
    ...(data ? { data } : {}),
  };
  const output = JSON.stringify(entry);
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  info(msg, data) {
    log('info', msg, data);
  },
  warn(msg, data) {
    log('warn', msg, data);
  },
  error(msg, data) {
    log('error', msg, data);
  },
  debug(msg, data) {
    log('debug', msg, data);
  },
  request(req, status, duration) {
    log('info', `${req.method} ${req.url} -> ${status} (${duration}ms)`, {
      method: req.method,
      url: req.url,
      status,
      duration,
    });
  },
};
