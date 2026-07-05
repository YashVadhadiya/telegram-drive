/**
 * File sharing handlers.
 * Create, revoke, and access shared file links.
 *
 * @module handlers/sharing
 */

import { success, created, noContent, badRequest, unauthorized, notFound, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';
import { createTelegramBot } from '../services/telegram.js';
import { generateShareToken } from '../utils/idGenerator.js';
import { now } from '../utils/helpers.js';
import { LIMITS } from '../constants/limits.js';

/**
 * POST /api/v1/share/:fileId
 * Create a share link for a file.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Share link info
 */
export async function createShareLinkHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const fileId = request.params.fileId;

    const file = await storage.getFileById(fileId, request.user.id);
    if (!file) {
      return notFound('File not found');
    }

    if (file.is_trashed) {
      return badRequest('Cannot share a trashed file');
    }

    const body = await request.json().catch(() => ({}));
    let expiresAt = null;

    if (body.expires_in_days) {
      const days = parseInt(body.expires_in_days, 10);
      if (days < 1 || days > 30) {
        return badRequest('expires_in_days must be between 1 and 30');
      }
      expiresAt = now() + days * 86400;
    }

    const shareToken = generateShareToken();

    const existingShares = await storage.getSharesForFile(fileId, request.user.id);
    const maxShares = 50;
    if (existingShares.length >= maxShares) {
      return badRequest(`Maximum ${maxShares} share links per file`);
    }

    for (const existing of existingShares) {
      if (existing.share_token === shareToken) {
        return serverError(new Error('Token collision, please retry'));
      }
    }

    const share = await storage.createShare({
      user_id: request.user.id,
      file_id: fileId,
      share_token: shareToken,
      expires_at: expiresAt,
    });

    const url = new URL(request.url);
    const shareUrl = `${url.protocol}//${url.host}/api/v1/share/${shareToken}`;

    return created({
      id: share.id,
      shareToken: share.share_token,
      shareUrl,
      expiresAt: share.expires_at,
      createdAt: share.created_at,
      file: {
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mime_type,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/v1/share/:shareId
 * Revoke a share link.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} 204 No Content
 */
export async function deleteShareLinkHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const shareId = request.params.shareId;

    const share = await storage.db.prepare(
      'SELECT * FROM shares WHERE id = ? AND user_id = ?'
    ).bind(shareId, request.user.id).first();

    if (!share) {
      return notFound('Share link not found');
    }

    await storage.deleteShare(shareId, request.user.id);

    return noContent();
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/v1/share/:shareToken
 * Access a shared file (public, no auth required).
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} File data or redirect
 */
export async function getSharedFileHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const shareToken = request.params.shareId;

    const share = await storage.getShareByToken(shareToken);
    if (!share) {
      return notFound('Share link not found or has been revoked');
    }

    if (share.expires_at && share.expires_at < now()) {
      return badRequest('Share link has expired');
    }

    const file = await storage.db.prepare(
      'SELECT * FROM files WHERE id = ? AND is_trashed = 0'
    ).bind(share.file_id).first();

    if (!file) {
      return notFound('Shared file not found or was deleted');
    }

    await storage.incrementShareDownloads(share.id);

    const SMALL_FILE_LIMIT = 20 * 1024 * 1024;

    if (file.size <= SMALL_FILE_LIMIT && file.telegram_message_id) {
      try {
        const folder = await storage.db.prepare(
          'SELECT * FROM folders WHERE id = ?'
        ).bind(file.folder_id).first();

        if (folder && folder.telegram_group_id && file.telegram_file_id) {
          const telegram = createTelegramBot(env);
          const fileInfo = await telegram.getFile(file.telegram_file_id);
          if (fileInfo && fileInfo.file_path) {
            const downloadUrl = telegram.getFileDownloadUrl(fileInfo.file_path);
            return new Response(null, {
              status: 302,
              headers: { Location: downloadUrl },
            });
          }
        }
      } catch {
        // Fall through to returning metadata
      }
    }

    return success({
      id: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.mime_type,
      extension: file.extension,
      isChunked: !!file.is_chunked,
      chunkCount: file.chunk_count,
      width: file.width,
      height: file.height,
      duration: file.duration,
      shareToken: share.share_token,
      downloads: share.downloads + 1,
      createdAt: file.created_at,
    });
  } catch (err) {
    return serverError(err);
  }
}
