/**
 * Upload handlers with chunked upload support.
 * Handles init, chunk upload, complete, status, and cancel flows.
 *
 * @module handlers/upload
 */

import { success, created, noContent, badRequest, unauthorized, notFound, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';
import { createTelegramBot } from '../services/telegram.js';
import { createChunkService } from '../services/chunk.js';
import { createUploadQueue } from '../services/queue.js';
import { generateId, generateToken } from '../utils/idGenerator.js';
import { now, isAllowedFileSize, isAllowedFileType, getFileExtension, getMimeType } from '../utils/helpers.js';
import { ERRORS } from '../constants/errors.js';
import { LIMITS } from '../constants/limits.js';

/**
 * POST /api/v1/upload/init
 * Initialize a new upload session.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Upload session info
 */
export async function initUploadHandler(request, env, ctx) {
  try {
    const body = await request.json();

    if (!body.folder_id || !body.file_name || !body.file_size || !body.mime_type) {
      return badRequest('folder_id, file_name, file_size, and mime_type are required');
    }

    const fileSize = parseInt(body.file_size, 10);
    if (!isAllowedFileSize(fileSize)) {
      return badRequest(`File size must be between 1 byte and ${LIMITS.MAX_FILE_SIZE} bytes (2GB)`);
    }

    if (!isAllowedFileType(body.mime_type)) {
      return badRequest(`File type '${body.mime_type}' is not allowed`);
    }

    const storage = createStorage(env);
    const queue = createUploadQueue(env, storage);

    const folder = await storage.getFolderById(body.folder_id, request.user.id);
    if (!folder) {
      return badRequest('Target folder not found');
    }

    const chunkSize = body.total_chunks > 1
      ? Math.ceil(fileSize / body.total_chunks)
      : Math.min(fileSize, LIMITS.CHUNK_SIZE);

    let upload;
    try {
      upload = await queue.createUpload(
        request.user.id,
        body.folder_id,
        body.file_name,
        fileSize,
        body.mime_type,
        { chunkSize }
      );
    } catch (err) {
      if (err.code === 'MAX_CONCURRENT') {
        return badRequest(err.message);
      }
      throw err;
    }

    const totalChunks = upload.total_chunks;

    return created({
      uploadId: upload.id,
      fileName: upload.file_name,
      fileSize: upload.file_size,
      mimeType: upload.mime_type,
      chunkSize: upload.chunk_size,
      totalChunks,
      folderId: upload.folder_id,
      status: upload.status,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/upload/:uploadId/chunk
 * Upload a single chunk of a file.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Updated progress
 */
export async function uploadChunkHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const telegram = createTelegramBot(env);
    const queue = createUploadQueue(env, storage);
    const uploadId = request.params.uploadId;

    const upload = await storage.getUpload(uploadId, request.user.id);
    if (!upload) {
      return notFound('Upload session not found');
    }

    if (upload.status === 'completed') {
      return badRequest('Upload is already completed');
    }

    if (upload.status === 'cancelled') {
      return badRequest('Upload was cancelled');
    }

    const chunkIndex = parseInt(request.headers.get('X-Chunk-Index') || '0', 10);
    if (chunkIndex !== upload.uploaded_chunks) {
      return badRequest(
        `Expected chunk index ${upload.uploaded_chunks}, got ${chunkIndex}`
      );
    }

    const chunkData = await request.arrayBuffer();
    if (!chunkData || chunkData.byteLength === 0) {
      return badRequest('Chunk data is empty');
    }

    const folder = await storage.getFolderById(upload.folder_id, request.user.id);
    if (!folder || !folder.telegram_group_id) {
      return badRequest('Folder has no associated Telegram group');
    }

    const fileName = `${upload.file_name}.part${chunkIndex + 1}`;
    let telegramResult;

    try {
      telegramResult = await telegram.sendDocument(
        folder.telegram_group_id,
        chunkData,
        fileName,
        upload.mime_type,
        { disableNotification: true }
      );
    } catch (err) {
      await storage.updateUpload(uploadId, {
        status: 'failed',
        error_message: err.message,
      });
      return serverError(new Error(`Telegram upload failed: ${err.message}`));
    }

    const chunkRefs = upload.chunk_message_ids
      ? JSON.parse(upload.chunk_message_ids)
      : [];
    chunkRefs.push({
      index: chunkIndex,
      messageId: telegramResult.message_id,
      fileId: telegramResult.document?.file_id || null,
    });

    await storage.updateUpload(uploadId, {
      chunk_message_ids: JSON.stringify(chunkRefs),
    });

    const updated = await queue.markChunkComplete(uploadId, request.user.id, chunkData.byteLength);

    return success({
      uploadId: upload.id,
      chunkIndex: chunkIndex + 1,
      uploadedChunks: updated.uploaded_chunks,
      totalChunks: updated.total_chunks,
      bytesUploaded: updated.bytes_uploaded,
      status: updated.status,
      progress: updated.total_chunks > 0
        ? Math.round((updated.uploaded_chunks / updated.total_chunks) * 100)
        : 0,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/v1/upload/:uploadId/complete
 * Finalize an upload and create the file record.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Created file
 */
export async function completeUploadHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const uploadId = request.params.uploadId;

    const upload = await storage.getUpload(uploadId, request.user.id);
    if (!upload) {
      return notFound('Upload session not found');
    }

    if (upload.status === 'completed') {
      return badRequest('Upload is already completed');
    }

    if (upload.uploaded_chunks < upload.total_chunks) {
      return badRequest(
        `Upload incomplete: ${upload.uploaded_chunks}/${upload.total_chunks} chunks uploaded`
      );
    }

    let telegramMessageId = null;
    let telegramFileId = null;
    let isChunked = 0;
    let chunkCount = 0;
    let chunkMessageIds = null;

    const chunkRefs = upload.chunk_message_ids
      ? JSON.parse(upload.chunk_message_ids)
      : [];

    if (chunkRefs.length === 0) {
      return badRequest('No chunk references found. Upload may have failed.');
    }

    if (chunkRefs.length === 1) {
      telegramMessageId = chunkRefs[0].messageId;
      telegramFileId = chunkRefs[0].fileId;
      isChunked = 0;
      chunkCount = 0;
      chunkMessageIds = null;
    } else {
      isChunked = 1;
      chunkCount = chunkRefs.length;
      chunkMessageIds = JSON.stringify(chunkRefs.map((r) => r.messageId));

      const folder = await storage.getFolderById(upload.folder_id, request.user.id);
      if (folder && chunkRefs[0].fileId) {
        telegramFileId = chunkRefs[0].fileId;
      }
    }

    const extension = getFileExtension(upload.file_name);

    const file = await storage.createFile({
      user_id: request.user.id,
      folder_id: upload.folder_id,
      name: upload.file_name,
      original_name: upload.file_name,
      extension,
      mime_type: upload.mime_type,
      size: upload.file_size,
      telegram_message_id: telegramMessageId,
      telegram_file_id: telegramFileId,
      is_chunked,
      chunk_count: chunkCount,
      chunk_message_ids: chunkMessageIds,
    });

    await storage.addStorageUsed(request.user.id, upload.file_size);

    await storage.updateUpload(uploadId, { status: 'completed', completed_at: now() });

    await storage.createActivity({
      user_id: request.user.id,
      type: 'file_uploaded',
      target_type: 'file',
      target_id: file.id,
      metadata: {
        name: file.name,
        size: file.size,
        mimeType: file.mime_type,
        folderId: file.folder_id,
        isChunked: isChunked === 1,
      },
    });

    return created(file);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/v1/upload/:uploadId/status
 * Get the current upload progress.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} Upload status with progress
 */
export async function getUploadStatusHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const uploadId = request.params.uploadId;

    const upload = await storage.getUpload(uploadId, request.user.id);
    if (!upload) {
      return notFound('Upload session not found');
    }

    const progress = upload.total_chunks > 0
      ? Math.round((upload.uploaded_chunks / upload.total_chunks) * 100)
      : 0;

    const remainingBytes = upload.file_size - upload.bytes_uploaded;
    let estimatedTimeRemaining = null;
    if (upload.speed_bps && upload.speed_bps > 0 && remainingBytes > 0) {
      estimatedTimeRemaining = Math.ceil(remainingBytes / upload.speed_bps);
    }

    return success({
      id: upload.id,
      fileName: upload.file_name,
      fileSize: upload.file_size,
      mimeType: upload.mime_type,
      status: upload.status,
      totalChunks: upload.total_chunks,
      uploadedChunks: upload.uploaded_chunks,
      bytesUploaded: upload.bytes_uploaded,
      progress,
      speedBps: upload.speed_bps,
      estimatedTimeRemaining,
      errorMessage: upload.error_message,
      createdAt: upload.created_at,
      startedAt: upload.started_at,
      completedAt: upload.completed_at,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/v1/upload/:uploadId
 * Cancel an in-progress upload.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} ctx - Execution context
 * @returns {Promise<Response>} 204 No Content
 */
export async function cancelUploadHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    const uploadId = request.params.uploadId;

    const upload = await storage.getUpload(uploadId, request.user.id);
    if (!upload) {
      return notFound('Upload session not found');
    }

    if (upload.status === 'completed') {
      return badRequest('Cannot cancel a completed upload');
    }

    const folder = await storage.getFolderById(upload.folder_id, request.user.id);
    if (folder && folder.telegram_group_id) {
      const telegram = createTelegramBot(env);
      const chunkRefs = upload.chunk_message_ids
        ? JSON.parse(upload.chunk_message_ids)
        : [];

      for (const ref of chunkRefs) {
        try {
          await telegram.deleteMessage(folder.telegram_group_id, ref.messageId);
        } catch {
          // Best-effort cleanup
        }
      }
    }

    await storage.deleteUpload(uploadId, request.user.id);

    return noContent();
  } catch (err) {
    return serverError(err);
  }
}
