import { store } from '../store.js';
import { router } from '../router.js';
import { auth } from '../services/auth.js';
import { CLOUD, USER } from '../constants/icons.js';
import { CONFIG } from '../constants/config.js';

export class LoginPage {
  constructor() {
    this._unsubscribers = [];
    this._isVerifying = false;
  }

  render() {
    return `
      <div class="login-page" data-page="login">
        <div class="login__bg-orb login__bg-orb--1"></div>
        <div class="login__bg-orb login__bg-orb--2"></div>
        <div class="login__bg-orb login__bg-orb--3"></div>

        <div class="login__card">
          <div class="login__logo">
            <div class="login__logo-icon">${CLOUD}</div>
          </div>

          <h1 class="login__title">Telegram Drive</h1>
          <p class="login__subtitle">Cloud storage powered by Telegram</p>

          <div class="login__status" data-login-status></div>

          <button class="login__btn" data-action="login" data-btn-login>
            <span class="login__btn-icon">${USER}</span>
            <span>Login with Telegram</span>
          </button>

          <p class="login__footer">Your files are stored securely in Telegram Groups</p>
        </div>

        <div class="login__version">v${CONFIG.APP_VERSION}</div>
      </div>`;
  }

  mount(container) {
    this._container = container;

    const btn = container.querySelector('[data-action="login"]');
    if (btn) {
      btn.addEventListener('click', this._handleLogin);
    }

    this._unsubscribers.push(
      auth.on('login', () => {
        store.set('user', auth.user);
        router.navigate('/');
      }),
    );

    if (auth.isAuthenticated()) {
      router.navigate('/');
    }
  }

  unmount() {
    const btn = this._container?.querySelector('[data-action="login"]');
    if (btn) {
      btn.removeEventListener('click', this._handleLogin);
    }
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { }
    }
    this._unsubscribers = [];
    this._container = null;
  }

  _handleLogin = async () => {
    if (this._isVerifying) return;
    this._isVerifying = true;

    const statusEl = document.querySelector('[data-login-status]');
    if (statusEl) {
      statusEl.innerHTML = '<span class="login__status-text login__status-text--loading">Connecting to Telegram...</span>';
    }

    try {
      const result = await auth.loginWithTelegram();
      if (result.success) {
        store.set('user', result.data);
        router.navigate('/');
      } else {
        if (statusEl) {
          statusEl.innerHTML = `<span class="login__status-text login__status-text--error">${this._escapeHtml(result.error || 'Login failed')}</span>`;
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span class="login__status-text login__status-text--error">${this._escapeHtml(err instanceof Error ? err.message : 'An unexpected error occurred')}</span>`;
      }
    } finally {
      this._isVerifying = false;
    }
  };

  _escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}
