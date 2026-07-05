/**
 * Authentication handlers.
 * Telegram Login Widget auth, JWT token management, user profile.
 *
 * @module handlers/auth
 */

import { success, created, noContent, badRequest, unauthorized, notFound, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';
import { createTelegramBot } from '../services/telegram.js';
import { createEncryption } from '../services/encryption.js';
import { generateId, generateToken } from '../utils/idGenerator.js';
import { now } from '../utils/helpers.js';
import { ERRORS } from '../constants/errors.js';
import { LIMITS } from '../constants/limits.js';

/**
 * Generate a JWT access token (RS256 signed).
 *
 * @param {Object} payload - JWT payload
 * @param {string} payload.sub - User ID
 * @param {number} payload.telegramId - Telegram user ID
 * @param {string} [payload.username] - Username
 * @param {Object} env - Environment bindings (needs JWT_PRIVATE_KEY)
 * @param {number} expiresIn - Expiry in seconds
 * @returns {Promise<string>} Signed JWT string
 */
async function generateAccessToken(payload, env, expiresIn) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const exp = now() + expiresIn;
  const body = { ...payload, exp, iat: now() };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(body));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const key = await importSigningKey(env.JWT_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    key,
    data
  );

  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function importSigningKey(pem) {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pem.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
}

function base64UrlEncode(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashToken(token) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST /api/v1/auth/telegram
 * Authenticate via Telegram Login Widget data.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} JSON response with tokens and user
 */
export async function telegramAuthHandler(request, env, ctx) {
  try {
    const body = await request.json();

    if (!body.id || !body.hash || !body.auth_date) {
      return badRequest('Missing required fields: id, hash, auth_date');
    }

    const storage = createStorage(env);
    const telegram = createTelegramBot(env);

    let verifiedUser;
    try {
      verifiedUser = await telegram.verifyTelegramAuth(body);
    } catch (err) {
      return unauthorized(err.message || 'Telegram auth verification failed');
    }

    let user = await storage.getUserByTelegramId(verifiedUser.id);

    if (user) {
      await storage.updateLastLogin(user.id);
    } else {
      user = await storage.createUser({
        telegram_id: verifiedUser.id,
        first_name: verifiedUser.first_name || 'User',
        last_name: verifiedUser.last_name,
        username: verifiedUser.username,
        avatar_url: verifiedUser.photo_url,
      });
    }

    const accessToken = await generateAccessToken(
      { sub: user.id, telegramId: user.telegram_id, username: user.username },
      env,
      LIMITS.JWT_ACCESS_EXPIRY
    );

    const refreshToken = generateToken(48);
    const refreshTokenHash = await hashToken(refreshToken);

    await storage.createSession({
      user_id: user.id,
      token_hash: await hashToken(accessToken),
      refresh_token_hash: refreshTokenHash,
      expires_at: now() + LIMITS.JWT_REFRESH_EXPIRY,
      ip_address: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
      user_agent: request.headers.get('User-Agent'),
    });

    return created({
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        storageUsed: user.storage_used,
        theme: user.theme,
        language: user.language,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Refresh an expired access token using a refresh token.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} JSON response with new tokens
 */
export async function refreshTokenHandler(request, env, ctx) {
  try {
    const body = await request.json();

    if (!body.refreshToken) {
      return badRequest('refreshToken is required');
    }

    const storage = createStorage(env);
    const refreshTokenHash = await hashToken(body.refreshToken);
    const session = await storage.getSessionByRefreshToken(refreshTokenHash);

    if (!session) {
      return unauthorized('Invalid refresh token');
    }

    if (session.expires_at < now()) {
      await storage.deleteSession(session.id);
      return unauthorized('Refresh token has expired');
    }

    const user = await storage.getUserById(session.user_id);
    if (!user) {
      await storage.deleteSession(session.id);
      return unauthorized('User not found');
    }

    const newAccessToken = await generateAccessToken(
      { sub: user.id, telegramId: user.telegram_id, username: user.username },
      env,
      LIMITS.JWT_ACCESS_EXPIRY
    );

    const newRefreshToken = generateToken(48);
    const newRefreshTokenHash = await hashToken(newRefreshToken);

    await storage.db.prepare(
      `UPDATE sessions SET token_hash = ?, refresh_token_hash = ?, expires_at = ? WHERE id = ?`
    ).bind(
      await hashToken(newAccessToken),
      newRefreshTokenHash,
      now() + LIMITS.JWT_REFRESH_EXPIRY,
      session.id
    ).run();

    return success({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Invalidate current session.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} 204 No Content
 */
export async function logoutHandler(request, env, ctx) {
  try {
    const user = request.user;
    const storage = createStorage(env);

    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const tokenHash = await hashToken(authHeader.slice(7));
      const session = await storage.getSessionByToken(tokenHash);
      if (session) {
        await storage.deleteSession(session.id);
      }
    }

    return noContent();
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Get the authenticated user's profile.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} JSON response with user data
 */
export async function getMeHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const user = await storage.getUserById(request.user.id);

    if (!user) {
      return notFound('User not found');
    }

    return success({
      id: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      storageUsed: user.storage_used,
      theme: user.theme,
      language: user.language,
      chunkSize: user.chunk_size,
      autoRetry: !!user.auto_retry,
      notifications: !!user.notifications,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    });
  } catch (err) {
    return serverError(err);
  }
}
