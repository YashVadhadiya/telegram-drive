/**
 * User-related validation functions.
 *
 * @module validators/user
 */

const VALID_THEMES = ['dark', 'light', 'system'];
const VALID_LANGUAGES = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'pt', 'it', 'tr', 'ar', 'zh', 'ja'];
const VALID_CHUNK_SIZES = [26214400, 52428800, 104857600];

/**
 * Validate user settings update data.
 *
 * @param {Object} data - Settings payload
 * @param {*} [data.theme] - UI theme ('dark', 'light', 'system')
 * @param {*} [data.language] - Language code
 * @param {*} [data.chunkSize] - Upload chunk size
 * @param {*} [data.autoRetry] - Auto-retry on failure
 * @param {*} [data.notifications] - Enable notifications
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateSettings(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (data.theme !== undefined && data.theme !== null) {
    if (!VALID_THEMES.includes(data.theme)) {
      errors.push(`theme must be one of: ${VALID_THEMES.join(', ')}`);
    }
  }

  if (data.language !== undefined && data.language !== null) {
    if (!VALID_LANGUAGES.includes(data.language)) {
      errors.push(`language must be one of: ${VALID_LANGUAGES.join(', ')}`);
    }
  }

  if (data.chunkSize !== undefined && data.chunkSize !== null) {
    const size = parseInt(data.chunkSize, 10);
    if (!VALID_CHUNK_SIZES.includes(size)) {
      errors.push(`chunkSize must be one of: ${VALID_CHUNK_SIZES.join(', ')}`);
    }
  }

  if (data.autoRetry !== undefined && data.autoRetry !== null) {
    if (typeof data.autoRetry !== 'boolean') {
      errors.push('autoRetry must be a boolean');
    }
  }

  if (data.notifications !== undefined && data.notifications !== null) {
    if (typeof data.notifications !== 'boolean') {
      errors.push('notifications must be a boolean');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Telegram Login Widget authentication data.
 *
 * @param {Object} data - Telegram auth payload
 * @param {*} data.id - Telegram user ID
 * @param {*} data.hash - HMAC-SHA256 hash hex string
 * @param {*} data.auth_date - Unix timestamp of auth
 * @param {*} [data.first_name] - User's first name
 * @param {*} [data.username] - Telegram username
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateTelegramAuth(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (data.id === undefined || data.id === null) {
    errors.push('id is required');
  } else {
    const idNum = parseInt(data.id, 10);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      errors.push('id must be a positive integer');
    }
  }

  if (!data.hash || typeof data.hash !== 'string') {
    errors.push('hash is required and must be a 64-character hex string');
  } else if (!/^[0-9a-f]{64}$/i.test(data.hash)) {
    errors.push('hash must be a 64-character hex string');
  }

  if (data.auth_date === undefined || data.auth_date === null) {
    errors.push('auth_date is required');
  } else {
    const authDateNum = parseInt(data.auth_date, 10);
    if (!Number.isInteger(authDateNum) || authDateNum <= 0) {
      errors.push('auth_date must be a positive integer (Unix timestamp)');
    } else {
      const now = Math.floor(Date.now() / 1000);
      if (now - authDateNum > 86400) {
        errors.push('auth_date is too old (must be within 24 hours)');
      }
      if (authDateNum > now + 300) {
        errors.push('auth_date cannot be in the future');
      }
    }
  }

  if (data.first_name !== undefined && data.first_name !== null) {
    if (typeof data.first_name !== 'string') {
      errors.push('first_name must be a string');
    }
  }

  if (data.username !== undefined && data.username !== null) {
    if (typeof data.username !== 'string') {
      errors.push('username must be a string');
    }
  }

  return { valid: errors.length === 0, errors };
}
