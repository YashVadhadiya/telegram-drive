/**
 * @file Upload service — chunked uploads, progress tracking, retry, queue management.
 */

import { CONFIG } from '../constants/config.js';
import { api } from './api.js';
import { bytesToChunks, generateId, sleep } from '../utils/helpers.js';

/* ------------------------------------------------------------------ */
/*  Typedefs                                                          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {'pending'|'uploading'|'paused'|'completed'|'error'|'cancelled'} UploadStatus
 */

/**
 * @typedef {Object} UploadController
 * @property {string} uploadId
 * @property {File} file
 * @property {string} folderId
 * @property {number} progress - 0–100
 * @property {UploadStatus} status
 * @property {AbortController} abortController
 * @property {() => void} [start]
 * @property {() => void} [cancel]
 * @property {() => void} [pause]
 * @property {() => void} [resume]
 */

/**
 * @typedef {Object} UploadEventPayload
 * @property {string} uploadId
 * @property {string} fileName
 * @property {number} [progress]
 * @property {UploadStatus} [status]
 * @property {string} [error]
 */

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Retry an async function with exponential backoff and jitter.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [attempts]
 * @param {number} [baseDelay]
 * @returns {Promise<T>}
 */
async function _withRetry(fn, attempts = CONFIG.UPLOAD_RETRY_ATTEMPTS, baseDelay = CONFIG.UPLOAD_RETRY_DELAY) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = baseDelay * (2 ** i) + Math.random() * 1000;
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

/* ------------------------------------------------------------------ */
/*  UploadService                                                      */
/* ------------------------------------------------------------------ */

class UploadService {
  constructor() {
    /** @type {Array<{ file: File, folderId: string }>} */
    this.queue = [];

    /** @type {Map<string, UploadController>} */
    this.active = new Map();

    /** @type {number} */
    this.activeCount = 0;

    /** @type {Array<{ event: string, fn: Function }>} */
    this.listeners = [];
  }

  /* ---- event system ---- */

