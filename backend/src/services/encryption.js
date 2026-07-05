/**
 * Encryption service for protecting sensitive data at rest.
 * Uses AES-256-GCM with PBKDF2 key derivation.
 * Master key is stored in Cloudflare Secrets (ENCRYPTION_MASTER_KEY).
 *
 * @module services/encryption
 */

class EncryptionError extends Error {
  constructor(message, code = 'ENCRYPTION_ERROR') {
    super(message);
    this.name = 'EncryptionError';
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

class EncryptionService {
  /**
   * @param {Object} env - Cloudflare Workers env bindings
   * @param {string} env.ENCRYPTION_MASTER_KEY - Base64-encoded 32-byte master key
   * @param {string} [env.ENCRYPTION_ITERATIONS='100000'] - PBKDF2 iteration count
   */
  constructor(env) {
    this.masterKeyBase64 = env.ENCRYPTION_MASTER_KEY;
    this.iterations = parseInt(env.ENCRYPTION_ITERATIONS || '100000', 10);

    if (!this.masterKeyBase64) {
      throw new EncryptionError('ENCRYPTION_MASTER_KEY is not configured', 'MISSING_KEY');
    }

    if (this.iterations < 10000) {
      throw new EncryptionError('PBKDF2 iterations must be at least 10000', 'INVALID_ITERATIONS');
    }
  }

  /**
   * Decode a base64 string to a Uint8Array.
   *
   * @param {string} base64 - Base64-encoded string
   * @returns {Uint8Array} Decoded bytes
   */
  _base64ToBytes(base64) {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Encode a Uint8Array to a base64 string.
   *
   * @param {Uint8Array} bytes - Bytes to encode
   * @returns {string} Base64-encoded string
   */
  _bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Import the master key from base64 and derive a PBKDF2 key.
   *
   * @param {Uint8Array} salt - Cryptographic salt (16 bytes)
   * @returns {Promise<CryptoKey>} Derived AES-256-GCM key
   */
  async _getKey(salt) {
    const masterKeyBytes = this._base64ToBytes(this.masterKeyBase64);

    if (masterKeyBytes.length !== 32) {
      throw new EncryptionError(
        `Master key must be 32 bytes (got ${masterKeyBytes.length})`,
        'INVALID_KEY_LENGTH'
      );
    }

    const pbkdf2Key = await crypto.subtle.importKey(
      'raw',
      masterKeyBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.iterations,
        hash: 'SHA-256',
      },
      pbkdf2Key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt plaintext using AES-256-GCM with PBKDF2-derived key.
   *
   * @param {string} plaintext - UTF-8 string to encrypt
   * @returns {Promise<{encrypted: string, iv: string, salt: string}>}
   *   Base64-encoded ciphertext components
   * @throws {EncryptionError} On encryption failure
   */
  async encrypt(plaintext) {
    if (!plaintext) {
      throw new EncryptionError('Plaintext cannot be empty', 'EMPTY_PLAINTEXT');
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const key = await this._getKey(salt);

      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          tagLength: 128,
        },
        key,
        data
      );

      const encrypted = new Uint8Array(encryptedBuffer);

      return {
        encrypted: this._bytesToBase64(encrypted),
        iv: this._bytesToBase64(iv),
        salt: this._bytesToBase64(salt),
      };
    } catch (err) {
      if (err instanceof EncryptionError) throw err;
      throw new EncryptionError(`Encryption failed: ${err.message}`, 'ENCRYPT_FAILED');
    }
  }

  /**
   * Decrypt ciphertext that was encrypted with encrypt().
   *
   * @param {string} encryptedBase64 - Base64-encoded ciphertext (includes GCM tag)
   * @param {string} ivBase64 - Base64-encoded initialization vector (12 bytes)
   * @param {string} saltBase64 - Base64-encoded PBKDF2 salt (16 bytes)
   * @returns {Promise<string>} Decrypted UTF-8 plaintext
   * @throws {EncryptionError} On decryption failure (wrong key, corrupted data, etc.)
   */
  async decrypt(encryptedBase64, ivBase64, saltBase64) {
    if (!encryptedBase64 || !ivBase64 || !saltBase64) {
      throw new EncryptionError(
        'encrypted, iv, and salt are all required',
        'MISSING_PARAMS'
      );
    }

    try {
      const encrypted = this._base64ToBytes(encryptedBase64);
      const iv = this._base64ToBytes(ivBase64);
      const salt = this._base64ToBytes(saltBase64);

      if (iv.length !== 12) {
        throw new EncryptionError(
          `IV must be 12 bytes (got ${iv.length})`,
          'INVALID_IV_LENGTH'
        );
      }

      if (salt.length !== 16) {
        throw new EncryptionError(
          `Salt must be 16 bytes (got ${salt.length})`,
          'INVALID_SALT_LENGTH'
        );
      }

      const key = await this._getKey(salt);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
          tagLength: 128,
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      if (err instanceof EncryptionError) throw err;
      if (err.name === 'OperationError') {
        throw new EncryptionError(
          'Decryption failed: invalid key, corrupted data, or wrong parameters',
          'DECRYPT_FAILED'
        );
      }
      throw new EncryptionError(`Decryption failed: ${err.message}`, 'DECRYPT_FAILED');
    }
  }

  /**
   * Compute SHA-256 hash of a string.
   *
   * @param {string} data - UTF-8 string to hash
   * @returns {Promise<string>} Hex-encoded SHA-256 digest
   */
  async hash(data) {
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Compute HMAC-SHA256 of a message with a given key.
   *
   * @param {string} key - HMAC key
   * @param {string} message - Message to authenticate
   * @returns {Promise<string>} Hex-encoded HMAC-SHA256
   */
  async hmac(key, message) {
    const encoder = new TextEncoder();

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(message)
    );

    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate a cryptographically secure random token.
   *
   * @param {number} [byteLength=32] - Number of random bytes
   * @returns {string} Hex-encoded random string
   */
  generateRandomHex(byteLength = 32) {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate a cryptographically secure random string from a character set.
   *
   * @param {number} [length=32] - Length of the output string
   * @param {string} [chars='A-Za-z0-9_-'] - Character set
   * @returns {string} Random string
   */
  generateRandomString(length = 32, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-') {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   *
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} Whether the strings are equal
   */
  secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;

    const encoder = new TextEncoder();
    const aBytes = encoder.encode(a);
    const bBytes = encoder.encode(b);

    let result = 0;
    for (let i = 0; i < aBytes.length; i++) {
      result |= aBytes[i] ^ bBytes[i];
    }
    return result === 0;
  }
}

/**
 * Create an EncryptionService instance.
 *
 * @param {Object} env - Cloudflare Workers env bindings
 * @returns {EncryptionService} Configured encryption service instance
 */
export function createEncryption(env) {
  return new EncryptionService(env);
}

export { EncryptionService, EncryptionError };
