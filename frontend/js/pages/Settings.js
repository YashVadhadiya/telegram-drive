import { store } from '../store.js';
import { router } from '../router.js';
import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import {
  USER, MOON, SUN, MONITOR, GLOBE, UPLOAD, CLOUD,
  BELL, TRASH, DOWNLOAD, KEY, SETTINGS, CHECK, REFRESH,
} from '../constants/icons.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { CONFIG } from '../constants/config.js';

export class SettingsPage {
  constructor() {
    this._settings = {};
    this._user = null;
    this._loading = true;
    this._error = null;
    this._container = null;
    this._unsubscribers = [];
    this._mtProtoConnected = false;
  }

  render() {
    if (this._loading) {
      return this._renderSkeleton();
    }
    if (this._error) {
      return this._renderError();
    }

    const user = this._user || {};
    const settings = this._settings || {};

    return `
      <div class="settings-page" data-page="settings">
        <div class="page-header">
          <h1 class="page-header__title">Settings</h1>
        </div>

        <div class="settings__sections">
          <section class="settings-card">
            <h2 class="settings-card__title">Profile</h2>
            <div class="settings-card__body">
              <div class="settings-profile">
                <div class="settings-profile__avatar">
                  ${user.photoUrl
                    ? `<img src="${this._escapeAttr(String(user.photoUrl))}" alt="" class="settings-profile__img" />`
                    : `<span class="settings-profile__placeholder">${USER}</span>`}
                </div>
                <div class="settings-profile__info">
                  <span class="settings-profile__name">${this._escapeHtml(user.firstName || '')} ${this._escapeHtml(user.lastName || '')}</span>
                  <span class="settings-profile__username">${user.username ? `@${this._escapeHtml(user.username)}` : ''}</span>
                  <span class="settings-profile__id">Telegram ID: ${user.id || 'N/A'}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="settings-card">
            <h2 class="settings-card__title">Appearance</h2>
            <div class="settings-card__body">
              <div class="settings-row">
                <span class="settings-row__label">Theme</span>
                <div class="settings-toggle-group" data-setting="theme">
                  <button class="settings-toggle-btn${(settings.theme || 'dark') === 'dark' ? ' settings-toggle-btn--active' : ''}" data-value="dark">
                    ${MOON} Dark
                  </button>
                  <button class="settings-toggle-btn${settings.theme === 'light' ? ' settings-toggle-btn--active' : ''}" data-value="light">
                    ${SUN} Light
                  </button>
                  <button class="settings-toggle-btn${settings.theme === 'system' ? ' settings-toggle-btn--active' : ''}" data-value="system">
                    ${MONITOR} System
                  </button>
                </div>
              </div>
              <div class="settings-row">
                <span class="settings-row__label">Language</span>
                <select class="settings-select" data-setting="language">
                  <option value="en" ${(settings.language || 'en') === 'en' ? 'selected' : ''}>English</option>
                  <option value="ru" ${settings.language === 'ru' ? 'selected' : ''}>Русский</option>
                  <option value="es" ${settings.language === 'es' ? 'selected' : ''}>Español</option>
                  <option value="ar" ${settings.language === 'ar' ? 'selected' : ''}>العربية</option>
                </select>
              </div>
            </div>
          </section>

          <section class="settings-card">
            <h2 class="settings-card__title">Upload Settings</h2>
            <div class="settings-card__body">
              <div class="settings-row">
                <span class="settings-row__label">Chunk Size</span>
                <select class="settings-select" data-setting="chunkSize">
                  <option value="26214400" ${String(settings.chunkSize) === '26214400' ? 'selected' : ''}>25 MB</option>
                  <option value="52428800" ${String(settings.chunkSize) === '52428800' || !settings.chunkSize ? 'selected' : ''}>50 MB</option>
                  <option value="104857600" ${String(settings.chunkSize) === '104857600' ? 'selected' : ''}>100 MB</option>
                </select>
              </div>
              <div class="settings-row">
                <span class="settings-row__label">Auto Retry</span>
                <label class="settings-switch">
                  <input type="checkbox" data-setting="autoRetry" ${settings.autoRetry !== false ? 'checked' : ''} />
                  <span class="settings-switch__slider"></span>
                </label>
              </div>
              <div class="settings-row">
                <span class="settings-row__label">Max Concurrent Uploads</span>
                <select class="settings-select" data-setting="maxConcurrent">
                  <option value="1" ${String(settings.maxConcurrent) === '1' ? 'selected' : ''}>1</option>
                  <option value="2" ${String(settings.maxConcurrent) === '2' ? 'selected' : ''}>2</option>
                  <option value="3" ${String(settings.maxConcurrent) === '3' || !settings.maxConcurrent ? 'selected' : ''}>3</option>
                  <option value="5" ${String(settings.maxConcurrent) === '5' ? 'selected' : ''}>5</option>
                </select>
              </div>
            </div>
          </section>

          <section class="settings-card">
            <h2 class="settings-card__title">Telegram Session (MTProto)</h2>
            <div class="settings-card__body">
              <div class="settings-row">
                <span class="settings-row__label">Status</span>
                <span class="settings-status ${this._mtProtoConnected ? 'settings-status--connected' : 'settings-status--disconnected'}">
                  ${this._mtProtoConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              ${this._mtProtoConnected
                ? `
                  <div class="settings-row">
                    <span class="settings-row__label">Phone</span>
                    <span class="settings-row__value">${this._escapeHtml(this._maskPhone(settings.phone || ''))}</span>
                  </div>
                  <button class="btn btn--danger" data-action="disconnect-mtproto">Disconnect</button>`
                : `
                  <button class="btn btn--primary" data-action="connect-mtproto">Connect Telegram Account</button>
                  <div class="settings-mtproto-form settings-mtproto-form--hidden" data-mtproto-form>
                    <input type="tel" class="settings-input" data-mtproto-phone placeholder="Phone number (E.164)" />
                    <button class="btn btn--primary" data-action="send-mtproto-code">Send Code</button>
                    <input type="text" class="settings-input" data-mtproto-code placeholder="Verification code" style="margin-top:8px" />
                    <input type="hidden" data-mtproto-hash />
                    <button class="btn btn--primary" data-action="verify-mtproto-code" style="margin-top:4px">Verify</button>
                  </div>`}
            </div>
          </section>

          <section class="settings-card">
            <h2 class="settings-card__title">Notifications</h2>
            <div class="settings-card__body">
              <div class="settings-row">
                <span class="settings-row__label">Upload complete</span>
                <label class="settings-switch">
                  <input type="checkbox" data-setting="notifyUploadComplete" ${settings.notifyUploadComplete !== false ? 'checked' : ''} />
                  <span class="settings-switch__slider"></span>
                </label>
              </div>
              <div class="settings-row">
                <span class="settings-row__label">Upload failed</span>
                <label class="settings-switch">
                  <input type="checkbox" data-setting="notifyUploadFailed" ${settings.notifyUploadFailed !== false ? 'checked' : ''} />
                  <span class="settings-switch__slider"></span>
                </label>
              </div>
              <div class="settings-row">
                <span class="settings-row__label">Share accessed</span>
                <label class="settings-switch">
                  <input type="checkbox" data-setting="notifyShareAccessed" ${settings.notifyShareAccessed !== false ? 'checked' : ''} />
                  <span class="settings-switch__slider"></span>
                </label>
              </div>
            </div>
          </section>

          <section class="settings-card settings-card--danger">
            <h2 class="settings-card__title">Danger Zone</h2>
            <div class="settings-card__body">
              <button class="btn btn--danger" data-action="export-data">
                <span class="btn__icon">${DOWNLOAD}</span>
                Export Data
              </button>
              <button class="btn btn--danger" data-action="delete-account" style="margin-top:8px">
                <span class="btn__icon">${TRASH}</span>
                Delete Account
              </button>
            </div>
          </section>

          <section class="settings-card">
            <h2 class="settings-card__title">About</h2>
            <div class="settings-card__body">
              <div class="settings-row">
                <span class="settings-row__label">App Version</span>
                <span class="settings-row__value">${CONFIG.APP_VERSION}</span>
              </div>
              <div class="settings-row">
                <span class="settings-row__label">Telegram Drive</span>
                <a href="https://telegram-drive.app" target="_blank" rel="noopener" class="settings-link">${CLOUD} Visit website</a>
              </div>
            </div>
          </section>
        </div>
      </div>`;
  }

