/**
 * @file General helper utilities.
 */

/**
 * Generate a unique identifier (crypto-random hex).
 * @returns {string}
 */
export function generateId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate chunk information for a file of a given size.
 * @param {number} size  Total file size in bytes
 * @param {number} chunkSize  Chunk size in bytes
 * @returns {{ totalChunks: number, lastChunkSize: number }}
 */
export function bytesToChunks(size, chunkSize) {
  if (size <= 0 || chunkSize <= 0) return { totalChunks: 0, lastChunkSize: 0 };
  const totalChunks = Math.ceil(size / chunkSize);
  const lastChunkSize = size % chunkSize || chunkSize;
  return { totalChunks, lastChunkSize };
}

/**
 * Extract the lowercased extension from a filename.
 * @param {string} filename
 * @returns {string}
 */
export function getFileExtension(filename) {
  if (typeof filename !== 'string') return '';
  const i = filename.lastIndexOf('.');
  return i > 0 ? filename.slice(i + 1).toLowerCase() : '';
}

/**
 * Group an array of objects by a key.
 * @template T
 * @param {T[]} array
 * @param {keyof T | ((item: T) => string)} key
 * @returns {Record<string, T[]>}
 */
export function groupBy(array, key) {
  /** @type {Record<string, T[]>} */
  const groups = {};
  for (const item of array) {
    const k = typeof key === 'function' ? key(item) : String(item[key]);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

/**
 * Sort an array of objects by a key.
 * @template T
 * @param {T[]} array
 * @param {keyof T | ((item: T) => number | string)} key
 * @param {'asc'|'desc'} [order='asc']
 * @returns {T[]}
 */
export function sortBy(array, key, order = 'asc') {
  const sorted = [...array];
  const desc = order === 'desc';
  sorted.sort((a, b) => {
    const va = typeof key === 'function' ? key(a) : a[key];
    const vb = typeof key === 'function' ? key(b) : b[key];
    if (va == null) return desc ? 1 : -1;
    if (vb == null) return desc ? -1 : 1;
    if (typeof va === 'string' && typeof vb === 'string') {
      return desc ? vb.localeCompare(va) : va.localeCompare(vb);
    }
    return desc ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
  });
  return sorted;
}

/**
 * Deep-clone a value (structured clone).
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  return structuredClone(value);
}

/**
 * Deep-merge two objects. The source overwrites properties on the target.
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 * @returns {Record<string, unknown>}
 */
export function mergeDeep(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = result[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
        tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = mergeDeep(/** @type {Record<string, unknown>} */ (tv), /** @type {Record<string, unknown>} */ (sv));
    } else {
      result[key] = sv;
    }
  }
  return result;
}

/**
 * Promise-based delay.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [attempts=3]
 * @param {number} [delay=1000]
 * @returns {Promise<T>}
 */
export async function retry(fn, attempts = 3, delay = 1000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await sleep(delay * 2 ** i);
      }
    }
  }
  throw lastErr;
}

/**
 * Run async tasks in parallel with a concurrency limit.
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} limit
 * @returns {Promise<T[]>}
 */
export async function parallelWithLimit(tasks, limit) {
  const results = /** @type {T[]} */ ([]);
  const executing = /** @type {Promise<void>[]} */ ([]);

  for (let i = 0; i < tasks.length; i++) {
    const p = tasks[i]().then((r) => { results[i] = r; });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        0,
        executing.findIndex((e) => e === undefined)
      );
    }
  }

  await Promise.allSettled(executing);
  return results;
}

/**
 * Build a className string from conditional values.
 * Accepts strings, numbers, null, undefined, and objects with boolean values.
 * @param {...unknown} args
 * @returns {string}
 */
export function classNames(...args) {
  const classes = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string' || typeof arg === 'number') {
      classes.push(String(arg));
    } else if (Array.isArray(arg)) {
      const nested = classNames(...arg);
      if (nested) classes.push(nested);
    } else if (typeof arg === 'object') {
      for (const key of Object.keys(arg)) {
        if (arg[key]) classes.push(key);
      }
    }
  }
  return classes.join(' ');
}
