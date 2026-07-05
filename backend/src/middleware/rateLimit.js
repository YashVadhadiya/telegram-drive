import { tooManyRequests } from '../utils/response.js';
import { LIMITS } from '../constants/limits.js';

const RATE_LIMITS = {
  auth: { limit: LIMITS.RATE_LIMIT_AUTH, window: LIMITS.RATE_LIMIT_WINDOW_MS },
  upload: { limit: LIMITS.RATE_LIMIT_UPLOAD, window: LIMITS.RATE_LIMIT_WINDOW_MS },
  download: { limit: LIMITS.RATE_LIMIT_DOWNLOAD, window: LIMITS.RATE_LIMIT_WINDOW_MS },
  search: { limit: LIMITS.RATE_LIMIT_SEARCH, window: LIMITS.RATE_LIMIT_WINDOW_MS },
  default: { limit: LIMITS.RATE_LIMIT_GLOBAL, window: LIMITS.RATE_LIMIT_WINDOW_MS },
};

function getEndpointGroup(path) {
  if (path.startsWith('/api/v1/auth/')) return 'auth';
  if (path.startsWith('/api/v1/upload/')) return 'upload';
  if (path.includes('/download') || path.includes('/stream')) return 'download';
  if (path.startsWith('/api/v1/search')) return 'search';
  return 'default';
}

export async function rateLimitMiddleware(request, env) {
  const identifier = request.user?.id || request.headers.get('CF-Connecting-IP') || 'anonymous';
  const path = new URL(request.url).pathname;
  const group = getEndpointGroup(path);
  const config = RATE_LIMITS[group];

  if (!env.RATE_LIMIT_KV) return;

  const now = Date.now();
  const windowStart = Math.floor(now / config.window) * config.window;
  const key = `ratelimit:${identifier}:${group}:${windowStart}`;

  try {
    const current = parseInt(await env.RATE_LIMIT_KV.get(key) || '0', 10);
    const count = current + 1;

    if (count > config.limit) {
      const retryAfter = Math.ceil((windowStart + config.window - now) / 1000);
      return tooManyRequests(`Rate limit exceeded. Try again in ${retryAfter}s.`);
    }

    await env.RATE_LIMIT_KV.put(key, String(count), {
      expirationTtl: Math.ceil(config.window / 1000),
    });
  } catch (err) {
    console.error('Rate limit error:', err);
  }
}
