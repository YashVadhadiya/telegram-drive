/**
 * Trash / recycle bin handlers.
 * List, empty, and restore trashed items.
 *
 * @module handlers/trash
 */

import { success, noContent, badRequest, unauthorized, notFound, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';
import { createTelegramBot } from '../services/telegram.js';
import { clamp } from '../utils/helpers.js';
import { LIMITS } from '../constants/limits.js';

/**
 * GET /api/v1/trash
 * List all trashed files and folders.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Paginated trash list
 */
export async function listTrashHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const userId = request.user.id;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const perPage = parseInt(url.searchParams.get('per_page')) || LIMITS.ITEMS_PER_PAGE;
    const limit = clamp(perPage, 1, LIMITS.MAX_ITEMS_PER_PAGE);
    const offset = (Math.max(page, 1) - 1) * limit;

    const [trashedFiles, trashedFolders] = await Promise.all([
      storage.getTrashedFiles(userId),
      storage.getTrashedFolders(userId),
    ]);

    const combined = [
      ...trashedFiles.map((f) => ({
        ...f,
        _type: 'file',
        folder_name: f.folder_name || null,
      })),
      ...trashedFolders.map((f) => ({
        ...f,
        _type: 'folder',
      })),
    ];

    combined.sort((a, b) => {
      const aTime = a.trashed_at || 0;
      const bTime = b.trashed_at || 0;
      return bTime - aTime;
    });

    const total = combined.length;
    const paginated = combined.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return success(paginated, {
      total,
      page,
      perPage: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/v1/trash/empty
 * Permanently delete all trashed items.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} 204 No Content
 */
export async function emptyTrashHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const telegram = createTelegramBot(env);
    const userId = request.user.id;

    const trashedFiles = await storage.getTrashedFiles(userId);
    const trashedFolders = await storage.getTrashedFolders(userId);

    for (const file of trashedFiles) {
      if (file.telegram_message_id) {
        try {
          const folder = trashedFolders.find((f) => f.id === file.folder_id);
          if (folder && folder.telegram_group_id) {
            await telegram.deleteMessage(folder.telegram_group_id, file.telegram_message_id);
          }
        } catch {
          // Best-effort cleanup
        }
      }

      if (file.size) {
        await storage.removeStorageUsed(userId, file.size);
      }
    }

    const result = await storage.emptyTrash(userId);

    await storage.createActivity({
      user_id: userId,
      type: 'trash_emptied',
      metadata: { foldersDeleted: result.folders, filesDeleted: result.files },
    });

    return success({
      foldersDeleted: result.folders,
      filesDeleted: result.files,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/trash/restore/:id
 * Restore a trashed item (file or folder) by ID.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Restored item
 */
export async function restoreFromTrashHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const userId = request.user.id;
    const itemId = request.params.id;

    let file = await storage.db.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ? AND is_trashed = 1'
    ).bind(itemId, userId).first();

    if (file) {
      await storage.restoreFile(itemId, userId);

      await storage.createActivity({
        user_id: userId,
        type: 'file_restored',
        target_type: 'file',
        target_id: itemId,
        metadata: { name: file.name },
      });

      const restored = await storage.getFileById(itemId, userId);
      return success({ ...restored, _type: 'file' });
    }

    let folder = await storage.db.prepare(
      'SELECT * FROM folders WHERE id = ? AND user_id = ? AND is_trashed = 1'
    ).bind(itemId, userId).first();

    if (folder) {
      await storage.restoreFolder(itemId, userId);

      await storage.db.prepare(
        `UPDATE files SET is_trashed = 0, trashed_at = NULL, updated_at = ?
         WHERE folder_id = ? AND user_id = ? AND is_trashed = 1`
      ).bind(Math.floor(Date.now() / 1000), itemId, userId).run();

      await storage.createActivity({
        user_id: userId,
        type: 'folder_restored',
        target_type: 'folder',
        target_id: itemId,
        metadata: { name: folder.name },
      });

      const restored = await storage.getFolderById(itemId, userId);
      return success({ ...restored, _type: 'folder' });
    }

    return notFound('Trashed item not found');
  } catch (err) {
    return serverError(err);
  }
}
