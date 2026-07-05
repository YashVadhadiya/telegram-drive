/**
 * Storage service wrapping D1 (SQLite) and KV operations.
 * Provides a clean API for all database interactions.
 *
 * @module services/storage
 */

import { generateId } from '../utils/idGenerator.js';
import { paginate, now } from '../utils/helpers.js';

class StorageService {
  /**
   * @param {Object} env - Cloudflare Workers env bindings
   * @param {D1Database} env.DB - D1 database binding
   * @param {KVNamespace} env.KV - KV namespace binding
   */
  constructor(env) {
    this.db = env.DB;
    this.kv = env.KV;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Users
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get a user by their internal ID.
   *
   * @param {string} id - Internal user ID
   * @returns {Promise<Object|null>} User object or null
   */
  async getUserById(id) {
    return this.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first();
  }

  /**
   * Get a user by their Telegram ID.
   *
   * @param {number} telegramId - Telegram user ID
   * @returns {Promise<Object|null>} User object or null
   */
  async getUserByTelegramId(telegramId) {
    return this.db.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(telegramId).first();
  }

  /**
   * Get a user by their username.
   *
   * @param {string} username - Telegram username (without @)
   * @returns {Promise<Object|null>} User object or null
   */
  async getUserByUsername(username) {
    return this.db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first();
  }

  /**
   * Create a new user.
   *
   * @param {Object} user - User data
   * @param {string} [user.id] - Internal ID (auto-generated if omitted)
   * @param {number} user.telegram_id - Telegram user ID
   * @param {string} [user.username] - Telegram username
   * @param {string} user.first_name - User's first name
   * @param {string} [user.last_name] - User's last name
   * @param {string} [user.avatar_url] - Profile photo URL
   * @param {string} [user.theme='dark'] - UI theme preference
   * @param {string} [user.language='en'] - Language preference
   * @returns {Promise<Object>} Created user
   */
  async createUser(user) {
    const id = user.id || generateId('usr');
    const timestamp = now();

    await this.db.prepare(`
      INSERT INTO users (id, telegram_id, username, first_name, last_name, avatar_url,
                         storage_used, theme, language, chunk_size, auto_retry,
                         notifications, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 52428800, 1, 1, ?, ?, ?)
    `).bind(
      id,
      user.telegram_id,
      user.username || null,
      user.first_name,
      user.last_name || null,
      user.avatar_url || null,
      user.theme || 'dark',
      user.language || 'en',
      timestamp,
      timestamp,
      timestamp
    ).run();

    return this.getUserById(id);
  }

  /**
   * Update user fields.
   *
   * @param {string} id - Internal user ID
   * @param {Object} data - Fields to update
   * @param {string} [data.username] - New username
   * @param {string} [data.first_name] - New first name
   * @param {string} [data.last_name] - New last name
   * @param {string} [data.avatar_url] - New avatar URL
   * @param {string} [data.theme] - Theme preference
   * @param {string} [data.language] - Language preference
   * @param {number} [data.chunk_size] - Upload chunk size
   * @param {number} [data.auto_retry] - Auto retry flag
   * @param {number} [data.notifications] - Notifications flag
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'username', 'first_name', 'last_name', 'avatar_url',
      'theme', 'language', 'chunk_size', 'auto_retry', 'notifications',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      return this.getUserById(id);
    }

    fields.push('updated_at = ?');
    values.push(now());
    values.push(id);

    await this.db.prepare(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return this.getUserById(id);
  }

  /**
   * Add to user's storage usage counter.
   *
   * @param {string} id - Internal user ID
   * @param {number} size - Size in bytes to add
   * @returns {Promise<void>}
   */
  async addStorageUsed(id, size) {
    await this.db.prepare(
      'UPDATE users SET storage_used = storage_used + ?, updated_at = ? WHERE id = ?'
    ).bind(size, now(), id).run();
  }

  /**
   * Subtract from user's storage usage counter.
   *
   * @param {string} id - Internal user ID
   * @param {number} size - Size in bytes to remove
   * @returns {Promise<void>}
   */
  async removeStorageUsed(id, size) {
    await this.db.prepare(`
      UPDATE users SET storage_used = MAX(0, storage_used - ?), updated_at = ? WHERE id = ?
    `).bind(size, now(), id).run();
  }

  /**
   * Update the user's last login timestamp.
   *
   * @param {string} id - Internal user ID
   * @returns {Promise<void>}
   */
  async updateLastLogin(id) {
    await this.db.prepare(
      'UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?'
    ).bind(now(), now(), id).run();
  }

  /**
   * Delete a user and all their data.
   *
   * @param {string} id - Internal user ID
   * @returns {Promise<boolean>} Whether a row was deleted
   */
  async deleteUser(id) {
    const result = await this.db.prepare(
      'DELETE FROM users WHERE id = ?'
    ).bind(id).run();
    return result.success;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Sessions (JWT)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new auth session.
   *
   * @param {Object} session - Session data
   * @param {string} [session.id] - Internal ID (auto-generated)
   * @param {string} session.user_id - User ID
   * @param {string} session.token_hash - Hashed access token
   * @param {string} [session.refresh_token_hash] - Hashed refresh token
   * @param {number} session.expires_at - Token expiry timestamp
   * @param {string} [session.ip_address] - Client IP
   * @param {string} [session.user_agent] - Client user agent
   * @returns {Promise<Object>} Created session
   */
  async createSession(session) {
    const id = session.id || generateId('ses');
    const timestamp = now();

    await this.db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, refresh_token_hash,
                            expires_at, created_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      session.user_id,
      session.token_hash,
      session.refresh_token_hash || null,
      session.expires_at,
      timestamp,
      session.ip_address || null,
      session.user_agent || null
    ).run();

    return this.getSessionById(id);
  }

  /**
   * Get a session by its internal ID.
   *
   * @param {string} id - Session ID
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSessionById(id) {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).bind(id).first();
  }

  /**
   * Get a session by its access token hash.
   *
   * @param {string} tokenHash - SHA-256 hash of the access token
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSessionByToken(tokenHash) {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE token_hash = ?'
    ).bind(tokenHash).first();
  }

  /**
   * Get a session by its refresh token hash.
   *
   * @param {string} refreshTokenHash - SHA-256 hash of the refresh token
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSessionByRefreshToken(refreshTokenHash) {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE refresh_token_hash = ?'
    ).bind(refreshTokenHash).first();
  }

  /**
   * Update the access token hash for a session (token rotation).
   *
   * @param {string} id - Session ID
   * @param {string} newTokenHash - New access token hash
   * @param {number} newExpiresAt - New expiry timestamp
   * @returns {Promise<void>}
   */
  async rotateSessionToken(id, newTokenHash, newExpiresAt) {
    await this.db.prepare(`
      UPDATE sessions SET token_hash = ?, expires_at = ? WHERE id = ?
    `).bind(newTokenHash, newExpiresAt, id).run();
  }

  /**
   * Delete a session.
   *
   * @param {string} id - Session ID
   * @returns {Promise<boolean>} Whether a row was deleted
   */
  async deleteSession(id) {
    const result = await this.db.prepare(
      'DELETE FROM sessions WHERE id = ?'
    ).bind(id).run();
    return result.success;
  }

  /**
   * Delete all sessions for a user (logout all devices).
   *
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of deleted sessions
   */
  async deleteUserSessions(userId) {
    const result = await this.db.prepare(
      'DELETE FROM sessions WHERE user_id = ?'
    ).bind(userId).run();
    return result.meta?.changes || 0;
  }

  /**
   * Delete all expired sessions.
   *
   * @returns {Promise<number>} Number of cleaned up sessions
   */
  async cleanExpiredSessions() {
    const result = await this.db.prepare(
      'DELETE FROM sessions WHERE expires_at < ?'
    ).bind(now()).run();
    return result.meta?.changes || 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Telegram MTProto Sessions (encrypted)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get the encrypted Telegram session for a user.
   *
   * @param {string} userId - Internal user ID
   * @returns {Promise<Object|null>} Session object or null
   */
  async getTelegramSession(userId) {
    return this.db.prepare(
      'SELECT * FROM telegram_sessions WHERE user_id = ? AND is_active = 1'
    ).bind(userId).first();
  }

  /**
   * Store or replace an encrypted Telegram session.
   *
   * @param {string} userId - Internal user ID
   * @param {string} encryptedSession - Base64-encrypted session string
   * @param {string} iv - Base64 IV
   * @param {string} salt - Base64 salt
   * @param {string} [phone] - Phone number associated with the session
   * @returns {Promise<Object>} Stored session
   */
  async storeTelegramSession(userId, encryptedSession, iv, salt, phone) {
    const id = generateId('tgs');
    const timestamp = now();
    const expiresAt = timestamp + 2592000;

    await this.db.prepare(`
      INSERT INTO telegram_sessions (id, user_id, encrypted_session, iv, salt, phone,
                                     is_active, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        encrypted_session = excluded.encrypted_session,
        iv = excluded.iv,
        salt = excluded.salt,
        phone = excluded.phone,
        is_active = 1,
        expires_at = excluded.expires_at
    `).bind(
      id,
      userId,
      encryptedSession,
      iv,
      salt,
      phone || null,
      timestamp,
      expiresAt
    ).run();

    return this.getTelegramSession(userId);
  }

  /**
   * Deactivate a user's Telegram session.
   *
   * @param {string} userId - Internal user ID
   * @returns {Promise<boolean>} Whether a row was updated
   */
  async deleteTelegramSession(userId) {
    const result = await this.db.prepare(
      'UPDATE telegram_sessions SET is_active = 0 WHERE user_id = ?'
    ).bind(userId).run();
    return result.success;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Folders
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get folders with optional pagination, search, sort, and filter.
   *
   * @param {string} userId - User ID
   * @param {Object} [options={}] - Query options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.per_page=50] - Items per page
   * @param {string} [options.sort='created_at'] - Sort field
   * @param {string} [options.order='desc'] - Sort order ('asc'|'desc')
   * @param {string} [options.search] - Search in name
   * @param {string} [options.parent_id] - Filter by parent folder ID
   * @param {boolean} [options.is_favorite] - Filter by favorite status
   * @param {boolean} [options.is_trashed=false] - Filter by trash status
   * @returns {Promise<{results: Array, meta: Object}>} Folders with pagination meta
   */
  async getFolders(userId, options = {}) {
    const { limit, offset, page } = paginate(options.page, options.per_page);
    const isTrashed = options.is_trashed !== undefined ? (options.is_trashed ? 1 : 0) : 0;

    const conditions = ['user_id = ?', 'is_trashed = ?'];
    const params = [userId, isTrashed];

    if (options.search) {
      conditions.push('name LIKE ?');
      params.push(`%${options.search}%`);
    }

    if (options.parent_id !== undefined) {
      if (options.parent_id === null) {
        conditions.push('parent_id IS NULL');
      } else {
        conditions.push('parent_id = ?');
        params.push(options.parent_id);
      }
    }

    if (options.is_favorite !== undefined) {
      conditions.push('is_favorite = ?');
      params.push(options.is_favorite ? 1 : 0);
    }

    const whereClause = conditions.join(' AND ');

    const allowedSorts = ['name', 'created_at', 'updated_at', 'file_count', 'total_size', 'sort_order'];
    const sort = allowedSorts.includes(options.sort) ? options.sort : 'created_at';
    const order = options.order === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM folders WHERE ${whereClause}`
    ).bind(...params).first();

    const total = countResult?.count || 0;

    const results = await this.db.prepare(`
      SELECT * FROM folders WHERE ${whereClause}
      ORDER BY is_favorite DESC, ${sort} ${order}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const meta = this._buildMeta(total, page, limit);

    return { results: results.results || [], meta };
  }

  /**
   * Get a single folder by ID with ownership check.
   *
   * @param {string} id - Folder ID
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<Object|null>} Folder object or null
   */
  async getFolderById(id, userId) {
    return this.db.prepare(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
  }

  /**
   * Create a new folder (maps to a Telegram group).
   *
   * @param {Object} folder - Folder data
   * @param {string} [folder.id] - Internal ID (auto-generated)
   * @param {string} folder.user_id - Owner user ID
   * @param {string} folder.name - Folder name
   * @param {number} [folder.telegram_group_id] - Telegram group chat ID
   * @param {string} [folder.telegram_group_title] - Telegram group title
   * @param {string} [folder.telegram_invite_link] - Group invite link
   * @param {string} [folder.icon='folder'] - Icon identifier
   * @param {string} [folder.color='#4A90D9'] - Hex color
   * @param {string} [folder.parent_id] - Parent folder ID
   * @returns {Promise<Object>} Created folder
   */
  async createFolder(folder) {
    const id = folder.id || generateId('fld');
    const timestamp = now();

    await this.db.prepare(`
      INSERT INTO folders (id, user_id, name, telegram_group_id, telegram_group_title,
                           telegram_invite_link, icon, color, parent_id,
                           is_favorite, is_trashed, file_count, total_size,
                           sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?)
    `).bind(
      id,
      folder.user_id,
      folder.name,
      folder.telegram_group_id || null,
      folder.telegram_group_title || null,
      folder.telegram_invite_link || null,
      folder.icon || 'folder',
      folder.color || '#4A90D9',
      folder.parent_id || null,
      timestamp,
      timestamp
    ).run();

    return this.getFolderById(id, folder.user_id);
  }

  /**
   * Update folder fields.
   *
   * @param {string} id - Folder ID
   * @param {string} userId - User ID for ownership verification
   * @param {Object} data - Fields to update
   * @returns {Promise<Object|null>} Updated folder or null if not found
   */
  async updateFolder(id, userId, data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'name', 'telegram_group_id', 'telegram_group_title',
      'telegram_invite_link', 'icon', 'color', 'parent_id', 'sort_order',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      return this.getFolderById(id, userId);
    }

    fields.push('updated_at = ?');
    values.push(now());
    values.push(id);
    values.push(userId);

    await this.db.prepare(
      `UPDATE folders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();

    return this.getFolderById(id, userId);
  }

  /**
   * Soft-delete a folder (move to trash).
   *
   * @param {string} id - Folder ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the folder was found and updated
   */
  async deleteFolder(id, userId) {
    const result = await this.db.prepare(`
      UPDATE folders SET is_trashed = 1, trashed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now(), now(), id, userId).run();
    return result.success;
  }

  /**
   * Restore a folder from trash.
   *
   * @param {string} id - Folder ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the folder was found and updated
   */
  async restoreFolder(id, userId) {
    const result = await this.db.prepare(`
      UPDATE folders SET is_trashed = 0, trashed_at = NULL, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now(), id, userId).run();
    return result.success;
  }

  /**
   * Toggle the favorite status of a folder.
   *
   * @param {string} id - Folder ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Updated folder or null
   */
  async toggleFolderFavorite(id, userId) {
    await this.db.prepare(`
      UPDATE folders SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END,
                          updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now(), id, userId).run();
    return this.getFolderById(id, userId);
  }

  /**
   * Get all favorite folders for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of favorite folders
   */
  async getFavoriteFolders(userId) {
    const result = await this.db.prepare(`
      SELECT * FROM folders WHERE user_id = ? AND is_favorite = 1 AND is_trashed = 0
      ORDER BY updated_at DESC
    `).bind(userId).all();
    return result.results || [];
  }

  /**
   * Get all trashed folders for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of trashed folders
   */
  async getTrashedFolders(userId) {
    const result = await this.db.prepare(`
      SELECT * FROM folders WHERE user_id = ? AND is_trashed = 1
      ORDER BY trashed_at DESC
    `).bind(userId).all();
    return result.results || [];
  }

  /**
   * Get the total folder count for a user.
   *
   * @param {string} userId - User ID
   * @param {Object} [options={}] - Count options
   * @returns {Promise<number>} Folder count
   */
  async getFolderCount(userId, options = {}) {
    const conditions = ['user_id = ?', 'is_trashed = ?'];
    const params = [userId, options.is_trashed !== undefined ? (options.is_trashed ? 1 : 0) : 0];

    if (options.parent_id !== undefined) {
      conditions.push(options.parent_id === null ? 'parent_id IS NULL' : 'parent_id = ?');
      if (options.parent_id !== null) params.push(options.parent_id);
    }

    const result = await this.db.prepare(
      `SELECT COUNT(*) as count FROM folders WHERE ${conditions.join(' AND ')}`
    ).bind(...params).first();
    return result?.count || 0;
  }

  /**
   * Permanently delete a folder and its children from the database.
   *
   * @param {string} id - Folder ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the folder was deleted
   */
  async hardDeleteFolder(id, userId) {
    const result = await this.db.prepare(
      'DELETE FROM folders WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();
    return result.success;
  }

  /**
   * Empty the trash for a user (permanently delete all trashed folders and files).
   *
   * @param {string} userId - User ID
   * @returns {Promise<{folders: number, files: number}>} Counts of deleted items
   */
  async emptyTrash(userId) {
    const folderResult = await this.db.prepare(
      'DELETE FROM folders WHERE user_id = ? AND is_trashed = 1'
    ).bind(userId).run();

    const fileResult = await this.db.prepare(
      'DELETE FROM files WHERE user_id = ? AND is_trashed = 1'
    ).bind(userId).run();

    return {
      folders: folderResult.meta?.changes || 0,
      files: fileResult.meta?.changes || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Files
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get files in a folder with pagination, search, sort, and filter.
   *
   * @param {string} folderId - Folder ID
   * @param {string} userId - User ID
   * @param {Object} [options={}] - Query options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.per_page=50] - Items per page
   * @param {string} [options.sort='created_at'] - Sort field
   * @param {string} [options.order='desc'] - Sort order
   * @param {string} [options.search] - Search in name
   * @param {string} [options.type] - Filter by MIME category (image, video, audio, document, archive, code)
   * @param {string} [options.extension] - Filter by file extension
   * @param {boolean} [options.is_favorite] - Filter by favorite status
   * @param {boolean} [options.is_trashed=false] - Filter by trash status
   * @returns {Promise<{results: Array, meta: Object}>} Files with pagination meta
   */
  async getFiles(folderId, userId, options = {}) {
    const { limit, offset, page } = paginate(options.page, options.per_page);
    const isTrashed = options.is_trashed !== undefined ? (options.is_trashed ? 1 : 0) : 0;

    const conditions = ['folder_id = ?', 'user_id = ?', 'is_trashed = ?'];
    const params = [folderId, userId, isTrashed];

    if (options.search) {
      conditions.push('(name LIKE ? OR original_name LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.extension) {
      conditions.push('extension = ?');
      params.push(options.extension.toLowerCase());
    }

    if (options.is_favorite !== undefined) {
      conditions.push('is_favorite = ?');
      params.push(options.is_favorite ? 1 : 0);
    }

    const whereClause = conditions.join(' AND ');

    const allowedSorts = ['name', 'size', 'created_at', 'updated_at', 'extension'];
    const sort = allowedSorts.includes(options.sort) ? options.sort : 'created_at';
    const order = options.order === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM files WHERE ${whereClause}`
    ).bind(...params).first();

    const total = countResult?.count || 0;

    const results = await this.db.prepare(`
      SELECT * FROM files WHERE ${whereClause}
      ORDER BY is_favorite DESC, ${sort} ${order}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const meta = this._buildMeta(total, page, limit);

    return { results: results.results || [], meta };
  }

  /**
   * Get a single file by ID with ownership check.
   *
   * @param {string} id - File ID
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<Object|null>} File object or null
   */
  async getFileById(id, userId) {
    return this.db.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
  }

  /**
   * Create a new file record.
   *
   * @param {Object} file - File data
   * @param {string} [file.id] - Internal ID (auto-generated)
   * @param {string} file.user_id - Owner user ID
   * @param {string} file.folder_id - Parent folder ID
   * @param {string} file.name - File name (may be truncated)
   * @param {string} file.original_name - Original uploaded name
   * @param {string} file.extension - File extension
   * @param {string} file.mime_type - MIME type
   * @param {number} file.size - File size in bytes
   * @param {number} [file.telegram_message_id] - Telegram message ID
   * @param {string} [file.telegram_file_id] - Telegram file_id
   * @param {string} [file.telegram_file_unique_id] - Telegram unique file ID
   * @param {number} [file.is_chunked=0] - Whether file was split into chunks
   * @param {number} [file.chunk_count=0] - Number of chunks
   * @param {string} [file.chunk_message_ids] - JSON array of chunk message IDs
   * @param {number} [file.width] - Image/video width
   * @param {number} [file.height] - Image/video height
   * @param {number} [file.duration] - Audio/video duration
   * @param {string} [file.thumbnail_file_id] - Thumbnail file_id
   * @returns {Promise<Object>} Created file
   */
  async createFile(file) {
    const id = file.id || generateId('fil');
    const timestamp = now();

    await this.db.prepare(`
      INSERT INTO files (id, user_id, folder_id, name, original_name, extension,
                         mime_type, size, telegram_message_id, telegram_file_id,
                         telegram_file_unique_id, is_chunked, chunk_count,
                         chunk_message_ids, width, height, duration,
                         thumbnail_file_id, is_favorite, is_trashed,
                         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).bind(
      id,
      file.user_id,
      file.folder_id,
      file.name,
      file.original_name,
      file.extension,
      file.mime_type,
      file.size,
      file.telegram_message_id || null,
      file.telegram_file_id || null,
      file.telegram_file_unique_id || null,
      file.is_chunked || 0,
      file.chunk_count || 0,
      file.chunk_message_ids || null,
      file.width || null,
      file.height || null,
      file.duration || null,
      file.thumbnail_file_id || null,
      timestamp,
      timestamp
    ).run();

    await this._updateFolderStats(file.folder_id);

    return this.getFileById(id, file.user_id);
  }

  /**
   * Update file fields.
   *
   * @param {string} id - File ID
   * @param {string} userId - User ID for ownership verification
   * @param {Object} data - Fields to update
   * @returns {Promise<Object|null>} Updated file or null
   */
  async updateFile(id, userId, data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'name', 'original_name', 'folder_id', 'mime_type', 'size',
      'telegram_message_id', 'telegram_file_id', 'telegram_file_unique_id',
      'is_chunked', 'chunk_count', 'chunk_message_ids',
      'width', 'height', 'duration', 'thumbnail_file_id',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      return this.getFileById(id, userId);
    }

    fields.push('updated_at = ?');
    values.push(now());
    values.push(id);
    values.push(userId);

    await this.db.prepare(
      `UPDATE files SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();

    return this.getFileById(id, userId);
  }

  /**
   * Soft-delete a file (move to trash).
   *
   * @param {string} id - File ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the file was found and updated
   */
  async deleteFile(id, userId) {
    const file = await this.getFileById(id, userId);
    if (!file) return false;

    await this.db.prepare(`
      UPDATE files SET is_trashed = 1, trashed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now(), now(), id, userId).run();

    await this._updateFolderStats(file.folder_id);
    return true;
  }

  /**
   * Restore a file from trash.
   *
   * @param {string} id - File ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the file was found and updated
   */
  async restoreFile(id, userId) {
    const file = await this.db.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ? AND is_trashed = 1'
    ).bind(id, userId).first();

    if (!file) return false;

    await this.db.prepare(`
      UPDATE files SET is_trashed = 0, trashed_at = NULL, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now(), id, userId).run();

    await this._updateFolderStats(file.folder_id);
    return true;
  }

  /**
   * Toggle the favorite status of a file.
   *
   * @param {string} id - File ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Updated file or null
   */
  async toggleFileFavorite(id, userId) {
    await this.db.prepare(`
      UPDATE files SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END,
                        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now(), id, userId).run();
    return this.getFileById(id, userId);
  }

  /**
   * Get all favorite files for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of favorite files
   */
  async getFavoriteFiles(userId) {
    const result = await this.db.prepare(`
      SELECT f.*, folders.name as folder_name
      FROM files f
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = ? AND f.is_favorite = 1 AND f.is_trashed = 0
      ORDER BY f.updated_at DESC
    `).bind(userId).all();
    return result.results || [];
  }

  /**
   * Get all trashed files for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of trashed files
   */
  async getTrashedFiles(userId) {
    const result = await this.db.prepare(`
      SELECT f.*, folders.name as folder_name
      FROM files f
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = ? AND f.is_trashed = 1
      ORDER BY f.trashed_at DESC
    `).bind(userId).all();
    return result.results || [];
  }

  /**
   * Move a file to a different folder.
   *
   * @param {string} id - File ID
   * @param {string} userId - User ID
   * @param {string} newFolderId - Destination folder ID
   * @returns {Promise<Object|null>} Updated file or null
   */
  async moveFile(id, userId, newFolderId) {
    const file = await this.getFileById(id, userId);
    if (!file) return null;

    const oldFolderId = file.folder_id;

    await this.db.prepare(
      'UPDATE files SET folder_id = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).bind(newFolderId, now(), id, userId).run();

    await this._updateFolderStats(oldFolderId);
    await this._updateFolderStats(newFolderId);

    return this.getFileById(id, userId);
  }

  /**
   * Copy a file to a new location (duplicate record).
   *
   * @param {string} id - Source file ID
   * @param {string} userId - User ID
   * @param {string} newFolderId - Destination folder ID
   * @returns {Promise<Object|null>} Newly created copy or null
   */
  async copyFile(id, userId, newFolderId) {
    const source = await this.getFileById(id, userId);
    if (!source) return null;

    return this.createFile({
      user_id: userId,
      folder_id: newFolderId,
      name: source.name,
      original_name: source.original_name,
      extension: source.extension,
      mime_type: source.mime_type,
      size: source.size,
      telegram_message_id: source.telegram_message_id,
      telegram_file_id: source.telegram_file_id,
      telegram_file_unique_id: source.telegram_file_unique_id,
      is_chunked: source.is_chunked,
      chunk_count: source.chunk_count,
      chunk_message_ids: source.chunk_message_ids,
      width: source.width,
      height: source.height,
      duration: source.duration,
      thumbnail_file_id: source.thumbnail_file_id,
    });
  }

  /**
   * Get file count in a folder.
   *
   * @param {string} folderId - Folder ID
   * @param {string} userId - User ID
   * @param {Object} [options={}] - Count options
   * @returns {Promise<number>} File count
   */
  async getFileCount(folderId, userId, options = {}) {
    const conditions = ['folder_id = ?', 'user_id = ?', 'is_trashed = ?'];
    const params = [folderId, userId, options.is_trashed !== undefined ? (options.is_trashed ? 1 : 0) : 0];

    const result = await this.db.prepare(
      `SELECT COUNT(*) as count FROM files WHERE ${conditions.join(' AND ')}`
    ).bind(...params).first();
    return result?.count || 0;
  }

  /**
   * Get total file size in a folder.
   *
   * @param {string} folderId - Folder ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total size in bytes
   */
  async getTotalFileSize(folderId, userId) {
    const result = await this.db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total FROM files
      WHERE folder_id = ? AND user_id = ? AND is_trashed = 0
    `).bind(folderId, userId).first();
    return result?.total || 0;
  }

  /**
   * Get total storage used by a user across all folders.
   *
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total storage in bytes
   */
  async getUserStorageUsed(userId) {
    const result = await this.db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total FROM files
      WHERE user_id = ? AND is_trashed = 0
    `).bind(userId).first();
    return result?.total || 0;
  }

  /**
   * Get total file count for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total file count
   */
  async getTotalFileCount(userId) {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM files WHERE user_id = ? AND is_trashed = 0
    `).bind(userId).first();
    return result?.count || 0;
  }

  /**
   * Hard-delete a file record permanently.
   *
   * @param {string} id - File ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the file was deleted
   */
  async hardDeleteFile(id, userId) {
    const file = await this.getFileById(id, userId);
    if (!file) return false;

    await this.db.prepare(
      'DELETE FROM files WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();

    await this._updateFolderStats(file.folder_id);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Activities
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create an activity log entry.
   *
   * @param {Object} activity - Activity data
   * @param {string} [activity.id] - Internal ID (auto-generated)
   * @param {string} activity.user_id - User ID
   * @param {string} activity.type - Activity type (upload, download, delete, etc.)
   * @param {string} [activity.target_type] - Target type (file, folder)
   * @param {string} [activity.target_id] - Target entity ID
   * @param {Object|string} [activity.metadata] - Additional JSON metadata
   * @returns {Promise<Object>} Created activity
   */
  async createActivity(activity) {
    const id = activity.id || generateId('act');
    const timestamp = now();
    const metadata = activity.metadata
      ? (typeof activity.metadata === 'string' ? activity.metadata : JSON.stringify(activity.metadata))
      : null;

    await this.db.prepare(`
      INSERT INTO activities (id, user_id, type, target_type, target_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      activity.user_id,
      activity.type,
      activity.target_type || null,
      activity.target_id || null,
      metadata,
      timestamp
    ).run();

    return this.db.prepare('SELECT * FROM activities WHERE id = ?').bind(id).first();
  }

  /**
   * Get recent activities for a user.
   *
   * @param {string} userId - User ID
   * @param {number} [limit=20] - Max number of activities to return
   * @param {number} [offset=0] - Offset for pagination
   * @returns {Promise<Array>} List of activities
   */
  async getActivities(userId, limit = 20, offset = 0) {
    const result = await this.db.prepare(`
      SELECT * FROM activities WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    return result.results || [];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Upload Queue
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new upload queue entry.
   *
   * @param {Object} upload - Upload data
   * @param {string} [upload.id] - Internal ID (auto-generated)
   * @param {string} upload.user_id - User ID
   * @param {string} upload.folder_id - Destination folder ID
   * @param {string} upload.file_name - File name
   * @param {number} upload.file_size - File size in bytes
   * @param {string} upload.mime_type - MIME type
   * @param {number} upload.total_chunks - Total number of chunks
   * @param {number} upload.chunk_size - Size of each chunk
   * @param {number} [upload.uploaded_chunks=0] - Chunks uploaded so far
   * @param {number} [upload.bytes_uploaded=0] - Bytes uploaded so far
   * @param {string} [upload.status='pending'] - Upload status
   * @returns {Promise<Object>} Created upload entry
   */
  async createUpload(upload) {
    const id = upload.id || generateId('upl');
    const timestamp = now();

    await this.db.prepare(`
      INSERT INTO upload_queue (id, user_id, folder_id, file_name, file_size,
                                mime_type, total_chunks, uploaded_chunks, chunk_size,
                                status, bytes_uploaded, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      upload.user_id,
      upload.folder_id,
      upload.file_name,
      upload.file_size,
      upload.mime_type,
      upload.total_chunks,
      upload.uploaded_chunks || 0,
      upload.chunk_size,
      upload.status || 'pending',
      upload.bytes_uploaded || 0,
      timestamp
    ).run();

    return this.getUpload(id, upload.user_id);
  }

  /**
   * Get an upload queue entry.
   *
   * @param {string} id - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Upload entry or null
   */
  async getUpload(id, userId) {
    return this.db.prepare(
      'SELECT * FROM upload_queue WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
  }

  /**
   * Update an upload queue entry.
   *
   * @param {string} id - Upload ID
   * @param {Object} data - Fields to update
   * @returns {Promise<void>}
   */
  async updateUpload(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'uploaded_chunks', 'bytes_uploaded', 'status', 'error_message',
      'speed_bps', 'started_at', 'completed_at',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) return;

    values.push(id);

    await this.db.prepare(
      `UPDATE upload_queue SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
  }

  /**
   * Delete an upload queue entry.
   *
   * @param {string} id - Upload ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the entry was deleted
   */
  async deleteUpload(id, userId) {
    const result = await this.db.prepare(
      'DELETE FROM upload_queue WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();
    return result.success;
  }

  /**
   * Get all active (non-completed) uploads for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of active uploads
   */
  async getUserUploads(userId) {
    const result = await this.db.prepare(`
      SELECT * FROM upload_queue
      WHERE user_id = ? AND status NOT IN ('completed', 'cancelled')
      ORDER BY created_at DESC
    `).bind(userId).all();
    return result.results || [];
  }

  /**
   * Get uploads that have expired (stuck in 'uploading' for over an hour).
   *
   * @returns {Promise<Array>} List of expired uploads
   */
  async getExpiredUploads() {
    const oneHourAgo = now() - 3600;
    const result = await this.db.prepare(`
      SELECT * FROM upload_queue
      WHERE status = 'uploading' AND started_at < ?
      ORDER BY started_at ASC
    `).bind(oneHourAgo).all();
    return result.results || [];
  }

  /**
   * Clean up old uploads (delete completed/failed entries older than 24h).
   *
   * @returns {Promise<number>} Number of cleaned up entries
   */
  async cleanOldUploads() {
    const oneDayAgo = now() - 86400;
    const result = await this.db.prepare(`
      DELETE FROM upload_queue
      WHERE (status = 'completed' OR status = 'failed' OR status = 'cancelled')
      AND created_at < ?
    `).bind(oneDayAgo).run();
    return result.meta?.changes || 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Shares
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a share link for a file.
   *
   * @param {Object} share - Share data
   * @param {string} [share.id] - Internal ID (auto-generated)
   * @param {string} share.user_id - Owner user ID
   * @param {string} share.file_id - Shared file ID
   * @param {string} share.share_token - Unique share token
   * @param {number} [share.expires_at] - Expiry timestamp
   * @returns {Promise<Object>} Created share
   */
  async createShare(share) {
    const id = share.id || generateId('shr');
    const timestamp = now();

    await this.db.prepare(`
      INSERT INTO shares (id, user_id, file_id, share_token, expires_at, downloads, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).bind(
      id,
      share.user_id,
      share.file_id,
      share.share_token,
      share.expires_at || null,
      timestamp
    ).run();

    return this.db.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first();
  }

  /**
   * Get a share by its token.
   *
   * @param {string} token - Share token
   * @returns {Promise<Object|null>} Share object or null
   */
  async getShareByToken(token) {
    return this.db.prepare(
      'SELECT * FROM shares WHERE share_token = ?'
    ).bind(token).first();
  }

  /**
   * Get all shares for a file.
   *
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of shares
   */
  async getSharesForFile(fileId, userId) {
    const result = await this.db.prepare(`
      SELECT * FROM shares WHERE file_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `).bind(fileId, userId).all();
    return result.results || [];
  }

  /**
   * Delete a share link.
   *
   * @param {string} id - Share ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the share was deleted
   */
  async deleteShare(id, userId) {
    const result = await this.db.prepare(
      'DELETE FROM shares WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();
    return result.success;
  }

  /**
   * Increment the download counter for a share.
   *
   * @param {string} id - Share ID
   * @returns {Promise<void>}
   */
  async incrementShareDownloads(id) {
    await this.db.prepare(
      'UPDATE shares SET downloads = downloads + 1 WHERE id = ?'
    ).bind(id).run();
  }

  /**
   * Delete expired shares.
   *
   * @returns {Promise<number>} Number of deleted shares
   */
  async cleanExpiredShares() {
    const result = await this.db.prepare(
      'DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < ?'
    ).bind(now()).run();
    return result.meta?.changes || 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Stats
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get aggregate dashboard stats for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Stats object
   */
  async getStats(userId) {
    const [fileStats, folderStats, totalSize, recentActivity] = await Promise.all([
      this.db.prepare(`
        SELECT
          COUNT(*) as total_files,
          SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorite_files,
          SUM(CASE WHEN is_trashed = 1 THEN 1 ELSE 0 END) as trashed_files
        FROM files WHERE user_id = ?
      `).bind(userId).first(),

      this.db.prepare(`
        SELECT
          COUNT(*) as total_folders,
          SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorite_folders,
          SUM(CASE WHEN is_trashed = 1 THEN 1 ELSE 0 END) as trashed_folders
        FROM folders WHERE user_id = ?
      `).bind(userId).first(),

      this.db.prepare(`
        SELECT COALESCE(SUM(size), 0) as total_size
        FROM files WHERE user_id = ? AND is_trashed = 0
      `).bind(userId).first(),

      this.getActivities(userId, 5),
    ]);

    const user = await this.db.prepare(
      'SELECT storage_used FROM users WHERE id = ?'
    ).bind(userId).first();

    return {
      files: {
        total: fileStats?.total_files || 0,
        favorites: fileStats?.favorite_files || 0,
        trashed: fileStats?.trashed_files || 0,
      },
      folders: {
        total: folderStats?.total_folders || 0,
        favorites: folderStats?.favorite_folders || 0,
        trashed: folderStats?.trashed_folders || 0,
      },
      storage: {
        used: totalSize?.total_size || 0,
        limit: user?.storage_used || 0,
      },
      recentActivity,
    };
  }

  /**
   * Get the largest files for a user.
   *
   * @param {string} userId - User ID
   * @param {number} [limit=10] - Number of files to return
   * @returns {Promise<Array>} List of largest files
   */
  async getLargestFiles(userId, limit = 10) {
    const result = await this.db.prepare(`
      SELECT f.*, folders.name as folder_name
      FROM files f
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = ? AND f.is_trashed = 0
      ORDER BY f.size DESC LIMIT ?
    `).bind(userId, limit).all();
    return result.results || [];
  }

  /**
   * Get the most recently created files.
   *
   * @param {string} userId - User ID
   * @param {number} [limit=10] - Number of files to return
   * @returns {Promise<Array>} List of recent files
   */
  async getRecentFiles(userId, limit = 10) {
    const result = await this.db.prepare(`
      SELECT f.*, folders.name as folder_name
      FROM files f
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = ? AND f.is_trashed = 0
      ORDER BY f.created_at DESC LIMIT ?
    `).bind(userId, limit).all();
    return result.results || [];
  }

  /**
   * Get recently updated files.
   *
   * @param {string} userId - User ID
   * @param {number} [limit=10] - Number of files
   * @returns {Promise<Array>} List of recently updated files
   */
  async getRecentUpdatedFiles(userId, limit = 10) {
    const result = await this.db.prepare(`
      SELECT f.*, folders.name as folder_name
      FROM files f
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = ? AND f.is_trashed = 0
      ORDER BY f.updated_at DESC LIMIT ?
    `).bind(userId, limit).all();
    return result.results || [];
  }

  /**
   * Get files by MIME type category.
   *
   * @param {string} userId - User ID
   * @param {string} mimeType - MIME type to filter by
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array>} Matching files
   */
  async getFilesByMimeType(userId, mimeType, options = {}) {
    const { limit, offset } = paginate(options.page, options.per_page);
    const result = await this.db.prepare(`
      SELECT f.*, folders.name as folder_name
      FROM files f
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = ? AND f.mime_type = ? AND f.is_trashed = 0
      ORDER BY f.created_at DESC LIMIT ? OFFSET ?
    `).bind(userId, mimeType, limit, offset).all();
    return result.results || [];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KV Operations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get a value from KV by key.
   *
   * @param {string} key - KV key
   * @returns {Promise<any>} Parsed JSON value or null
   */
  async kvGet(key) {
    return this.kv.get(key, 'json');
  }

  /**
   * Set a value in KV with optional TTL.
   *
   * @param {string} key - KV key
   * @param {any} value - Value to store (serialized to JSON)
   * @param {number} [ttl] - Time-to-live in seconds
   * @returns {Promise<void>}
   */
  async kvSet(key, value, ttl) {
    const options = {};
    if (ttl) {
      options.expirationTtl = ttl;
    }
    return this.kv.put(key, JSON.stringify(value), options);
  }

  /**
   * Delete a key from KV.
   *
   * @param {string} key - KV key
   * @returns {Promise<void>}
   */
  async kvDelete(key) {
    return this.kv.delete(key);
  }

  /**
   * List keys with a given prefix.
   *
   * @param {string} prefix - Key prefix to filter by
   * @param {Object} [options={}] - List options
   * @param {number} [options.limit=100] - Max results
   * @param {string} [options.cursor] - Pagination cursor
   * @returns {Promise<{keys: Array, cursor: string|null, listComplete: boolean}>}
   */
  async kvList(prefix, options = {}) {
    const params = { prefix };

    if (options.limit) params.limit = options.limit;
    if (options.cursor) params.cursor = options.cursor;

    return this.kv.list(params);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Internal Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Update folder file_count and total_size.
   *
   * @param {string} folderId - Folder ID
   * @returns {Promise<void>}
   */
  async _updateFolderStats(folderId) {
    const [countResult, sizeResult] = await Promise.all([
      this.db.prepare(`
        SELECT COUNT(*) as count FROM files WHERE folder_id = ? AND is_trashed = 0
      `).bind(folderId).first(),

      this.db.prepare(`
        SELECT COALESCE(SUM(size), 0) as total FROM files WHERE folder_id = ? AND is_trashed = 0
      `).bind(folderId).first(),
    ]);

    await this.db.prepare(`
      UPDATE folders SET file_count = ?, total_size = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      countResult?.count || 0,
      sizeResult?.total || 0,
      now(),
      folderId
    ).run();
  }

  /**
   * Build pagination metadata.
   *
   * @param {number} total - Total matching records
   * @param {number} page - Current page
   * @param {number} perPage - Items per page
   * @returns {Object} Pagination meta object
   */
  _buildMeta(total, page, perPage) {
    const totalPages = Math.ceil(total / perPage) || 1;
    return {
      total,
      page,
      perPage,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}

/**
 * Create a StorageService instance.
 *
 * @param {Object} env - Cloudflare Workers env bindings
 * @returns {StorageService} Configured storage service instance
 */
export function createStorage(env) {
  return new StorageService(env);
}

export { StorageService };
