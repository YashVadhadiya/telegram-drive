/**
 * File CRUD handlers.
 * File listing, rename, delete, copy, move, and favorite toggle.
 *
 * @module handlers/files
 */

import { success, noContent, badRequest, unauthorized, notFound, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';
import { now, clamp, getFileExtension } from '../utils/helpers.js';
import { LIMITS } from '../constants/limits.js';
import { ERRORS } from '../constants/errors.js';

/**
 * GET /api/v1/folders/:folderId/files
 * List files in a folder with pagination, search, and filtering.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Paginated file list
 */
export async function listFilesHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const folderId = request.params.folderId;

    const folder = await storage.getFolderById(folderId, request.user.id);
    if (!folder) {
      return notFound('Folder not found');
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const perPage = parseInt(url.searchParams.get('per_page')) || LIMITS.ITEMS_PER_PAGE;
    const search = url.searchParams.get('search') || undefined;
    const sort = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') || 'desc';
    const extension = url.searchParams.get('ext') || undefined;
    const favorite = url.searchParams.get('favorite');

    let typeFilter = url.searchParams.get('type') || undefined;
    if (typeFilter) {
      const { FILE_CATEGORIES } = await import('../constants/mimeTypes.js');
      const types = FILE_CATEGORIES[typeFilter];
      if (types && types.length > 0) {
        typeFilter = types;
      } else {
        typeFilter = undefined;
      }
    }

    const result = await storage.getFiles(folderId, request.user.id, {
      page,
      per_page: clamp(perPage, 1, LIMITS.MAX_ITEMS_PER_PAGE),
      search,
      sort,
      order,
      extension,
      is_favorite: favorite !== null ? favorite === 'true' : undefined,
    });

    return success(result.results, result.meta);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/v1/files/:id
 * Get a single file by ID.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} File details
 */
export async function getFileHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const file = await storage.getFileById(request.params.id, request.user.id);

    if (!file) {
      return notFound('File not found');
    }

    return success(file);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/v1/files/:id
 * Rename a file.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Updated file
 */
export async function updateFileHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const fileId = request.params.id;

    const existing = await storage.getFileById(fileId, request.user.id);
    if (!existing) {
      return notFound('File not found');
    }

    const body = await request.json();

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 1 || name.length > LIMITS.MAX_FILENAME_LENGTH) {
        return badRequest(`File name must be between 1 and ${LIMITS.MAX_FILENAME_LENGTH} characters`);
      }
      body.name = name;
    }

    const file = await storage.updateFile(fileId, request.user.id, {
      name: body.name,
      folder_id: body.folder_id,
    });

    await storage.createActivity({
      user_id: request.user.id,
      type: 'file_renamed',
      target_type: 'file',
      target_id: fileId,
      metadata: { oldName: existing.name, newName: file.name },
    });

    return success(file);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/v1/files/:id
 * Soft-delete a file (move to trash).
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} 204 No Content
 */
export async function deleteFileHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const fileId = request.params.id;

    const existing = await storage.getFileById(fileId, request.user.id);
    if (!existing) {
      return notFound('File not found');
    }

    await storage.deleteFile(fileId, request.user.id);

    await storage.createActivity({
      user_id: request.user.id,
      type: 'file_trashed',
      target_type: 'file',
      target_id: fileId,
      metadata: { name: existing.name, size: existing.size },
    });

    return noContent();
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/v1/files/:id/favorite
 * Toggle favorite status on a file.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Updated file
 */
export async function toggleFileFavoriteHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const fileId = request.params.id;

    const existing = await storage.getFileById(fileId, request.user.id);
    if (!existing) {
      return notFound('File not found');
    }

    const file = await storage.toggleFileFavorite(fileId, request.user.id);

    return success(file);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/files/:id/copy
 * Copy a file to a target folder.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Newly created file copy
 */
export async function copyFileHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const fileId = request.params.id;
    const body = await request.json();
    const targetFolderId = body.folder_id;

    if (!targetFolderId) {
      return badRequest('folder_id is required');
    }

    const source = await storage.getFileById(fileId, request.user.id);
    if (!source) {
      return notFound('Source file not found');
    }

    const targetFolder = await storage.getFolderById(targetFolderId, request.user.id);
    if (!targetFolder) {
      return badRequest('Target folder not found');
    }

    const newFile = await storage.copyFile(fileId, request.user.id, targetFolderId);

    await storage.createActivity({
      user_id: request.user.id,
      type: 'file_copied',
      target_type: 'file',
      target_id: newFile.id,
      metadata: { sourceFileId: fileId, sourceName: source.name, targetFolderId },
    });

    return success(newFile);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/files/:id/move
 * Move a file to a different folder.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Moved file
 */
export async function moveFileHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const fileId = request.params.id;
    const body = await request.json();
    const targetFolderId = body.folder_id;

    if (!targetFolderId) {
      return badRequest('folder_id is required');
    }

    const existing = await storage.getFileById(fileId, request.user.id);
    if (!existing) {
      return notFound('File not found');
    }

    const targetFolder = await storage.getFolderById(targetFolderId, request.user.id);
    if (!targetFolder) {
      return badRequest('Target folder not found');
    }

    if (existing.folder_id === targetFolderId) {
      return success(existing);
    }

    const file = await storage.moveFile(fileId, request.user.id, targetFolderId);

    await storage.createActivity({
      user_id: request.user.id,
      type: 'file_moved',
      target_type: 'file',
      target_id: fileId,
      metadata: { name: file.name, fromFolderId: existing.folder_id, toFolderId: targetFolderId },
    });

    return success(file);
  } catch (err) {
    return serverError(err);
  }
}
