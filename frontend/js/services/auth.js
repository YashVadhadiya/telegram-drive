/**
 * @file Authentication service — Telegram Login Widget, JWT, sessions, and MTProto.
 */

import { CONFIG } from '../constants/config.js';
import { api, setTokenProvider, setRefreshHandler } from './api.js';

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Generate a cryptographically random hex string for CSRF state.
 * @returns {string}
 */
function _generateState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/*  AuthService                                                        */
/* ------------------------------------------------------------------ */

class AuthService {
  constructor() {
    /** @type {import('../store.js').User | null} */
    this.user = null;

    /** @type {string | null} */
    this.accessToken = null;

    /** @type {string | null} */
    this.refreshToken = null;

    /** @type {Array<{ event: string, fn: Function }>} */
    this.listeners = [];

    /* Wire up API integration */
    setTokenProvider(() => this.getAccessToken());
    setRefreshHandler(() => this.refreshAccessToken());

    /* Attempt session restore on construction (fire-and-forget) */
    this._restoreSession();
  }

  /* ---- event system ---- */

  /**
   * Subscribe to auth state changes.
   * @param {'login'|'logout'|'refresh'|'session_expired'} event
   * @param {Function} fn
   * @returns {() => void} Unsubscribe function
   */
  on(event, fn) {
    this.listeners.push({ event, fn });
    return () => {
      const idx = this.listeners.findIndex((l) => l.event === event && l.fn === fn);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Notify all listeners for a given event.
   * @param {string} event
   * @param {unknown} [payload]
   */
  _notify(event, payload) {
    for (const listener of this.listeners) {
      if (listener.event === event) {
        try { listener.fn(payload); } catch { /* skip */ }
      }
    }
  }

  /* ---- token management ---- */

  /**
   * Return the current access token for the API client.
   * @returns {string|null}
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Store tokens in memory and persist the refresh token to sessionStorage.
   * @param {string} access
   * @param {string} refresh
   */
  _storeTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;

    try {
      sessionStorage.setItem(
        CONFIG.SESSION_STORAGE_KEY,
        JSON.stringify({ refreshToken: refresh }),
      );
    } catch {
      /* sessionStorage unavailable or full */
    }
  }

  /**
   * Clear all stored tokens (memory + sessionStorage).
   */
  _clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;

    try {
      sessionStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    this._notify('logout');
  }

  /**
   * Attempt to restore the session from sessionStorage on page load.
   * If a refresh token is found, tries to obtain a fresh access token
   * and load the user profile.
   * @returns {Promise<void>}
   */
  async _restoreSession() {
    try {
      const stored = sessionStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (!parsed.refreshToken) return;

      this.refreshToken = parsed.refreshToken;

      /* Try to refresh the access token */
      await this.refreshAccessToken();

      /* Load user profile */
      const meRes = await this.getMe();
      if (meRes.success) {
        this.user = meRes.data;
        this._notify('login', this.user);
      }
    } catch {
      this._clearTokens();
    }
  }

  /* ---- authentication flow ---- */

  /**
   * Open the Telegram Login Widget popup.
   *
   * Listens for a `postMessage` from `oauth.telegram.org` containing the
   * authorisation data, then verifies it with the backend.
   *
   * @returns {Promise<{ success: boolean, data?: import('../store.js').User, error?: string }>}
   */
  async loginWithTelegram() {
    const botUsername = CONFIG.TELEGRAM_LOGIN_BOT_USERNAME;
    if (!botUsername || botUsername === 'YourBotUsername') {
      return { success: false, error: 'Telegram bot username is not configured' };
    }

    const origin = window.location.origin;
    const state = _generateState();

    const url = new URL('https://oauth.telegram.org/auth');
    url.searchParams.set('bot_id', botUsername);
    url.searchParams.set('origin', origin);
    url.searchParams.set('embed', '1');
    url.searchParams.set('return_to', `${origin}/telegram-auth-callback`);
    url.searchParams.set('state', state);

    return new Promise((resolve) => {
      let settled = false;

      /** @param {MessageEvent} event */
      const messageHandler = (event) => {
        if (event.origin !== 'https://oauth.telegram.org') return;
        if (settled) return;

        const data = event.data;
        if (!data || !data.hash) return;

        /* Validate state for CSRF protection */
        if (data.state && data.state !== state) return;

        settled = true;
        cleanup();

        this.verifyTelegramAuth(data).then(resolve).catch((err) => {
          resolve({ success: false, error: err instanceof Error ? err.message : 'Verification failed' });
        });
      };

      const cleanup = () => {
        window.removeEventListener('message', messageHandler);
        if (pollTimer) clearInterval(pollTimer);
        if (popup && !popup.closed) popup.close();
      };

      const popup = window.open(
        url.toString(),
        'telegram-login',
        'width=400,height=600,menubar=no,toolbar=no,location=no',
      );

      if (!popup || popup.closed) {
        resolve({ success: false, error: 'Popup was blocked. Please allow popups for this site.' });
        return;
      }

      window.addEventListener('message', messageHandler);

      /* Poll for popup close (user cancelled) */
      const pollTimer = setInterval(() => {
        if (popup.closed && !settled) {
          settled = true;
          cleanup();
          resolve({ success: false, error: 'Login cancelled' });
        }
      }, 500);
    });
  }

  /**
   * Send Telegram auth data to the backend for verification.
   * On success the backend returns JWT tokens.
   *
   * @param {Record<string, string>} authData - Data from Telegram Login Widget
   * @returns {Promise<{ success: boolean, data?: import('../store.js').User, error?: string }>}
   */
  async verifyTelegramAuth(authData) {
    const res = await api.post('/auth/telegram', { authData });

    if (!res.success) {
      return { success: false, error: res.error ?? 'Authentication failed' };
    }

    const data = /** @type {{ accessToken: string, refreshToken: string, user: import('../store.js').User }} */ (res.data);

    if (data.accessToken && data.refreshToken) {
      this._storeTokens(data.accessToken, data.refreshToken);
    }

    if (data.user) {
      this.user = data.user;
    }

    this._notify('login', this.user);
    return { success: true, data: this.user };
  }

  /**
   * Refresh the access token using the stored refresh token.
   * @returns {Promise<void>}
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const res = await api.post('/auth/refresh', { refreshToken: this.refreshToken }, { skipAuth: true });

    if (!res.success) {
      this._clearTokens();
      throw new Error(res.error ?? 'Failed to refresh token');
    }

    const data = /** @type {{ accessToken: string, refreshToken?: string }} */ (res.data);

    if (data.accessToken) {
      const newRefresh = data.refreshToken ?? this.refreshToken;
      this._storeTokens(data.accessToken, newRefresh);
      this._notify('refresh');
    }
  }

