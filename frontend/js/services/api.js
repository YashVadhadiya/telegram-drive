/**
 * @file Fetch-based API client with JWT auth, interceptors, timeout, and XHR upload.
 *
 * Token provider and refresh handler are injected externally (see `setTokenProvider`
 * and `setRefreshHandler`) to avoid circular dependencies with the auth service.
 */

import { CONFIG } from '../constants/config.js';

/* ------------------------------------------------------------------ */
/*  Module-level state for pluggable auth                             */
/* ------------------------------------------------------------------ */

/** @type {(() => string | null) | null} */
let _tokenProvider = null;

/** @type {(() => Promise<void>) | null} */
let _refreshHandler = null;

/** @type {boolean} */
let _isRefreshing = false;

/**
 * @typedef {{ resolve: () => void, reject: (reason: unknown) => void }} RefreshSubscriber
 * @type {RefreshSubscriber[]}
 */
let _refreshSubscribers = [];

/**
 * Set the function that returns the current Bearer token (or null).
 * Called on every request unless `skipAuth` is true.
 * @param {() => string | null} provider
 */
export function setTokenProvider(provider) {
  _tokenProvider = provider;
}

/**
 * Set the async function called when a 401 is received.
 * Must refresh the access token (e.g. via a refresh-token endpoint).
 * Called at most once concurrently; subsequent 401s are queued.
 * @param {() => Promise<void>} handler
 */
export function setRefreshHandler(handler) {
  _refreshHandler = handler;
}

/** Notify all queued subscribers that token refresh has finished. */
function _onRefreshed(error) {
  const subs = _refreshSubscribers.slice();
  _refreshSubscribers = [];

  if (error) {
    for (const sub of subs) sub.reject(error);
  } else {
    for (const sub of subs) sub.resolve();
  }
}

/* ------------------------------------------------------------------ */
/*  Typedefs                                                          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} RequestOptions
 * @property {Record<string, string|string[]|number|boolean|null|undefined>} [params]
 * @property {unknown} [body] - JSON body (auto-serialised) or FormData (sent as-is)
 * @property {AbortSignal} [signal]
 * @property {Record<string, string>} [headers]
 * @property {number} [timeout=30000]
 * @property {boolean} [skipAuth] - Omit the Authorization header
 * @property {'json'|'text'|'blob'|'arraybuffer'|'formData'} [responseType='json']
 * @property {boolean} [_retried] - Internal flag; set true on retry after 401
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {unknown} [data]
 * @property {Record<string, unknown>} [meta]
 * @property {string} [error]
 */

/* ------------------------------------------------------------------ */
/*  ApiClient                                                         */
/* ------------------------------------------------------------------ */

class ApiClient {
  constructor() {
    /** @type {string} */
    this.baseUrl = CONFIG.API_BASE_URL;

    /** @type {((opts: RequestOptions) => RequestOptions | void)[]} */
    this.requestInterceptors = [];

    /** @type {((res: ApiResponse) => ApiResponse | void)[]} */
    this.responseInterceptors = [];
  }

  /* ---- token access ---- */

  /**
   * Get the current access token from the registered provider.
   * @returns {string|null}
   */
  getToken() {
    return _tokenProvider ? _tokenProvider() : null;
  }

  /* ---- interceptors ---- */

  /**
   * Register a request interceptor. Receives the resolved options before the
   * request is sent. Must return the (possibly modified) options object or undefined.
   * @param {(opts: RequestOptions) => RequestOptions | void} fn
   * @returns {() => void} Unsubscribe function
   */
  useRequestInterceptor(fn) {
    this.requestInterceptors.push(fn);
    return () => {
      const idx = this.requestInterceptors.indexOf(fn);
      if (idx !== -1) this.requestInterceptors.splice(idx, 1);
    };
  }

  /**
   * Register a response interceptor. Receives the normalised response before
   * it is returned to the caller. Must return the (possibly modified) response
   * or undefined.
   * @param {(res: ApiResponse) => ApiResponse | void} fn
   * @returns {() => void} Unsubscribe function
   */
  useResponseInterceptor(fn) {
    this.responseInterceptors.push(fn);
    return () => {
      const idx = this.responseInterceptors.indexOf(fn);
      if (idx !== -1) this.responseInterceptors.splice(idx, 1);
    };
  }

  /* ---- internal helpers ---- */

