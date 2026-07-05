/**
 * @file Debounce, throttle, and memoize utilities.
 */

/**
 * Create a debounced function that delays invoking `fn` until `delay` ms
 * have elapsed since the last invocation.
 * @template F
 * @param {F} fn
 * @param {number} [delay=300]
 * @returns {F & { cancel: () => void, flush: () => void }}
 */
export function debounce(fn, delay = 300) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;
  /** @type {unknown[]|null} */
  let lastArgs = null;
  /** @type {unknown} */
  let context = null;

  const debounced = function (...args) {
    lastArgs = args;
    context = this;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(context, lastArgs);
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    context = null;
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn.apply(context, lastArgs);
    }
    lastArgs = null;
    context = null;
  };

  return /** @type {F & { cancel: () => void, flush: () => void }} */ (debounced);
}

/**
 * Create a throttled function that invokes `fn` at most once per `limit` ms.
 * @template F
 * @param {F} fn
 * @param {number} [limit=300]
 * @returns {F & { cancel: () => void }}
 */
export function throttle(fn, limit = 300) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;
  /** @type {unknown} */
  let lastContext = null;
  /** @type {unknown[]} */
  let lastArgs = [];

  const throttled = function (...args) {
    lastContext = this;
    lastArgs = args;
    if (!timer) {
      fn.apply(lastContext, lastArgs);
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs.length) {
          fn.apply(lastContext, lastArgs);
        }
      }, limit);
    }
  };

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastContext = null;
    lastArgs = [];
  };

  return /** @type {F & { cancel: () => void }} */ (throttled);
}

/**
 * Memoize a pure function with a single argument (or a resolver).
 * @template T
 * @param {(arg: T) => unknown} fn
 * @param {(arg: T) => string} [resolver]
 * @returns {(arg: T) => unknown}
 */
export function memoize(fn, resolver) {
  /** @type {Map<string, unknown>} */
  const cache = new Map();

  const memoized = (arg) => {
    const key = resolver ? resolver(arg) : String(arg);
    if (cache.has(key)) return cache.get(key);
    const result = fn(arg);
    cache.set(key, result);
    return result;
  };

  memoized.cache = cache;
  return memoized;
}
