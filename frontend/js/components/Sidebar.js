/**
 * @file Main navigation sidebar component.
 * Renders user profile, storage meter, navigation items, and folder shortcuts.
 */

import { store } from '../store.js';
import { router } from '../router.js';
import {
  MENU, CLOSE, HOME, CLOCK, STAR, TRASH, IMAGE, VIDEO, MUSIC,
  FILETEXT, ARCHIVE, SHARE, SETTINGS, FOLDER, PLUS, LOGOUT,
  CHEVRON_LEFT, CHEVRON_RIGHT, STAR_FILLED, USER, HARD_DRIVE,
} from '../constants/icons.js';
import { CONFIG } from '../constants/config.js';
import { NAV_ITEMS } from '../constants/types.js';
import { formatFileSize } from '../utils/format.js';

export class Sidebar {
  constructor(container) {
    if (!container) throw new Error('Sidebar: container element is required');

    /** @type {HTMLElement} */
    this.container = container;

    /** @type {HTMLElement|null} */
    this._el = null;

    /** @type {Array<() => void>} */
    this._unsubscribers = [];

    /** @type {Record<string, string>|null} */
    this._user = null;

    /** @type {Array<{id: number, name: string}>} */
    this._favoriteFolders = [];

    this._render();
    this._bindEvents();
  }

  /* ---- render ---- */

