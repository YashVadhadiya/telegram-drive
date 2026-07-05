/**
 * Upload queue service.
 * Manages the upload queue stored in D1.
 * Provides progress tracking, retry logic, and cleanup.
 *
 * @module services/queue
 */

import { generateId } from '../utils/idGenerator.js';
import { now } from '../utils/helpers.js';
import { LIMITS } from '../constants/limits.js';

class UploadQueueError extends Error {
  constructor(message, code = 'QUEUE_ERROR') {
    super(message);
    this.name = 'UploadQueueError';
    this.code = code;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

class UploadQueueService {
  /**
   * @param {Object} env - Cloudflare Workers env bindings
   * @param {Object} storage - StorageService instance
   */
  constructor(env, storage) {
    this.env = env;
    this.storage = storage;
  }

  /**
   * Create a new upload queue entry and track it in the database.
   *
   * @param {string} userId - Internal user ID
   * @param {string} folderId - Destination folder ID
   * @param {string} fileName - Original file name
   * @param {number} fileSize - File size in bytes
   * @param {string} mimeType - MIME type of the file
   * @param {Object} [options={}] - Additional options
   * @param {number} [options.chunkSize] - Custom chunk size (default from env)
   * @returns {Promise<Object>} Created upload entry
   */
  async createUpload(userId, folderId, fileName, fileSize, mimeType, options = {}) {
    if (!userId) throw new UploadQueueError('userId is required', 'MISSING_USER');
    if (!folderId) throw new UploadQueueError('folderId is required', 'MISSING_FOLDER');
    if (!fileName) throw new UploadQueueError('fileName is required', 'MISSING_FILENAME');
    if (!fileSize || fileSize <= 0) throw new UploadQueueError('fileSize must be positive', 'INVALID_SIZE');

    const activeUploads = await this.storage.getUserUploads(userId);
    const maxConcurrent = parseInt(this.env.MAX_CONCURRENT_UPLOADS) || LIMITS.MAX_CONCURRENT_UPLOADS;

    if (activeUploads.length >= maxConcurrent) {
      throw new UploadQueueError(
        `Maximum ${maxConcurrent} concurrent uploads allowed`,
        'MAX_CONCURRENT'
      );
    }

    const chunkSize = options.chunkSize || parseInt(this.env.CHUNK_SIZE || '52428800', 10);
    const chunkInfo = this._calculateChunks(fileSize, chunkSize);

    return this.storage.createUpload({
      id: generateId('upl'),
      user_id: userId,
      folder_id: folderId,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      chunk_size: chunkSize,
      total_chunks: chunkInfo.totalChunks,
      uploaded_chunks: 0,
      bytes_uploaded: 0,
      status: 'pending',
    });
  }

  /**
   * Mark an upload as started (transition from pending to uploading).
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Updated upload entry
   */
  async startUpload(uploadId, userId) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status === 'completed') {
      throw new UploadQueueError('Upload is already completed', 'ALREADY_COMPLETED');
    }

    await this.storage.updateUpload(uploadId, {
      status: 'uploading',
      started_at: now(),
    });

    return this.storage.getUpload(uploadId, userId);
  }

