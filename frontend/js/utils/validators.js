/**
 * @file Validation and sanitization utilities.
 */

import { CONFIG } from '../constants/config.js';
import { MIME_TYPES } from '../constants/types.js';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * Check whether a filename is valid (no illegal chars, non-empty).
 * @param {string} name
 * @returns {boolean}
 */
export function isValidFilename(name) {
  if (typeof name !== 'string' || name.trim().length === 0) return false;
  if (name.length > 255) return false;
  if (/^\.+$/.test(name)) return false;
  if (INVALID_FILENAME_CHARS.test(name)) return false;
  return true;
}

/**
 * Check whether a folder name is valid.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidFolderName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) return false;
  if (name.length > 255) return false;
  if (/^\.+$/.test(name)) return false;
  if (INVALID_FILENAME_CHARS.test(name)) return false;
  if (/[\\/]/.test(name)) return false;
  return true;
}

/**
 * Check whether the given File object is of an allowed type.
 * @param {File} file
 * @returns {boolean}
 */
export function isAllowedFileType(file) {
  if (!file) return false;
  const ext = getExtension(file.name);
  if (!ext) return true; // allow extensionless
  return ext in MIME_TYPES;
}

/**
 * Check whether the given File object is within the size limit.
 * @param {File} file
 * @returns {boolean}
 */
export function isAllowedFileSize(file) {
  if (!file) return false;
  return file.size <= CONFIG.MAX_FILE_SIZE;
}

/**
 * Validate a 3- or 6-digit hex colour string.
 * @param {string} color
 * @returns {boolean}
 */
export function isValidHexColor(color) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

/**
 * Basic phone number validation (E.164-ish).
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  return /^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s()-]/g, ''));
}

/**
 * Remove illegal filename characters and trim.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  if (typeof name !== 'string') return '';
  return name.replace(INVALID_FILENAME_CHARS, '_').trim().slice(0, 255);
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeHtml(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] || ch);
}

/**
 * Validate an API response data shape.
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateResponse(data) {
  const errors = [];

  if (data === null || data === undefined) {
    errors.push('Response body is empty');
    return { valid: false, errors };
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    errors.push('Response must be a JSON object');
    return { valid: false, errors };
  }

  const obj = /** @type {Record<string, unknown>} */ (data);

  if (obj.ok !== undefined && typeof obj.ok !== 'boolean') {
    errors.push('"ok" field must be a boolean');
  }

  if (obj.data !== undefined && typeof obj.data !== 'object') {
    errors.push('"data" field must be an object or array');
  }

  if (obj.error !== undefined && typeof obj.error !== 'string') {
    errors.push('"error" field must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract the lowercased extension from a filename.
 * @param {string} name
 * @returns {string}
 */
function getExtension(name) {
  if (typeof name !== 'string') return '';
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}
