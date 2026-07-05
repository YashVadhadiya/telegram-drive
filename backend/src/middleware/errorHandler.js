import { logger } from '../utils/logger.js';
import { json } from '../utils/response.js';

export function errorHandler(err, request) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal server error';

  logger.error(`[${status}] ${code}: ${message}`, {
    method: request?.method,
    url: request?.url,
    stack: status === 500 ? err.stack : undefined,
  });

  const isProduction = typeof globalThis !== 'undefined' && globalThis.PRODUCTION === true;
  const body = {
    success: false,
    data: null,
    meta: null,
    error: {
      code,
      message,
      ...(status === 500 && !isProduction ? { stack: err.stack } : {}),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
