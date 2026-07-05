import { MIME_TYPES, ALLOWED_MIME_TYPES } from '../constants/mimeTypes.js';
import { LIMITS } from '../constants/limits.js';

export function getFileExtension(filename) {
  if (!filename || !filename.includes('.')) return '';
  return filename.split('.').pop().toLowerCase();
}

export function getMimeType(extension) {
  if (!extension) return 'application/octet-stream';
  return MIME_TYPES[extension.toLowerCase()] || 'application/octet-stream';
}

export function isAllowedFileType(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function isAllowedFileSize(size) {
  return size > 0 && size <= LIMITS.MAX_FILE_SIZE;
}

export function parseJsonSafe(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function bytesToChunks(size, chunkSize = LIMITS.CHUNK_SIZE) {
  if (size <= 0 || chunkSize <= 0) return 0;
  return Math.ceil(size / chunkSize);
}

export function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return String(str).replace(/[&<>"']/g, (m) => map[m]);
}

export function now() {
  return Math.floor(Date.now() / 1000);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function paginate(page = 1, perPage = LIMITS.ITEMS_PER_PAGE) {
  const limit = clamp(perPage, 1, LIMITS.MAX_ITEMS_PER_PAGE);
  const offset = (Math.max(page, 1) - 1) * limit;
  return { limit, offset, page: Math.max(page, 1) };
}

export function buildPaginationMeta(count, page, perPage) {
  const totalPages = Math.ceil(count / perPage) || 1;
  return {
    total: count,
    page,
    perPage,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
