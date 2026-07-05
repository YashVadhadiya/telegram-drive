/**
 * Favorites listing handler.
 * Returns all favorited files and folders combined.
 *
 * @module handlers/favorites
 */

import { success, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';

/**
 * GET /api/v1/favorites
 * List all favorite files and folders.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Combined favorites list
 */
export async function listFavoritesHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const userId = request.user.id;

    const [favoriteFiles, favoriteFolders] = await Promise.all([
      storage.getFavoriteFiles(userId),
      storage.getFavoriteFolders(userId),
    ]);

    const combined = [
      ...favoriteFiles.map((f) => ({
        id: f.id,
        name: f.name,
        type: 'file',
        mimeType: f.mime_type,
        size: f.size,
        extension: f.extension,
        folderId: f.folder_id,
        folderName: f.folder_name,
        updatedAt: f.updated_at,
        createdAt: f.created_at,
      })),
      ...favoriteFolders.map((f) => ({
        id: f.id,
        name: f.name,
        type: 'folder',
        icon: f.icon,
        color: f.color,
        fileCount: f.file_count,
        totalSize: f.total_size,
        updatedAt: f.updated_at,
        createdAt: f.created_at,
      })),
    ];

    combined.sort((a, b) => {
      const aTime = a.updatedAt || 0;
      const bTime = b.updatedAt || 0;
      return bTime - aTime;
    });

    return success(combined);
  } catch (err) {
    return serverError(err);
  }
}
