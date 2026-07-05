/**
 * Telegram Bot API service.
 * Handles group management and file operations via Bot API.
 * File size limits: upload 50MB, download 20MB.
 *
 * @module services/telegram
 */

import { ERRORS } from '../constants/errors.js';
import { logger } from '../utils/logger.js';

class TelegramError extends Error {
  constructor(errorCode, description, parameters = null) {
    super(description);
    this.name = 'TelegramError';
    this.errorCode = errorCode;
    this.parameters = parameters;
  }

  toJSON() {
    return {
      name: this.name,
      errorCode: this.errorCode,
      description: this.message,
      parameters: this.parameters,
    };
  }
}

class TelegramBotService {
  /**
   * @param {Object} env - Cloudflare Workers env bindings
   * @param {string} env.TELEGRAM_BOT_TOKEN - Bot token from BotFather
   */
  constructor(env) {
    this.token = env.TELEGRAM_BOT_TOKEN;
    this.apiBase = `https://api.telegram.org/bot${this.token}`;
    this.fileBase = `https://api.telegram.org/file/bot${this.token}`;
  }

  /**
   * Make HTTP request to Telegram Bot API.
   * Handles errors and retries once on network failure/timeout.
   *
   * @param {string} method - Bot API method name
   * @param {Object} [params={}] - JSON-serializable parameters
   * @returns {Promise<Object>} Parsed result from Telegram
   * @throws {TelegramError} On API error or network failure
   */
  async request(method, params = {}) {
    const url = `${this.apiBase}/${method}`;

    const doFetch = async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      if (!data.ok) {
        throw new TelegramError(
          data.error_code || 0,
          data.description || 'Unknown Telegram error',
          data.parameters || null
        );
      }
      return data.result;
    };

