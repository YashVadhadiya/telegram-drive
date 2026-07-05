/**
 * @file In-memory cache service with TTL and optional localStorage persistence.
 */

import { CONFIG } from '../constants/config.js';

/**
 * @template T
 * @typedef {Object} CacheEntry
 * @property {T} value
 * @property {number} expiry
 */

class CacheService {
  /**
   * @param {number} [ttl=CONFIG.CACHE_TTL] - Default TTL in milliseconds
   */
  constructor(ttl = CONFIG.CACHE_TTL) {
    /** @type {Map<string, CacheEntry<unknown>>} */
    this.cache = new Map();
    /** @type {number} */
    this.ttl = ttl;
  }

  /**
   * Get a cached value. Returns `null` if the key does not exist or has expired.
   * Expired entries are purged on access.
   * @template T
   * @param {string} key
   * @returns {T|null}
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return /** @type {T} */ (entry.value);
  }

  /**
   * Store a value in the cache with an optional TTL.
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttl] - Milliseconds until expiry; defaults to instance TTL
   */
  set(key, value, ttl) {
    const expiry = Date.now() + (ttl ?? this.ttl);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Check whether a key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a single key from the cache.
   * @param {string} key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all entries from the in-memory cache.
   * Does **not** touch localStorage.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Remove all cache entries whose key matches the given pattern.
   * @param {string|RegExp} pattern - A regex string or RegExp object
   */
  clearPattern(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) this.cache.delete(key);
    }
  }

  /**
   * Store a value both in memory and in localStorage for persistence.
   * Uses the localStorage key `cache_<key>`.
   * Silently catches quota errors.
   * @param {string} key
   * @param {unknown} value
   */
  persist(key, value) {
    this.set(key, value);
    try {
      const payload = JSON.stringify({ value, expiry: Date.now() + this.ttl });
      localStorage.setItem(`cache_${key}`, payload);
    } catch {
      /* localStorage full or unavailable — in-memory copy is enough */
    }
  }

  /**
   * Restore a previously persisted value from localStorage into the in-memory cache.
   * Silently returns `null` if the key does not exist, is corrupted, or expired.
   * @template T
   * @param {string} key
   * @returns {T|null}
   */
  restore(key) {
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (!stored) return null;

      /** @type {{ value: unknown, expiry: number }} */
      const parsed = JSON.parse(stored);

      if (Date.now() <= parsed.expiry) {
        this.cache.set(key, { value: parsed.value, expiry: parsed.expiry });
        return /** @type {T} */ (parsed.value);
      }

      localStorage.removeItem(`cache_${key}`);
    } catch {
      /* corrupt data — treat as miss */
    }
    return null;
  }
}

/** @type {CacheService} */
export const cache = new CacheService();
