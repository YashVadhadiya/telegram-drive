/**
 * Folder CRUD handlers.
 * Each folder maps to one Telegram Group.
 *
 * @module handlers/folders
 */

import { success, created, noContent, badRequest, unauthorized, notFound, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';
import { createTelegramBot } from '../services/telegram.js';
import { now, clamp } from '../utils/helpers.js';
import { LIMITS } from '../constants/limits.js';

/**
 * GET /api/v1/folders
 * List folders with pagination, search, and sorting.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Paginated folder list
 */
export async function listFoldersHandler(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const perPage = parseInt(url.searchParams.get('per_page')) || LIMITS.ITEMS_PER_PAGE;
    const search = url.searchParams.get('search') || undefined;
    const sort = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') || 'desc';
    const parentId = url.searchParams.get('parent_id');
    const favorite = url.searchParams.get('favorite');

    const storage = createStorage(env);
    const result = await storage.getFolders(request.user.id, {
      page,
      per_page: clamp(perPage, 1, LIMITS.MAX_ITEMS_PER_PAGE),
      search,
      sort,
      order,
      parent_id: parentId === null ? null : parentId || undefined,
      is_favorite: favorite !== null ? favorite === 'true' : undefined,
    });

    return success(result.results, result.meta);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/folders
 * Create a new folder (and its backing Telegram Group).
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Created folder
 */
export async function createFolderHandler(request, env, ctx) {
  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return badRequest('Folder name is required and must be a string');
    }

    const name = body.name.trim();
    if (name.length < 1 || name.length > LIMITS.MAX_FOLDERNAME_LENGTH) {
      return badRequest(`Folder name must be between 1 and ${LIMITS.MAX_FOLDERNAME_LENGTH} characters`);
    }

    const storage = createStorage(env);
    const telegram = createTelegramBot(env);

    let group;
    try {
      group = await telegram.createGroup(name, {
        description: `Telegram Drive folder: ${name}`,
      });
    } catch (err) {
      return serverError(new Error(`Failed to create Telegram group: ${err.message}`));
    }

    let inviteLink = null;
    try {
      inviteLink = await telegram.getGroupInviteLink(group.id);
    } catch {
      // Invite link generation is best-effort
    }

    const folder = await storage.createFolder({
      user_id: request.user.id,
      name,
      telegram_group_id: group.id,
      telegram_group_title: group.title || name,
      telegram_invite_link: inviteLink,
      icon: body.icon || 'folder',
      color: body.color || '#4A90D9',
      parent_id: body.parent_id || null,
    });

    await storage.createActivity({
      user_id: request.user.id,
      type: 'folder_created',
      target_type: 'folder',
      target_id: folder.id,
      metadata: { name: folder.name },
    });

    return created(folder);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/v1/folders/:id
 * Get a single folder by ID.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Folder details
 */
export async function getFolderHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const folder = await storage.getFolderById(request.params.id, request.user.id);

    if (!folder) {
      return notFound('Folder not found');
    }

    return success(folder);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/v1/folders/:id
 * Update folder properties (name, icon, color, parent).
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Updated folder
 */
export async function updateFolderHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const telegram = createTelegramBot(env);
    const folderId = request.params.id;

    const existing = await storage.getFolderById(folderId, request.user.id);
    if (!existing) {
      return notFound('Folder not found');
    }

    const body = await request.json();

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 1 || name.length > LIMITS.MAX_FOLDERNAME_LENGTH) {
        return badRequest(`Folder name must be between 1 and ${LIMITS.MAX_FOLDERNAME_LENGTH} characters`);
      }
      body.name = name;

      if (existing.telegram_group_id) {
        try {
          await telegram.renameGroup(existing.telegram_group_id, name);
        } catch (err) {
          return serverError(new Error(`Failed to rename Telegram group: ${err.message}`));
        }
      }
    }

    const folder = await storage.updateFolder(folderId, request.user.id, {
      name: body.name,
      icon: body.icon,
      color: body.color,
      parent_id: body.parent_id,
    });

    if (!folder) {
      return notFound('Folder not found');
    }

    await storage.createActivity({
      user_id: request.user.id,
      type: 'folder_updated',
      target_type: 'folder',
      target_id: folder.id,
      metadata: { name: folder.name },
    });

    return success(folder);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/v1/folders/:id
 * Soft-delete a folder (move to trash).
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} 204 No Content
 */
export async function deleteFolderHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const folderId = request.params.id;

    const existing = await storage.getFolderById(folderId, request.user.id);
    if (!existing) {
      return notFound('Folder not found');
    }

    await storage.deleteFolder(folderId, request.user.id);

    await storage.createActivity({
      user_id: request.user.id,
      type: 'folder_trashed',
      target_type: 'folder',
      target_id: folderId,
      metadata: { name: existing.name },
    });

    return noContent();
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/v1/folders/:id/favorite
 * Toggle favorite status on a folder.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Updated folder
 */
export async function toggleFolderFavoriteHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const folderId = request.params.id;

    const existing = await storage.getFolderById(folderId, request.user.id);
    if (!existing) {
      return notFound('Folder not found');
    }

    const folder = await storage.toggleFolderFavorite(folderId, request.user.id);

    return success(folder);
  } catch (err) {
    return serverError(err);
  }
}