  /**
   * Mark a single chunk as uploaded and update progress.
   * Automatically marks the upload as completed if all chunks are done.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @param {number} chunkSize - Size of the uploaded chunk in bytes
   * @returns {Promise<Object>} Updated upload entry with completion status
   */
  async markChunkComplete(uploadId, userId, chunkSize) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status === 'completed') {
      return upload;
    }

    if (upload.status !== 'uploading') {
      await this.storage.updateUpload(uploadId, { status: 'uploading' });
    }

    const newUploadedChunks = upload.uploaded_chunks + 1;
    const newBytesUploaded = upload.bytes_uploaded + chunkSize;
    const speed = await this._calculateSpeed(upload, newBytesUploaded);

    const updates = {
      uploaded_chunks: newUploadedChunks,
      bytes_uploaded: newBytesUploaded,
      speed_bps: speed,
    };

    if (newUploadedChunks >= upload.total_chunks) {
      updates.status = 'completed';
      updates.completed_at = now();
    } else {
      updates.status = 'uploading';
    }

    await this.storage.updateUpload(uploadId, updates);

    const result = await this.storage.getUpload(uploadId, userId);

    if (result.status === 'completed') {
      await this._onUploadComplete(result);
    }

    return result;
  }

  /**
   * Mark multiple chunks as completed at once.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @param {number} chunksCount - Number of chunks completed
   * @param {number} bytesUploaded - Total bytes uploaded in this batch
   * @returns {Promise<Object>} Updated upload entry
   */
  async markBatchComplete(uploadId, userId, chunksCount, bytesUploaded) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status === 'completed') {
      return upload;
    }

    const newUploadedChunks = upload.uploaded_chunks + chunksCount;
    const newBytesUploaded = upload.bytes_uploaded + bytesUploaded;
    const speed = await this._calculateSpeed(upload, newBytesUploaded);

    const updates = {
      uploaded_chunks: newUploadedChunks,
      bytes_uploaded: newBytesUploaded,
      speed_bps: speed,
    };

    if (newUploadedChunks >= upload.total_chunks) {
      updates.status = 'completed';
      updates.completed_at = now();
    } else if (upload.status === 'pending') {
      updates.status = 'uploading';
      updates.started_at = now();
    } else {
      updates.status = 'uploading';
    }

    await this.storage.updateUpload(uploadId, updates);

    const result = await this.storage.getUpload(uploadId, userId);

    if (result.status === 'completed') {
      await this._onUploadComplete(result);
    }

    return result;
  }

  /**
   * Mark an upload as failed with an error message.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @param {string} errorMessage - Description of the failure
   * @returns {Promise<Object|null>} Updated upload entry
   */
  async markFailed(uploadId, userId, errorMessage) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status === 'completed') {
      throw new UploadQueueError('Cannot mark a completed upload as failed', 'ALREADY_COMPLETED');
    }

    await this.storage.updateUpload(uploadId, {
      status: 'failed',
      error_message: errorMessage,
    });

    return this.storage.getUpload(uploadId, userId);
  }

  /**
   * Mark an upload as paused (can be resumed later).
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Updated upload entry
   */
  async markPaused(uploadId, userId) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status !== 'uploading') {
      throw new UploadQueueError('Only active uploads can be paused', 'INVALID_STATUS');
    }

    await this.storage.updateUpload(uploadId, { status: 'paused' });

    return this.storage.getUpload(uploadId, userId);
  }

  /**
   * Resume a paused upload.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Updated upload entry
   */
  async resumeUpload(uploadId, userId) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status !== 'paused' && upload.status !== 'failed') {
      throw new UploadQueueError('Upload is not in a resumable state', 'NOT_RESUMABLE');
    }

    await this.storage.updateUpload(uploadId, {
      status: 'uploading',
      started_at: now(),
      error_message: null,
    });

    return this.storage.getUpload(uploadId, userId);
  }

  /**
   * Cancel an upload (removes from queue or marks as cancelled).
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the upload was cancelled
   */
  async cancelUpload(uploadId, userId) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status === 'completed') {
      throw new UploadQueueError('Cannot cancel a completed upload', 'ALREADY_COMPLETED');
    }

    await this.storage.updateUpload(uploadId, {
      status: 'cancelled',
    });

    return true;
  }

  /**
   * Get resumable uploads for a user (paused or failed).
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of resumable uploads
   */
  async getResumableUploads(userId) {
    const result = await this.storage.db.prepare(`
      SELECT * FROM upload_queue
      WHERE user_id = ? AND (status = 'failed' OR status = 'paused')
      ORDER BY created_at DESC
    `).bind(userId).all();
    return result.results || [];
  }

  /**
   * Get the current status of an upload with progress info.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Upload status with progress
   */
  async getUploadStatus(uploadId, userId) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) return null;

    const progress = upload.total_chunks > 0
      ? Math.round((upload.uploaded_chunks / upload.total_chunks) * 100)
      : 0;

    const remainingBytes = upload.file_size - upload.bytes_uploaded;
    let estimatedTimeRemaining = null;

    if (upload.speed_bps && upload.speed_bps > 0 && remainingBytes > 0) {
      estimatedTimeRemaining = Math.ceil(remainingBytes / upload.speed_bps);
    }

    return {
      id: upload.id,
      file_name: upload.file_name,
      file_size: upload.file_size,
      mime_type: upload.mime_type,
      status: upload.status,
      total_chunks: upload.total_chunks,
      uploaded_chunks: upload.uploaded_chunks,
      bytes_uploaded: upload.bytes_uploaded,
      progress,
      speed_bps: upload.speed_bps,
      estimated_time_remaining: estimatedTimeRemaining,
      error_message: upload.error_message,
      created_at: upload.created_at,
      started_at: upload.started_at,
      completed_at: upload.completed_at,
    };
  }

  /**
   * Get all active uploads for a user with progress info.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of active uploads with progress
   */
  async getUserActiveUploads(userId) {
    const uploads = await this.storage.getUserUploads(userId);
    return uploads.map((u) => ({
      id: u.id,
      file_name: u.file_name,
      file_size: u.file_size,
      mime_type: u.mime_type,
      status: u.status,
      total_chunks: u.total_chunks,
      uploaded_chunks: u.uploaded_chunks,
      bytes_uploaded: u.bytes_uploaded,
      progress: u.total_chunks > 0
        ? Math.round((u.uploaded_chunks / u.total_chunks) * 100)
        : 0,
      error_message: u.error_message,
      created_at: u.created_at,
      started_at: u.started_at,
    }));
  }

  /**
   * Retry a failed upload.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Updated upload entry
   */
  async retryUpload(uploadId, userId) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status !== 'failed') {
      throw new UploadQueueError('Only failed uploads can be retried', 'NOT_FAILED');
    }

    await this.storage.updateUpload(uploadId, {
      status: 'pending',
      error_message: null,
    });

    return this.storage.getUpload(uploadId, userId);
  }

  /**
   * Clean up expired uploads (stuck in 'uploading' for over 1 hour).
   * Also removes completed/failed/cancelled uploads older than 24h.
   *
   * @returns {Promise<{expired: number, old: number}>} Cleanup counts
   */
  async cleanupExpired() {
    const now_ = now();
    const oneHourAgo = now_ - 3600;
    const oneDayAgo = now_ - 86400;

    const expiredResult = await this.storage.db.prepare(`
      UPDATE upload_queue SET status = 'failed', error_message = 'Upload timed out'
      WHERE status = 'uploading' AND started_at < ?
    `).bind(oneHourAgo).run();

    const oldResult = await this.storage.db.prepare(`
      DELETE FROM upload_queue
      WHERE (status = 'completed' OR status = 'failed' OR status = 'cancelled')
      AND created_at < ?
    `).bind(oneDayAgo).run();

    return {
      expired: expiredResult.meta?.changes || 0,
      old: oldResult.meta?.changes || 0,
    };
  }

  /**
   * Get an upload with its retry count and history.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Upload entry
   */
  async getUploadDetails(uploadId, userId) {
    return this.storage.getUpload(uploadId, userId);
  }

  /**
   * Get the next chunk index that needs to be uploaded for an in-progress upload.
   *
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<{nextChunkIndex: number, remainingChunks: number, progress: number}>}
   */
  async getNextChunk(uploadId, userId) {
    const upload = await this.storage.getUpload(uploadId, userId);
    if (!upload) throw new UploadQueueError('Upload not found', 'NOT_FOUND');

    if (upload.status === 'completed') {
      return {
        nextChunkIndex: -1,
        remainingChunks: 0,
        progress: 100,
      };
    }

    const nextChunkIndex = upload.uploaded_chunks;
    const remainingChunks = upload.total_chunks - nextChunkIndex;
    const progress = upload.total_chunks > 0
      ? Math.round((upload.uploaded_chunks / upload.total_chunks) * 100)
      : 0;

    return {
      nextChunkIndex,
      remainingChunks,
      progress,
    };
  }

  /**
   * Calculate upload speed in bytes per second.
   *
   * @param {Object} upload - Current upload state
   * @param {number} newBytesUploaded - Total bytes uploaded so far
   * @returns {Promise<number|null>} Speed in bps or null if not enough data
   */
  async _calculateSpeed(upload, newBytesUploaded) {
    const startedAt = upload.started_at;
    if (!startedAt) return null;

    const elapsed = now() - startedAt;
    if (elapsed < 1) return null;

    return Math.round(newBytesUploaded / elapsed);
  }

  /**
   * Calculate chunk information for a file.
   *
   * @param {number} fileSize - Total file size in bytes
   * @param {number} chunkSize - Chunk size in bytes
   * @returns {{totalChunks: number}} Chunk calculation result
   */
  _calculateChunks(fileSize, chunkSize) {
    const size = chunkSize || parseInt(this.env.CHUNK_SIZE || '52428800', 10);

    if (size <= 0 || !Number.isFinite(size)) {
      throw new UploadQueueError('Invalid chunk size', 'INVALID_CHUNK_SIZE');
    }

    return {
      totalChunks: Math.ceil(fileSize / size),
    };
  }

  /**
   * Hook called when an upload completes.
   * Creates an activity log entry.
   *
   * @param {Object} upload - Completed upload entry
   * @returns {Promise<void>}
   */
  async _onUploadComplete(upload) {
    try {
      await this.storage.createActivity({
        user_id: upload.user_id,
        type: 'upload_complete',
        target_type: 'upload',
        target_id: upload.id,
        metadata: {
          file_name: upload.file_name,
          file_size: upload.file_size,
          mime_type: upload.mime_type,
          folder_id: upload.folder_id,
        },
      });
    } catch (err) {
      console.error('Failed to create upload complete activity:', err.message);
    }
  }
}

/**
 * Create an UploadQueueService instance.
 *
 * @param {Object} env - Cloudflare Workers env bindings
 * @param {Object} storage - StorageService instance
 * @returns {UploadQueueService} Configured upload queue service instance
 */
export function createUploadQueue(env, storage) {
  return new UploadQueueService(env, storage);
}

export { UploadQueueService, UploadQueueError };