  /**
   * Subscribe to upload events.
   * @param {'progress'|'complete'|'error'} event
   * @param {(payload: UploadEventPayload) => void} fn
   * @returns {() => void}
   */
  on(event, fn) {
    this.listeners.push({ event, fn });
    return () => {
      const idx = this.listeners.findIndex((l) => l.event === event && l.fn === fn);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Notify listeners of an event.
   * @param {string} event
   * @param {UploadEventPayload} payload
   */
  _notify(event, payload) {
    for (const listener of this.listeners) {
      if (listener.event === event) {
        try { listener.fn(payload); } catch { /* skip */ }
      }
    }
  }

  /* ---- queue management ---- */

  /**
   * Get the list of queued files.
   * @returns {Array<{ file: File, folderId: string }>}
   */
  getQueue() {
    return [...this.queue];
  }

  /**
   * Get the list of active upload controllers.
   * @returns {UploadController[]}
   */
  getActiveUploads() {
    return Array.from(this.active.values());
  }

  /**
   * Process the next item in the queue if concurrency allows.
   */
  _processQueue() {
    while (this.activeCount < CONFIG.MAX_CONCURRENT_UPLOADS && this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        this._startUpload(item.file, item.folderId).catch(() => {
          /* individual upload failure is already handled */
        });
      }
    }
  }

  /* ---- core upload logic ---- */

  /**
   * Enqueue a file for upload. If the concurrency slot is available it starts
   * immediately; otherwise it waits in the queue.
   * @param {string} folderId
   * @param {File} file
   * @returns {Promise<{ uploadId: string, status: UploadStatus }>}
   */
  async uploadFile(folderId, file) {
    const uploadId = generateId();

    /* Enqueue */
    this.queue.push({ file, folderId });

    /* If concurrency allows, start immediately */
    this._processQueue();

    /* Wait until this file's upload is done (polling its status) */
    return new Promise((resolve) => {
      const check = () => {
        const controller = this.active.get(uploadId);
        if (!controller) {
          /* Might still be in queue */
          const queued = this.queue.some((item) => item.file.name === file.name && item.file.size === file.size);
          if (!queued) {
            resolve({ uploadId, status: 'cancelled' });
            return;
          }
          setTimeout(check, 200);
          return;
        }
        if (controller.status === 'completed' || controller.status === 'error' || controller.status === 'cancelled') {
          resolve({ uploadId, status: controller.status });
        } else {
          setTimeout(check, 200);
        }
      };
      setTimeout(check, 200);
    });
  }

  /**
   * Start uploading a single file (called internally by the queue processor).
   * @param {File} file
   * @param {string} folderId
   * @returns {Promise<void>}
   */
  async _startUpload(file, folderId) {
    const uploadId = generateId();
    const abortController = new AbortController();

    /** @type {UploadController} */
    const controller = {
      uploadId,
      file,
      folderId,
      progress: 0,
      status: 'pending',
      abortController,
      cancel: () => this.cancelUpload(uploadId),
      pause: () => this.pauseUpload(uploadId),
      resume: () => this.resumeUpload(uploadId),
    };

    this.active.set(uploadId, controller);
    this.activeCount++;

    try {
      controller.status = 'uploading';

      /* 1. Initialise upload on the backend */
      const initRes = await _withRetry(() =>
        api.post('/upload/init', {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          folderId,
        }),
      );

      if (!initRes.success) {
        throw new Error(initRes.error ?? 'Failed to initialise upload');
      }

      const initData = /** @type {{ uploadId: string, chunkSize?: number }} */ (initRes.data);
      const remoteUploadId = initData.uploadId;

      const chunkSize = initData.chunkSize ?? CONFIG.CHUNK_SIZE;
      const { totalChunks } = bytesToChunks(file.size, chunkSize);

      if (file.size <= chunkSize) {
        /* ---- Single upload ---- */
        await this._uploadSingle(remoteUploadId, file, controller);
      } else {
        /* ---- Chunked upload ---- */
        for (let i = 0; i < totalChunks; i++) {
          if (abortController.signal.aborted) break;

          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunkData = file.slice(start, end);

          await this._uploadChunk(remoteUploadId, i, chunkData, totalChunks, controller);

          const overallProgress = Math.round(((i + 1) / totalChunks) * 100);
          controller.progress = overallProgress;

          this._notify('progress', {
            uploadId: controller.uploadId,
            fileName: file.name,
            progress: overallProgress,
          });
        }
      }

      if (abortController.signal.aborted) {
        controller.status = 'cancelled';
        this._notify('error', {
          uploadId: controller.uploadId,
          fileName: file.name,
          status: 'cancelled',
        });
        return;
      }

      /* 3. Signal completion to the backend */
      const completeRes = await _withRetry(() =>
        api.post(`/upload/${remoteUploadId}/complete`),
      );

      if (!completeRes.success) {
        throw new Error(completeRes.error ?? 'Failed to complete upload');
      }

      controller.status = 'completed';
      controller.progress = 100;

      this._notify('complete', {
        uploadId: controller.uploadId,
        fileName: file.name,
        progress: 100,
        status: 'completed',
      });
    } catch (err) {
      controller.status = 'error';
      this._notify('error', {
        uploadId: controller.uploadId,
        fileName: file.name,
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      this.active.delete(uploadId);
      this.activeCount--;
      this._processQueue();
    }
  }

  /**
   * Upload a single (small) file without chunking.
   * @param {string} remoteUploadId
   * @param {File} file
   * @param {UploadController} controller
   * @returns {Promise<void>}
   */
  async _uploadSingle(remoteUploadId, file, controller) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadId', remoteUploadId);

    const res = await _withRetry(() =>
      api.upload(`/upload/${remoteUploadId}/chunk`, formData, (loaded, total) => {
        controller.progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
        this._notify('progress', {
          uploadId: controller.uploadId,
          fileName: file.name,
          progress: controller.progress,
        });
      }, controller.abortController.signal),
    );

    if (!res.success) {
      throw new Error(res.error ?? 'Upload chunk failed');
    }
  }

  /**
   * Upload a single chunk.
   * @param {string} remoteUploadId
   * @param {number} chunkIndex
   * @param {Blob} chunkData
   * @param {number} totalChunks
   * @param {UploadController} controller
   * @returns {Promise<void>}
   */
  async _uploadChunk(remoteUploadId, chunkIndex, chunkData, totalChunks, controller) {
    const formData = new FormData();
    formData.append('chunk', chunkData, `chunk_${chunkIndex}`);
    formData.append('uploadId', remoteUploadId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));

    const res = await _withRetry(() =>
      api.upload(`/upload/${remoteUploadId}/chunk`, formData, undefined, controller.abortController.signal),
    );

    if (!res.success) {
      throw new Error(res.error ?? `Chunk ${chunkIndex} upload failed`);
    }
  }

  /* ---- cancel / pause / resume ---- */

  /**
   * Cancel an active upload and tell the backend to discard it.
   * @param {string} uploadId
   * @returns {Promise<{ success: boolean }>}
   */
  async cancelUpload(uploadId) {
    const controller = this.active.get(uploadId);
    if (!controller) return { success: false };

    /* Abort the in-flight XHR/fetch */
    controller.abortController.abort();

    /* Tell the backend to clean up */
    try {
      await api.delete(`/upload/${uploadId}`);
    } catch {
      /* best-effort */
    }

    controller.status = 'cancelled';
    this.active.delete(uploadId);
    this.activeCount--;
    this._processQueue();

    return { success: true };
  }

  /**
   * Pause an upload (currently sets status; actual pause/resume is a future
   * enhancement that requires backend support for resumable uploads).
   * @param {string} uploadId
   * @returns {{ success: boolean, message: string }}
   */
  pauseUpload(uploadId) {
    const controller = this.active.get(uploadId);
    if (!controller) return { success: false, message: 'Upload not found' };

    controller.status = 'paused';
    this._notify('progress', {
      uploadId: controller.uploadId,
      fileName: controller.file.name,
      status: 'paused',
    });
    return { success: true, message: 'Pause/resume requires backend support' };
  }

  /**
   * Resume a paused upload.
   * @param {string} uploadId
   * @returns {{ success: boolean, message: string }}
   */
  resumeUpload(uploadId) {
    const controller = this.active.get(uploadId);
    if (!controller) return { success: false, message: 'Upload not found' };

    if (controller.status !== 'paused') {
      return { success: false, message: 'Upload is not paused' };
    }

    controller.status = 'uploading';
    this._notify('progress', {
      uploadId: controller.uploadId,
      fileName: controller.file.name,
      status: 'uploading',
    });
    return { success: true, message: 'Pause/resume requires backend support' };
  }
}

/** @type {UploadService} */
export const upload = new UploadService();
