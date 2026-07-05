/**
 * User settings handlers.
 * Get and update user preferences.
 *
 * @module handlers/settings
 */

import { success, badRequest, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';

const VALID_THEMES = ['dark', 'light', 'system'];
const VALID_LANGUAGES = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'pt', 'it', 'tr', 'ar', 'zh', 'ja'];
const VALID_CHUNK_SIZES = [26214400, 52428800, 104857600];

/**
 * GET /api/v1/settings
 * Get user settings.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} User settings
 */
export async function getSettingsHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const user = await storage.getUserById(request.user.id);

    if (!user) {
      return badRequest('User not found');
    }

    let mtprotoConnected = false;
    try {
      const tgSession = await storage.getTelegramSession(request.user.id);
      mtprotoConnected = !!tgSession;
    } catch {
      mtprotoConnected = false;
    }

    return success({
      theme: user.theme || 'dark',
      language: user.language || 'en',
      chunkSize: user.chunk_size || 52428800,
      autoRetry: !!user.auto_retry,
      notifications: !!user.notifications,
      mtprotoConnected,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/v1/settings
 * Update user settings.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Updated settings
 */
export async function updateSettingsHandler(request, env, ctx) {
  try {
    const body = await request.json();
    const storage = createStorage(env);

    const updates = {};

    if (body.theme !== undefined) {
      if (!VALID_THEMES.includes(body.theme)) {
        return badRequest(`Theme must be one of: ${VALID_THEMES.join(', ')}`);
      }
      updates.theme = body.theme;
    }

    if (body.language !== undefined) {
      if (!VALID_LANGUAGES.includes(body.language)) {
        return badRequest(`Language must be one of: ${VALID_LANGUAGES.join(', ')}`);
      }
      updates.language = body.language;
    }

    if (body.chunkSize !== undefined) {
      const size = parseInt(body.chunkSize, 10);
      if (!VALID_CHUNK_SIZES.includes(size)) {
        return badRequest(`Chunk size must be one of: ${VALID_CHUNK_SIZES.join(', ')}`);
      }
      updates.chunk_size = size;
    }

    if (body.autoRetry !== undefined) {
      updates.auto_retry = body.autoRetry ? 1 : 0;
    }

    if (body.notifications !== undefined) {
      updates.notifications = body.notifications ? 1 : 0;
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('No valid settings fields provided');
    }

    const user = await storage.updateUser(request.user.id, updates);
    if (!user) {
      return badRequest('User not found');
    }

    return success({
      theme: user.theme,
      language: user.language,
      chunkSize: user.chunk_size,
      autoRetry: !!user.auto_retry,
      notifications: !!user.notifications,
    });
  } catch (err) {
    return serverError(err);
  }
}
