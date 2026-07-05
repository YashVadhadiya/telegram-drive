/**
 * File validation functions.
 *
 * @module validators/file
 */

import { LIMITS } from '../constants/limits.js';
import { isAllowedFileType } from '../utils/helpers.js';
import { ALLOWED_MIME_TYPES } from '../constants/mimeTypes.js';

const FILENAME_REGEX = /^[^\\/:*?"<>|]+$/;

/**
 * Validate a file name.
 *
 * @param {*} name - The file name to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateFileName(name) {
  const errors = [];

  if (name === undefined || name === null) {
    errors.push('File name is required');
  } else if (typeof name !== 'string') {
    errors.push('File name must be a string');
  } else {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      errors.push('File name must not be empty');
    } else if (trimmed.length > LIMITS.MAX_FILENAME_LENGTH) {
      errors.push(`File name must be at most ${LIMITS.MAX_FILENAME_LENGTH} characters`);
    } else if (!FILENAME_REGEX.test(trimmed)) {
      errors.push('File name contains invalid characters (\\ / : * ? " < > |)');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a file size.
 *
 * @param {*} size - File size in bytes
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateFileSize(size) {
  const errors = [];

  if (size === undefined || size === null) {
    errors.push('File size is required');
  } else if (typeof size !== 'number' && typeof size !== 'string') {
    errors.push('File size must be a number');
  } else {
    const numSize = parseInt(size, 10);
    if (Number.isNaN(numSize) || numSize < 1) {
      errors.push('File size must be at least 1 byte');
    } else if (numSize > LIMITS.MAX_FILE_SIZE) {
      errors.push(`File size must not exceed ${LIMITS.MAX_FILE_SIZE} bytes (2GB)`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate upload initialization data.
 *
 * @param {Object} data - Upload init payload
 * @param {*} data.folder_id - Target folder ID
 * @param {*} data.file_name - File name
 * @param {*} data.file_size - File size in bytes
 * @param {*} data.mime_type - MIME type
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateUploadInit(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (!data.folder_id || typeof data.folder_id !== 'string') {
    errors.push('folder_id is required and must be a string');
  }

  const nameResult = validateFileName(data.file_name);
  errors.push(...nameResult.errors);

  const sizeResult = validateFileSize(data.file_size);
  errors.push(...sizeResult.errors);

  if (!data.mime_type || typeof data.mime_type !== 'string') {
    errors.push('mime_type is required and must be a string');
  } else if (!ALLOWED_MIME_TYPES.has(data.mime_type)) {
    errors.push(`File type '${data.mime_type}' is not allowed`);
  }

  return { valid: errors.length === 0, errors };
}