  async mount(container) {
    this._container = container;

    await this._loadSettings();
    this._bindEvents();

    this._unsubscribers.push(
      store.subscribe('settings', (val) => {
        this._settings = val || {};
      }),
      store.subscribe('user', (val) => {
        this._user = val;
      }),
    );
  }

  unmount() {
    this._unbindEvents();
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { }
    }
    this._unsubscribers = [];
    this._container = null;
  }

  async _loadSettings() {
    this._loading = true;
    this._reRender();

    try {
      const [settingsRes, meRes] = await Promise.all([
        store.get('settings') ? Promise.resolve({ success: true, data: store.get('settings') }) : api.get('/settings'),
        store.get('user') ? Promise.resolve({ success: true, data: store.get('user') }) : auth.getMe(),
      ]);

      if (settingsRes.success) {
        this._settings = settingsRes.data || {};
        store.set('settings', this._settings);
      }
      if (meRes.success) {
        this._user = meRes.data || store.get('user');
        store.set('user', this._user);
      }

      const sessionRes = await api.get('/telegram/session/status');
      this._mtProtoConnected = sessionRes.success && sessionRes.data?.connected === true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load settings';
    } finally {
      this._loading = false;
      this._reRender();
    }
  }

  _bindEvents() {
    if (!this._container) return;
    this._container.addEventListener('click', this._boundClick);
    this._container.addEventListener('change', this._boundChange);
  }

  _unbindEvents() {
    if (this._container) {
      this._container.removeEventListener('click', this._boundClick);
      this._container.removeEventListener('change', this._boundChange);
    }
  }

  _boundClick = async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');

    switch (action) {
      case 'export-data':
        await this._exportData();
        break;
      case 'delete-account': {
        const confirmed = await Modal.confirm(
          'Are you sure you want to delete your account? This action cannot be undone.',
          { confirmText: 'Delete Account', confirmVariant: 'danger' },
        );
        if (confirmed) {
          const res = await api.delete('/auth/me');
          if (res.success) {
            toast.success('Account deleted');
            await auth.logout();
            router.navigate('/login');
          } else {
            toast.error(res.error || 'Failed to delete account');
          }
        }
        break;
      }
      case 'connect-mtproto': {
        const form = this._container?.querySelector('[data-mtproto-form]');
        if (form) form.classList.remove('settings-mtproto-form--hidden');
        break;
      }
      case 'send-mtproto-code': {
        const phone = this._container?.querySelector('[data-mtproto-phone]');
        if (!phone) return;
        const phoneVal = /** @type {HTMLInputElement} */ (phone).value.trim();
        if (!phoneVal) {
          toast.error('Please enter a phone number');
          return;
        }
        const res = await auth.startMtProtoSession(phoneVal);
        if (res.success) {
          const hashInput = this._container?.querySelector('[data-mtproto-hash]');
          if (hashInput) /** @type {HTMLInputElement} */ (hashInput).value = res.data?.phoneCodeHash || '';
          toast.success('Verification code sent');
        } else {
          toast.error(res.error || 'Failed to send code');
        }
        break;
      }
      case 'verify-mtproto-code': {
        const phone = this._container?.querySelector('[data-mtproto-phone]');
        const codeInput = this._container?.querySelector('[data-mtproto-code]');
        const hashInput = this._container?.querySelector('[data-mtproto-hash]');
        if (!phone || !codeInput) return;
        const phoneVal = /** @type {HTMLInputElement} */ (phone).value.trim();
        const codeVal = /** @type {HTMLInputElement} */ (codeInput).value.trim();
        const hashVal = /** @type {HTMLInputElement} */ (hashInput).value.trim();
        if (!codeVal) {
          toast.error('Please enter the verification code');
          return;
        }
        const res = await auth.verifyMtProtoSession(phoneVal, codeVal, hashVal);
        if (res.success) {
          this._mtProtoConnected = true;
          this._reRender();
          toast.success('Telegram account connected');
        } else {
          toast.error(res.error || 'Verification failed');
        }
        break;
      }
      case 'disconnect-mtproto': {
        const confirmed = await Modal.confirm('Disconnect Telegram account?');
        if (!confirmed) return;
        const res = await auth.revokeMtProtoSession();
        if (res.success) {
          this._mtProtoConnected = false;
          this._reRender();
          toast.success('Telegram account disconnected');
        } else {
          toast.error(res.error || 'Failed to disconnect');
        }
        break;
      }
    }
  };

  _boundChange = async (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const setting = target.getAttribute('data-setting');
    if (!setting) return;

    let value;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      value = target.checked;
    } else if (target instanceof HTMLSelectElement) {
      value = target.value;
      if (setting === 'chunkSize') value = parseInt(value, 10);
      if (setting === 'maxConcurrent') value = parseInt(value, 10);
    }

    this._settings[setting] = value;
    store.set('settings', { ...this._settings });

    if (setting === 'theme') {
      if (value === 'dark' || value === 'light') {
        store.setTheme(value);
      }
    }

    const res = await api.put('/settings', { [setting]: value });
    if (res.success) {
      const themeBtn = target.closest('[data-setting="theme"]');
      if (themeBtn) {
        themeBtn.querySelectorAll('.settings-toggle-btn').forEach((btn) => {
          btn.classList.toggle('settings-toggle-btn--active', btn.getAttribute('data-value') === value);
        });
      }
    } else {
      toast.error(res.error || 'Failed to save setting');
    }
  };

  async _exportData() {
    const res = await api.get('/export');
    if (res.success && res.data?.url) {
      const a = document.createElement('a');
      a.href = res.data.url;
      a.download = 'telegram-drive-export.zip';
      a.click();
      toast.success('Export started');
    } else {
      toast.error(res.error || 'Failed to export data');
    }
  }

  _maskPhone(phone) {
    if (!phone || phone.length < 6) return phone || '';
    return phone.slice(0, 4) + '****' + phone.slice(-2);
  }

  _renderSkeleton() {
    return `
      <div class="settings-page">
        <div class="page-header">
          <h1 class="page-header__title">Settings</h1>
        </div>
        <div class="settings__sections">
          ${Array.from({ length: 4 }, () => `
            <div class="settings-card">
              <div class="skeleton skeleton--text skeleton--w-32"></div>
              <div class="settings-card__body">
                <div class="skeleton skeleton--row"></div>
                <div class="skeleton skeleton--row"></div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  _renderError() {
    return `
      <div class="settings-page">
        <div class="page-header">
          <h1 class="page-header__title">Settings</h1>
        </div>
        <div class="error-state">
          <span class="error-state__icon">${REFRESH}</span>
          <p class="error-state__text">${this._escapeHtml(this._error || 'Failed to load settings')}</p>
          <button class="btn btn--primary" data-action="retry">Retry</button>
        </div>
      </div>`;
  }

  _reRender() {
    if (!this._container) return;
    const html = this.render();
    this._container.innerHTML = html;
    this._bindEvents();
  }

  _escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  _escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