  /**
   * Build a full URL with query string from params.
   * @param {string} path
   * @param {Record<string, string|string[]|number|boolean|null|undefined>} [params]
   * @returns {string}
   */
  _buildUrl(path, params) {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qp = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) qp.append(key, String(v));
        } else {
          qp.set(key, String(value));
        }
      }
      const qs = qp.toString();
      if (qs) url += `?${qs}`;
    }
    return url;
  }

  /**
   * Build fetch headers. Adds Content-Type for JSON bodies (omitted for FormData).
   * @param {RequestOptions} opts
   * @returns {Record<string, string>}
   */
  _buildHeaders(opts) {
    /** @type {Record<string, string>} */
    const headers = { ...opts.headers };

    if (!opts.skipAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    if (opts.body !== undefined && opts.body !== null && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * Parse the response body according to the expected type.
   * @param {Response} response
   * @param {'json'|'text'|'blob'|'arraybuffer'|'formData'} [type='json']
   * @returns {Promise<unknown>}
   */
  async _processResponse(response, type = 'json') {
    if (!response.body) return null;
    try {
      switch (type) {
        case 'text': return response.text();
        case 'blob': return response.blob();
        case 'arraybuffer': return response.arrayBuffer();
        case 'formData': return response.formData();
        case 'json':
        default: {
          const text = await response.text();
          if (!text) return null;
          try { return JSON.parse(text); }
          catch { return text; }
        }
      }
    } catch {
      return null;
    }
  }

  /**
   * Normalise raw HTTP response + body into the standard `ApiResponse` shape.
   * @param {{ ok: boolean, status: number, statusText: string }} response
   * @param {unknown} body
   * @returns {ApiResponse}
   */
  _normaliseResponse(response, body) {
    const ok = response.ok;

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const obj = /** @type {Record<string, unknown>} */ (body);
      if (obj.ok !== undefined && obj.data !== undefined) {
        return {
          success: Boolean(obj.ok),
          data: obj.data,
          meta: /** @type {Record<string, unknown>|undefined} */ (obj.meta),
          error: typeof obj.error === 'string' ? obj.error : undefined,
        };
      }
    }

    if (ok) {
      return { success: true, data: body, meta: undefined, error: undefined };
    }

    let message = `HTTP ${response.status}`;
    if (body && typeof body === 'object') {
      const obj = /** @type {Record<string, unknown>} */ (body);
      message = String(obj.error ?? obj.message ?? message);
    } else if (typeof body === 'string') {
      message = body;
    } else if (response.statusText) {
      message = response.statusText;
    }

    return { success: false, data: undefined, meta: undefined, error: message };
  }

  /**
   * Execute fetch with a timeout.
   * @param {string} url
   * @param {RequestInit} init
   * @param {number} timeout
   * @returns {Promise<Response>}
   */
  async _fetchWithTimeout(url, init, timeout) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeout);

    const signals = [controller.signal];
    if (init.signal) signals.push(init.signal);

    const combined = _combineSignals(signals);

    try {
      return await fetch(url, { ...init, signal: combined });
    } finally {
      clearTimeout(tid);
    }
  }

  /**
   * Handle a 401 response — attempt token refresh, then retry or queue.
   * @param {string} method
   * @param {string} path
   * @param {RequestOptions} options
   * @returns {Promise<ApiResponse>}
   */
  async _handleUnauthorized(method, path, options) {
    if (!_refreshHandler) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!_isRefreshing) {
      _isRefreshing = true;
      try {
        await _refreshHandler();
        _isRefreshing = false;
        _onRefreshed(null);
      } catch (err) {
        _isRefreshing = false;
        _onRefreshed(err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Session expired',
        };
      }
      return this.request(method, path, { ...options, _retried: true });
    }

    /* Another refresh is in flight — queue this request */
    return new Promise((resolve, reject) => {
      _refreshSubscribers.push({
        resolve: () => {
          this.request(method, path, { ...options, _retried: true })
            .then(resolve)
            .catch(reject);
        },
        reject,
      });
    });
  }

  /* ---- public request method ---- */

  /**
   * Perform an HTTP request and return a normalised `ApiResponse`.
   *
   * - Runs request interceptors before sending.
   * - Adds Bearer token if available.
   * - Auto-retries once on 401 after refreshing the token.
   * - Throws a network-friendly error object on fetch failure.
   * - Runs response interceptors on the result.
   *
   * @param {string} method  - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param {string} path    - API path, e.g. `/folders` (no leading slash needed)
   * @param {RequestOptions} [options={}]
   * @returns {Promise<ApiResponse>}
   */
  async request(method, path, options = {}) {
    const isRetry = Boolean(options._retried);
    const opts = { ...options };
    delete opts._retried;

    /* ---- request interceptors ---- */
    let intercepted = opts;
    for (const fn of this.requestInterceptors) {
      try {
        const result = fn(intercepted);
        if (result) intercepted = result;
      } catch {
        /* silenty skip a failing interceptor */
      }
    }

    try {
      const url = this._buildUrl(path, intercepted.params);
      const headers = this._buildHeaders(intercepted);

      /** @type {RequestInit} */
      const init = { method, headers, signal: intercepted.signal };

      if (intercepted.body !== undefined) {
        init.body = intercepted.body instanceof FormData
          ? intercepted.body
          : JSON.stringify(intercepted.body);
      }

      const timeout = intercepted.timeout ?? 30000;
      const response = await this._fetchWithTimeout(url, init, timeout);

      /* ---- 401 → refresh + retry ---- */
      if (response.status === 401 && !isRetry && _refreshHandler) {
        return this._handleUnauthorized(method, path, options);
      }

      const body = await this._processResponse(response, intercepted.responseType);
      let result = this._normaliseResponse(response, body);

      /* ---- response interceptors ---- */
      for (const fn of this.responseInterceptors) {
        try {
          const interceptorResult = fn(result);
          if (interceptorResult) result = interceptorResult;
        } catch {
          /* skip */
        }
      }

      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: 'Request was cancelled' };
      }
      if (err instanceof TypeError) {
        return { success: false, error: 'Network error. Please check your connection.' };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      };
    }
  }

  /* ---- convenience methods ---- */

  /**
   * HTTP GET.
   * @param {string} path
   * @param {Record<string, string|string[]|number|boolean|null|undefined>} [params]
   * @returns {Promise<ApiResponse>}
   */
  get(path, params) {
    return this.request('GET', path, { params });
  }

  /**
   * HTTP POST.
   * @param {string} path
   * @param {unknown} [body]
   * @returns {Promise<ApiResponse>}
   */
  post(path, body) {
    return this.request('POST', path, { body });
  }

  /**
   * HTTP PUT.
   * @param {string} path
   * @param {unknown} [body]
   * @returns {Promise<ApiResponse>}
   */
  put(path, body) {
    return this.request('PUT', path, { body });
  }

  /**
   * HTTP PATCH.
   * @param {string} path
   * @param {unknown} [body]
   * @returns {Promise<ApiResponse>}
   */
  patch(path, body) {
    return this.request('PATCH', path, { body });
  }

  /**
   * HTTP DELETE.
   * @param {string} path
   * @returns {Promise<ApiResponse>}
   */
  delete(path) {
    return this.request('DELETE', path);
  }

  /* ---- upload with progress ---- */

  /**
   * Upload a file via XMLHttpRequest with progress tracking.
   *
   * @param {string} path
   * @param {FormData} formData
   * @param {(loaded: number, total: number) => void} [onProgress] - Called with bytes loaded / total
   * @param {AbortSignal} [signal] - Optional signal to abort the upload
   * @returns {Promise<ApiResponse>}
   */
  upload(path, formData, onProgress, signal) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const url = this._buildUrl(path);

      xhr.open('POST', url);

      const token = this.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.addEventListener('load', () => {
        const body = _parseXhrBody(xhr);
        const result = this._normaliseResponse(
          { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, statusText: xhr.statusText },
          body,
        );
        resolve(result);
      });

      xhr.addEventListener('error', () => {
        resolve({ success: false, error: 'Network error during upload' });
      });

      xhr.addEventListener('abort', () => {
        resolve({ success: false, error: 'Upload was cancelled' });
      });

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(e.loaded, e.total);
          }
        });
      }

      if (signal) {
        const abortHandler = () => { xhr.abort(); };
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      xhr.send(formData);
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Combine multiple AbortSignals into one. The combined signal is aborted
 * when **any** of the input signals is aborted.
 * @param {AbortSignal[]} signals
 * @returns {AbortSignal}
 */
function _combineSignals(signals) {
  const controller = new AbortController();

  const cleanup = () => {
    for (const sig of signals) {
      sig.removeEventListener('abort', onAbort);
    }
  };

  const onAbort = () => {
    controller.abort();
    cleanup();
  };

  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      break;
    }
    sig.addEventListener('abort', onAbort);
  }

  return controller.signal;
}

/**
 * Try to parse an XHR response as JSON; fall back to raw text.
 * @param {XMLHttpRequest} xhr
 * @returns {unknown}
 */
function _parseXhrBody(xhr) {
  const text = xhr.responseText;
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return text; }
}

/* ------------------------------------------------------------------ */
/*  Singleton export                                                   */
/* ------------------------------------------------------------------ */

/** @type {ApiClient} */
export const api = new ApiClient();
