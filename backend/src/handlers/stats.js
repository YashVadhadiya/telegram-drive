/**
 * Dashboard statistics handlers.
 * Provides overview stats, recent activity, and largest files.
 *
 * @module handlers/stats
 */

import { success, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';

const CACHE_TTL_MS = 30000;

async function getCachedOrFresh(key, userId, storage, fetchFn, ttlMs) {
  const cacheKey = `stats:${key}:${userId}`;
  if (storage.kv) {
    try {
      const cached = await storage.kv.get(cacheKey, { type: 'json' });
      if (cached && cached._cachedAt && (Date.now() - cached._cachedAt) < ttlMs) {
        return cached.data;
      }
    } catch {
      // Cache miss, fetch fresh
    }
  }
  const data = await fetchFn();
  if (storage.kv) {
    try {
      await storage.kv.put(cacheKey, JSON.stringify({ data, _cachedAt: Date.now() }), { expirationTtl: 60 });
    } catch {
      // Non-critical cache write
    }
  }
  return data;
}

/**
 * GET /api/v1/stats/overview
 * Get aggregate dashboard statistics.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Stats overview
 */
export async function getOverviewStatsHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const userId = request.user.id;

    const stats = await getCachedOrFresh('overview', userId, storage, async () => {
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 604800;

      const [fileStats, folderStats, sizeResult, recentUploads, largestFile, user] = await Promise.all([
        storage.db.prepare(`
          SELECT
            COUNT(*) as total_files,
            SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorite_files,
            SUM(CASE WHEN is_trashed = 1 THEN 1 ELSE 0 END) as trashed_files
          FROM files WHERE user_id = ?
        `).bind(userId).first(),

        storage.db.prepare(`
          SELECT
            COUNT(*) as total_folders,
            SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorite_folders,
            SUM(CASE WHEN is_trashed = 1 THEN 1 ELSE 0 END) as trashed_folders
          FROM folders WHERE user_id = ?
        `).bind(userId).first(),

        storage.db.prepare(`
          SELECT COALESCE(SUM(size), 0) as total_size
          FROM files WHERE user_id = ? AND is_trashed = 0
        `).bind(userId).first(),

        storage.db.prepare(`
          SELECT COUNT(*) as count FROM files
          WHERE user_id = ? AND is_trashed = 0 AND created_at >= ?
        `).bind(userId, sevenDaysAgo).first(),

        storage.db.prepare(`
          SELECT id, name, size, mime_type, created_at FROM files
          WHERE user_id = ? AND is_trashed = 0
          ORDER BY size DESC LIMIT 1
        `).bind(userId).first(),

        storage.db.prepare(
          'SELECT storage_used, chunk_size FROM users WHERE id = ?'
        ).bind(userId).first(),
      ]);

      return {
        files: {
          total: fileStats?.total_files || 0,
          favorites: fileStats?.favorite_files || 0,
          trashed: fileStats?.trashed_files || 0,
        },
        folders: {
          total: folderStats?.total_folders || 0,
          favorites: folderStats?.favorite_folders || 0,
          trashed: folderStats?.trashed_folders || 0,
        },
        storage: {
          used: sizeResult?.total_size || 0,
          limit: user?.storage_used || 0,
          chunkSize: user?.chunk_size || 52428800,
        },
        recentUploads: recentUploads?.count || 0,
        largestFile: largestFile || null,
      };
    }, CACHE_TTL_MS);

    return success(stats);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/v1/stats/recent
 * Get recent activity timeline.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Recent activities
 */
export async function getRecentStatsHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    const activities = await storage.getActivities(request.user.id, Math.min(limit, 100), offset);

    const enriched = activities.map((a) => {
      let metadata = null;
      try {
        metadata = a.metadata ? JSON.parse(a.metadata) : null;
      } catch {
        metadata = a.metadata;
      }
      return {
        ...a,
        metadata,
      };
    });

    return success(enriched);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/v1/stats/largest
 * Get the largest 20 files.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Largest files list
 */
export async function getLargestFilesHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    const files = await storage.getLargestFiles(request.user.id, Math.min(limit, 100));

    return success(files);
  } catch (err) {
    return serverError(err);
  }
}