    try {
      return await doFetch();
    } catch (err) {
      if (err instanceof TelegramError) throw err;

      logger.warn(`Telegram API request failed, retrying once`, {
        method,
        error: err.message,
      });

      try {
        return await doFetch();
      } catch (retryErr) {
        if (retryErr instanceof TelegramError) throw retryErr;
        throw new TelegramError(0, `Network error: ${retryErr.message}`);
      }
    }
  }

  /**
   * Make a raw fetch call (used for multipart uploads).
   *
   * @param {string} method - Bot API method name
   * @param {FormData} formData - Multipart form data body
   * @returns {Promise<Object>} Parsed result
   */
  async requestMultipart(method, formData) {
    const url = `${this.apiBase}/${method}`;

    const doFetch = async () => {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!data.ok) {
        throw new TelegramError(
          data.error_code || 0,
          data.description || 'Unknown Telegram error',
          data.parameters || null
        );
      }
      return data.result;
    };

    try {
      return await doFetch();
    } catch (err) {
      if (err instanceof TelegramError) throw err;

      logger.warn(`Telegram multipart request failed, retrying once`, {
        method,
        error: err.message,
      });

      try {
        return await doFetch();
      } catch (retryErr) {
        if (retryErr instanceof TelegramError) throw retryErr;
        throw new TelegramError(0, `Network error: ${retryErr.message}`);
      }
    }
  }

  // ─── Group Management ──────────────────────────────────────────────

  /**
   * Create a new supergroup.
   *
   * @param {string} title - Group title
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.description] - Group description
   * @returns {Promise<Object>} Chat object
   */
  async createGroup(title, options = {}) {
    const params = { title };

    if (options.description) {
      params.description = options.description;
    }

    return this.request('createSupergroup', params);
  }

  /**
   * Rename an existing group.
   *
   * @param {number|string} chatId - Chat ID (negative for groups)
   * @param {string} newTitle - New group title
   * @returns {Promise<boolean>} Success status
   */
  async renameGroup(chatId, newTitle) {
    return this.request('setChatTitle', {
      chat_id: Number(chatId),
      title: newTitle,
    });
  }

  /**
   * Leave a group (groups cannot be deleted via Bot API).
   *
   * @param {number|string} chatId - Chat ID to leave
   * @returns {Promise<boolean>} Success status
   */
  async deleteGroup(chatId) {
    return this.request('leaveChat', {
      chat_id: Number(chatId),
    });
  }

  /**
   * Get information about a group.
   *
   * @param {number|string} chatId - Chat ID
   * @returns {Promise<Object>} Chat object with title, type, etc.
   */
  async getGroupInfo(chatId) {
    return this.request('getChat', {
      chat_id: Number(chatId),
    });
  }

  /**
   * Generate an invite link for a group.
   *
   * @param {number|string} chatId - Chat ID
   * @returns {Promise<string>} Invite link URL
   */
  async getGroupInviteLink(chatId) {
    const result = await this.request('exportChatInviteLink', {
      chat_id: Number(chatId),
    });
    return result;
  }

  /**
   * Set group description.
   *
   * @param {number|string} chatId - Chat ID
   * @param {string} description - New description
   * @returns {Promise<boolean>} Success status
   */
  async setGroupDescription(chatId, description) {
    return this.request('setChatDescription', {
      chat_id: Number(chatId),
      description,
    });
  }

  /**
   * Set group photo.
   *
   * @param {number|string} chatId - Chat ID
   * @param {Uint8Array|ArrayBuffer} photoBuffer - Photo file data
   * @returns {Promise<boolean>} Success status
   */
  async setGroupPhoto(chatId, photoBuffer) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('photo', new Blob([photoBuffer], { type: 'image/jpeg' }), 'photo.jpg');
    return this.requestMultipart('setChatPhoto', formData);
  }

  /**
   * Delete group photo.
   *
   * @param {number|string} chatId - Chat ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteGroupPhoto(chatId) {
    return this.request('deleteChatPhoto', {
      chat_id: Number(chatId),
    });
  }

  // ─── File Operations ───────────────────────────────────────────────

  /**
   * Upload a document to a Telegram group.
   * Supports files up to 50MB via Bot API.
   *
   * @param {number|string} chatId - Target chat ID
   * @param {Uint8Array|ArrayBuffer} fileBuffer - Raw file data
   * @param {string} fileName - Display file name
   * @param {string} mimeType - MIME type of the file
   * @param {Object} [options={}] - Additional send options
   * @param {string} [options.caption] - File caption
   * @param {boolean} [options.disableNotification] - Send silently
   * @returns {Promise<Object>} Message result with message_id and document.file_id
   */
  async sendDocument(chatId, fileBuffer, fileName, mimeType, options = {}) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', new Blob([fileBuffer], { type: mimeType }), fileName);

    if (options.caption) {
      formData.append('caption', options.caption);
    }
    if (options.disableNotification) {
      formData.append('disable_notification', 'true');
    }

    return this.requestMultipart('sendDocument', formData);
  }

  /**
   * Send a document using an existing file_id (no re-upload needed).
   * Used for sending chunked file parts or duplicates.
   *
   * @param {number|string} chatId - Target chat ID
   * @param {string} fileId - Telegram file_id from a previous upload
   * @param {string} [caption] - Optional file caption
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} Message result
   */
  async sendDocumentByFileId(chatId, fileId, caption, options = {}) {
    const params = {
      chat_id: Number(chatId),
      document: fileId,
    };

    if (caption) {
      params.caption = caption;
    }
    if (options.disableNotification) {
      params.disable_notification = options.disableNotification;
    }

    return this.request('sendDocument', params);
  }

  /**
   * Send a photo to a group.
   *
   * @param {number|string} chatId - Target chat ID
   * @param {Uint8Array|ArrayBuffer} photoBuffer - Image data
   * @param {string} fileName - File name
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} Message result with photo info
   */
  async sendPhoto(chatId, photoBuffer, fileName, options = {}) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('photo', new Blob([photoBuffer], { type: 'image/jpeg' }), fileName);

    if (options.caption) {
      formData.append('caption', options.caption);
    }

    return this.requestMultipart('sendPhoto', formData);
  }

  /**
   * Get file metadata from Telegram by file_id.
   *
   * @param {string} fileId - Telegram file_id
   * @returns {Promise<Object>} File object with file_path, file_size, etc.
   */
  async getFile(fileId) {
    return this.request('getFile', {
      file_id: fileId,
    });
  }

  /**
   * Download a file from Telegram servers.
   * Two-step process: get file path then download.
   * Supports files up to 20MB via Bot API.
   *
   * @param {string} fileId - Telegram file_id
   * @returns {Promise<ArrayBuffer>} File content as ArrayBuffer
   */
  async downloadFile(fileId) {
    const fileInfo = await this.getFile(fileId);

    if (!fileInfo.file_path) {
      throw new TelegramError(0, 'File path not available for download');
    }

    const downloadUrl = this.getFileDownloadUrl(fileInfo.file_path);

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new TelegramError(
        response.status,
        `Failed to download file: ${response.statusText}`
      );
    }

    return response.arrayBuffer();
  }

  /**
   * Forward a message from one chat to another.
   *
   * @param {number|string} fromChatId - Source chat
   * @param {number|string} toChatId - Destination chat
   * @param {number} messageId - Message ID to forward
   * @returns {Promise<Object>} Forwarded message result
   */
  async forwardMessage(fromChatId, toChatId, messageId) {
    return this.request('forwardMessage', {
      from_chat_id: Number(fromChatId),
      chat_id: Number(toChatId),
      message_id: messageId,
    });
  }

  /**
   * Delete a message from a chat.
   *
   * @param {number|string} chatId - Chat containing the message
   * @param {number} messageId - Message ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteMessage(chatId, messageId) {
    return this.request('deleteMessage', {
      chat_id: Number(chatId),
      message_id: messageId,
    });
  }

  /**
   * Edit message caption.
   *
   * @param {number|string} chatId - Chat ID
   * @param {number} messageId - Message ID
   * @param {string} caption - New caption
   * @returns {Promise<Object>} Edited message result
   */
  async editMessageCaption(chatId, messageId, caption) {
    return this.request('editMessageCaption', {
      chat_id: Number(chatId),
      message_id: messageId,
      caption,
    });
  }

  /**
   * Get the download URL for a file path.
   *
   * @param {string} filePath - File path from getFile response
   * @returns {string} Full download URL
   */
  getFileDownloadUrl(filePath) {
    return `${this.fileBase}/${filePath}`;
  }

  // ─── Verification ──────────────────────────────────────────────────

  /**
   * Verify Telegram Login Widget authentication data.
   * Validates HMAC-SHA256 signature and checks auth_date freshness.
   *
   * @param {Object} authData - Login widget data from Telegram
   * @param {number|string} authData.id - User's Telegram ID
   * @param {string} authData.hash - HMAC-SHA256 hex hash for verification
   * @param {number|string} authData.auth_date - Unix timestamp of the auth
   * @param {string} [authData.first_name] - User's first name
   * @param {string} [authData.last_name] - User's last name
   * @param {string} [authData.username] - User's username
   * @param {string} [authData.photo_url] - User's profile photo URL
   * @returns {Promise<Object>} Verified user data
   * @throws {TelegramError} If verification fails
   */
  async verifyTelegramAuth(authData) {
    const { hash, auth_date, ...fields } = authData;

    if (!hash || !auth_date) {
      throw new TelegramError(401, 'Missing hash or auth_date');
    }

    const authDateNum = parseInt(auth_date, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Number.isNaN(authDateNum)) {
      throw new TelegramError(401, 'Invalid auth_date');
    }

    if (now - authDateNum > 86400) {
      throw new TelegramError(401, 'Auth date expired (older than 24 hours)');
    }

    if (authDateNum > now + 300) {
      throw new TelegramError(401, 'Auth date is in the future');
    }

    const encoder = new TextEncoder();

    const secretKeyBytes = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(this.token)
    );

    const secretKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const keys = Object.keys(fields)
      .filter((k) => k !== 'hash')
      .sort();

    const dataCheckString = keys.map((k) => `${k}=${fields[k]}`).join('\n');

    const signature = await crypto.subtle.sign(
      'HMAC',
      secretKey,
      encoder.encode(dataCheckString)
    );

    const computedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedHash !== hash) {
      throw new TelegramError(401, 'Invalid hash: data verification failed');
    }

    return {
      id: fields.id ? parseInt(fields.id, 10) : null,
      first_name: fields.first_name || null,
      last_name: fields.last_name || null,
      username: fields.username || null,
      photo_url: fields.photo_url || null,
      auth_date: authDateNum,
    };
  }

  /**
   * Verify Telegram Web App (Mini App) initialization data.
   * Uses a different verification scheme than Login Widget.
   *
   * @param {string} initData - Raw initData string from Telegram.WebApp
   * @returns {Promise<Object>} Parsed and verified user data
   */
  async verifyWebAppData(initData) {
    const encoder = new TextEncoder();

    const secretKeyBytes = await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.token),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      encoder.encode('WebAppData')
    );

    const secretKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const keys = Array.from(params.keys()).sort();
    const checkString = keys.map((k) => `${k}=${params.get(k)}`).join('\n');

    const signature = await crypto.subtle.sign(
      'HMAC',
      secretKey,
      encoder.encode(checkString)
    );

    const computedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedHash !== hash) {
      throw new TelegramError(401, 'Invalid WebApp data hash');
    }

    const userStr = params.get('user');
    const user = userStr ? JSON.parse(userStr) : null;

    return {
      user,
      chat_type: params.get('chat_type'),
      chat_instance: params.get('chat_instance'),
      start_param: params.get('start_param'),
      auth_date: parseInt(params.get('auth_date'), 10),
    };
  }
}

/**
 * Create a TelegramBotService instance.
 *
 * @param {Object} env - Cloudflare Workers env bindings
 * @returns {TelegramBotService} Configured service instance
 */
export function createTelegramBot(env) {
  return new TelegramBotService(env);
}

export { TelegramBotService, TelegramError };