  /**
   * Log out — clear tokens and notify the backend.
   * @returns {Promise<{ success: boolean }>}
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      /* best-effort */
    }

    this._clearTokens();
    return { success: true };
  }

  /**
   * Fetch the current user profile from the backend.
   * Updates `this.user` on success.
   * @returns {Promise<{ success: boolean, data?: import('../store.js').User, error?: string }>}
   */
  async getMe() {
    const res = await api.get('/auth/me');

    if (res.success) {
      this.user = /** @type {import('../store.js').User} */ (res.data);
    }

    return {
      success: res.success,
      data: this.user ?? undefined,
      error: res.error,
    };
  }

  /* ---- convenience ---- */

  /**
   * Check whether the user is currently authenticated.
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Get the current user object (may be stale if not yet fetched).
   * @returns {import('../store.js').User | null}
   */
  getUser() {
    return this.user;
  }

  /* ---- MTProto session management ---- */

  /**
   * Start a new MTProto session for the given phone number.
   * The backend returns a `phoneCodeHash` needed for verification.
   * @param {string} phone  - International phone number (E.164)
   * @returns {Promise<{ success: boolean, data?: { phoneCodeHash: string }, error?: string }>}
   */
  async startMtProtoSession(phone) {
    const res = await api.post('/telegram/session/start', { phone });
    return {
      success: res.success,
      data: /** @type {{ phoneCodeHash: string }|undefined} */ (res.data),
      error: res.error,
    };
  }

  /**
   * Verify the MTProto session with the code received via Telegram.
   * @param {string} phone
   * @param {string} code
   * @param {string} phoneCodeHash
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async verifyMtProtoSession(phone, code, phoneCodeHash) {
    const res = await api.post('/telegram/session/verify', { phone, code, phoneCodeHash });
    return { success: res.success, error: res.error };
  }

  /**
   * Revoke the current MTProto session.
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async revokeMtProtoSession() {
    const res = await api.delete('/telegram/session');
    return { success: res.success, error: res.error };
  }
}

/** @type {AuthService} */
export const auth = new AuthService();