  _render() {
    const user = /** @type {Record<string, unknown>|null} */ (store.get('user'));
    const stats = /** @type {Record<string, unknown>|null} */ (store.get('stats'));
    const sidebarOpen = /** @type {boolean} */ (store.get('ui.sidebarOpen'));
    const currentPath = window.location.hash.replace(/^#/, '') || '/';

    this._user = /** @type {Record<string, string>|null} */ (user);
    const favoriteFolders = /** @type {Array<Record<string, unknown>>} */ (store.get('favorites.folders')) ?? [];
    this._favoriteFolders = favoriteFolders.map((f) => ({ id: Number(f.id), name: String(f.name ?? '') }));

    const storageUsed = stats ? Number(stats.usedStorage ?? 0) : 0;
    const storageLimit = stats ? Number(stats.storageLimit ?? CONFIG.APP_NAME ? 15 * 1024 ** 3 : 15 * 1024 ** 3) : 15 * 1024 ** 3;
    const storagePercent = storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;

    const navHtml = NAV_ITEMS.map((item) => this._navItemHtml(item, currentPath)).join('');

    const shortcutsHtml = this._favoriteFolders.length > 0
      ? this._favoriteFolders.map((f) => `
        <button class="sidebar-shortcut" data-folder-id="${f.id}" data-action="navigate-folder" title="${this._escapeHtml(f.name)}">
          ${FOLDER}
          <span>${this._escapeHtml(this._truncate(f.name, 20))}</span>
        </button>`).join('')
      : '';

    this.container.innerHTML = `
      <aside class="sidebar${sidebarOpen ? ' sidebar--open' : ''}" data-component="sidebar">
        <div class="sidebar__inner">
          <div class="sidebar__header">
            <div class="sidebar__brand">
              ${HARD_DRIVE}
              <span class="sidebar__brand-name">Telegram Drive</span>
            </div>
            <button class="sidebar__collapse-btn" data-action="collapse" aria-label="Collapse sidebar">
              ${CHEVRON_LEFT}
            </button>
          </div>

          <div class="sidebar__user">
            <div class="sidebar__avatar">
              ${user?.photoUrl
                ? `<img src="${this._escapeHtml(String(user.photoUrl))}" alt="Avatar" />`
                : USER}
            </div>
            <div class="sidebar__user-info">
              <span class="sidebar__user-name">${this._escapeHtml(String(user?.firstName ?? 'User') + (user?.lastName ? ' ' + String(user.lastName) : ''))}</span>
              <span class="sidebar__user-username">${user?.username ? '@' + this._escapeHtml(String(user.username)) : ''}</span>
            </div>
          </div>

          <div class="sidebar__storage">
            <div class="sidebar__storage-label">
              <span>${formatFileSize(storageUsed)}</span>
              <span>of ${formatFileSize(storageLimit)}</span>
            </div>
            <div class="sidebar__storage-bar">
              <div class="sidebar__storage-fill" style="width:${storagePercent}%"></div>
            </div>
          </div>

          <nav class="sidebar__nav">
            ${navHtml}
          </nav>

          ${shortcutsHtml ? `
            <div class="sidebar__shortcuts">
              <div class="sidebar__shortcuts-title">Shortcuts</div>
              ${shortcutsHtml}
            </div>` : ''}

          <div class="sidebar__footer">
            <button class="sidebar__footer-btn" data-action="settings">
              ${SETTINGS}
              <span>Settings</span>
            </button>
          </div>
        </div>

        <div class="sidebar__overlay" data-action="close-overlay"></div>
      </aside>`;

    this._el = this.container.querySelector('.sidebar');
  }

  /**
   * @param {{ id: string, label: string, icon: string, path: string }} item
   * @param {string} currentPath
   * @returns {string}
   */
  _navItemHtml(item, currentPath) {
    const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
    return `
      <button class="sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}"
              data-nav-id="${item.id}"
              data-action="navigate"
              data-path="${item.path}">
        <span class="sidebar__nav-icon">${this._getIcon(item.icon)}</span>
        <span class="sidebar__nav-label">${item.label}</span>
      </button>`;
  }

  /**
   * Resolve an icon name to its SVG.
   * @param {string} name
   * @returns {string}
   */
  _getIcon(name) {
    const map = {
      home: HOME, clock: CLOCK, star: STAR, trash: TRASH,
      image: IMAGE, video: VIDEO, music: MUSIC,
      filetext: FILETEXT, archive: ARCHIVE, share: SHARE,
      settings: SETTINGS,
    };
    return map[name.toLowerCase()] ?? FOLDER;
  }

  /* ---- events ---- */

  _bindEvents() {
    this.container.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target.closest('[data-action]'));
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      switch (action) {
        case 'navigate': {
          const path = btn.getAttribute('data-path');
          if (path) {
            router.navigate(path);
            this._closeOnMobile();
          }
          break;
        }
        case 'navigate-folder': {
          const id = btn.getAttribute('data-folder-id');
          if (id) {
            router.navigate(`/folders/${id}/files`);
            this._closeOnMobile();
          }
          break;
        }
        case 'collapse': {
          store.toggleSidebar();
          break;
        }
        case 'close-overlay': {
          store.set('ui.sidebarOpen', false);
          break;
        }
        case 'settings': {
          router.navigate('/settings');
          this._closeOnMobile();
          break;
        }
      }
    });

    /* Subscribe to store changes */
    this._unsubscribers.push(
      store.subscribe('user', (user) => {
        this._user = /** @type {Record<string, string>|null} */ (user);
        this._render();
      }),
    );

    this._unsubscribers.push(
      store.subscribe('ui.sidebarOpen', () => {
        const open = /** @type {boolean} */ (store.get('ui.sidebarOpen'));
        if (this._el) {
          this._el.classList.toggle('sidebar--open', open);
        }
      }),
    );

    this._unsubscribers.push(
      store.subscribe('favorites.folders', () => {
        this._render();
      }),
    );

    this._unsubscribers.push(
      store.subscribe('stats', () => {
        this._render();
      }),
    );

    /* Listen for hash changes to update active state */
    this._boundHashChange = () => this._render();
    window.addEventListener('hashchange', this._boundHashChange);
  }

  /** Close sidebar on mobile after navigation. */
  _closeOnMobile() {
    if (window.innerWidth <= 768) {
      store.set('ui.sidebarOpen', false);
    }
  }

  /* ---- helpers ---- */

  /**
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /**
   * @param {string} str
   * @param {number} max
   * @returns {string}
   */
  _truncate(str, max) {
    if (!str || str.length <= max) return str;
    return str.slice(0, max - 1) + '\u2026';
  }

  /* ---- destroy ---- */

  destroy() {
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { /* skip */ }
    }
    this._unsubscribers = [];
    if (this._boundHashChange) {
      window.removeEventListener('hashchange', this._boundHashChange);
    }
    this.container.innerHTML = '';
    this._el = null;
  }
}
