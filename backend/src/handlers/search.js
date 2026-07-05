/**
 * Search handler.
 * Searches across files and folders with filters and pagination.
 *
 * @module handlers/search
 */

import { success, badRequest, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';
import { clamp } from '../utils/helpers.js';
import { LIMITS } from '../constants/limits.js';

/**
 * GET /api/v1/search
 * Search files and folders globally.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Combined paginated search results
 */
export async function searchHandler(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');

    if (!q || q.trim().length < 2) {
      return badRequest('Search query must be at least 2 characters');
    }

    const query = q.trim();
    const type = url.searchParams.get('type') || 'all';
    const folderId = url.searchParams.get('folder') || url.searchParams.get('folder_id') || undefined;
    const extension = url.searchParams.get('ext') || undefined;
    const minSize = url.searchParams.get('minSize') ? parseInt(url.searchParams.get('minSize'), 10) : undefined;
    const maxSize = url.searchParams.get('maxSize') ? parseInt(url.searchParams.get('maxSize'), 10) : undefined;
    const favorite = url.searchParams.get('favorite');
    const trashed = url.searchParams.get('trashed');
    const sort = url.searchParams.get('sort') || 'updated_at';
    const order = url.searchParams.get('order') || 'desc';
    const page = parseInt(url.searchParams.get('page')) || 1;
    const perPage = parseInt(url.searchParams.get('per_page')) || LIMITS.ITEMS_PER_PAGE;
    const limit = clamp(perPage, 1, LIMITS.MAX_ITEMS_PER_PAGE);
    const offset = (Math.max(page, 1) - 1) * limit;

    const storage = createStorage(env);
    const userId = request.user.id;
    const likePattern = `%${query}%`;

    let files = [];
    let folders = [];
    let totalFiles = 0;
    let totalFolders = 0;

    const fileConditions = ['user_id = ?', 'is_trashed = ?'];
    const fileParams = [userId, trashed === 'true' ? 1 : 0];

    fileConditions.push('(name LIKE ? OR original_name LIKE ?)');
    fileParams.push(likePattern, likePattern);

    if (folderId) {
      fileConditions.push('folder_id = ?');
      fileParams.push(folderId);
    }

    if (extension) {
      fileConditions.push('extension = ?');
      fileParams.push(extension.toLowerCase());
    }

    if (favorite === 'true') {
      fileConditions.push('is_favorite = 1');
    }

    if (minSize !== undefined) {
      fileConditions.push('size >= ?');
      fileParams.push(minSize);
    }

    if (maxSize !== undefined) {
      fileConditions.push('size <= ?');
      fileParams.push(maxSize);
    }

    const allowedSortsFile = ['name', 'size', 'created_at', 'updated_at', 'extension'];
    const fileSort = allowedSortsFile.includes(sort) ? sort : 'updated_at';
    const fileOrder = order === 'asc' ? 'ASC' : 'DESC';

    const fileWhere = fileConditions.join(' AND ');

    const fileCountResult = await storage.db.prepare(
      `SELECT COUNT(*) as count FROM files WHERE ${fileWhere}`
    ).bind(...fileParams).first();
    totalFiles = fileCountResult?.count || 0;

    if (totalFiles > 0 && (type === 'all' || type === 'file')) {
      const fileResult = await storage.db.prepare(`
        SELECT f.*, folders.name as folder_name
        FROM files f
        LEFT JOIN folders ON f.folder_id = folders.id
        WHERE ${fileWhere}
        ORDER BY ${fileSort} ${fileOrder}
        LIMIT ? OFFSET ?
      `).bind(...fileParams, limit, offset).all();
      files = (fileResult.results || []).map((f) => ({ ...f, _type: 'file' }));
    }

    if (type === 'all' || type === 'folder') {
      const folderConditions = ['user_id = ?', 'is_trashed = ?'];
      const folderParams = [userId, trashed === 'true' ? 1 : 0];

      folderConditions.push('name LIKE ?');
      folderParams.push(likePattern);

      if (favorite === 'true') {
        folderConditions.push('is_favorite = 1');
      }

      const allowedSortsFolder = ['name', 'created_at', 'updated_at', 'file_count', 'total_size'];
      const folderSort = allowedSortsFolder.includes(sort) ? sort : 'updated_at';
      const folderOrder = order === 'asc' ? 'ASC' : 'DESC';

      const folderWhere = folderConditions.join(' AND ');

      const folderCountResult = await storage.db.prepare(
        `SELECT COUNT(*) as count FROM folders WHERE ${folderWhere}`
      ).bind(...folderParams).first();
      totalFolders = folderCountResult?.count || 0;

      if (totalFolders > 0) {
        const folderResult = await storage.db.prepare(`
          SELECT * FROM folders WHERE ${folderWhere}
          ORDER BY ${folderSort} ${folderOrder}
          LIMIT ? OFFSET ?
        `).bind(...folderParams, limit, offset).all();
        folders = (folderResult.results || []).map((f) => ({ ...f, _type: 'folder' }));
      }
    }

    const combined = [...files, ...folders].sort((a, b) => {
      const aVal = a[sort] || a.updated_at || 0;
      const bVal = b[sort] || b.updated_at || 0;
      return fileOrder === 'ASC' ? aVal - bVal : bVal - aVal;
    });

    const total = type === 'folder' ? totalFolders : type === 'file' ? totalFiles : totalFiles + totalFolders;
    const totalPages = Math.ceil(total / limit) || 1;

    return success(combined.slice(0, limit), {
      total,
      page,
      perPage: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      type,
      query,
    });
  } catch (err) {
    return serverError(err);
  }
}
