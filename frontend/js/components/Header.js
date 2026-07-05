/**
 * @file Top app header bar with search, actions, and theme toggle.
 */

import { store } from '../store.js';
import { router } from '../router.js';
import {
  MENU, SEARCH, UPLOAD, BELL, MOON, SUN, USER, CLOSE,
} from '../constants/icons.js';
import { debounce } from '../utils/debounce.js';
import { CONFIG } from '../constants/config.js';

export class Header {
  constructor(container) {
    if (!container) throw new Error('Header: container element is required');

    /** @type {HTMLElement} */
    this.container = container;

    /** @type {HTMLElement|null} */
    this._el = null;

    /** @type {HTMLInputElement|null} */
    this._searchInput = null;

    /** @type {Array<() => void>} */
    this._unsubscribers = [];

    this._render();
    this._bindEvents();
  }

  _render() {
    const theme = /** @type {string} */ (store.get('ui.theme') ?? 'dark');
    const user = /** @type {Record<string, unknown>|null} */ (store.get('user'));
    const searchQuery = /** @type {string} */ (store.get('search.query') ?? '');

    this.container.innerHTML = `
      <header class="header" data-component="header">
        <div class="header__left">
          <button class="header__menu-btn" data-action="toggle-sidebar" aria-label="Toggle sidebar">
            ${MENU}
          </button>
          <div class="header__search">
            <span class="header__search-icon">${SEARCH}</span>
            <input type="text"
                   class="header__search-input"
                   placeholder="Search files and folders..."
                   value="${this._escapeHtml(searchQuery)}"
                   data-search-input
                   autocomplete="off"
                   spellcheck="false" />
            <button class="header__search-clear${searchQuery ? '' : ' header__search-clear--hidden'}"
                    data-action="clear-search"
                    aria-label="Clear search">
              ${CLOSE}
            </button>
          </div>
        </div>

        <div class="header__right">
          <button class="header__action-btn header__upload-btn" data-action="upload" aria-label="Upload file">
            ${UPLOAD}
            <span class="header__action-label">Upload</span>
          </button>

          <button class="header__action-btn" data-action="notifications" aria-label="Notifications">
            ${BELL}
          </button>

          <button class="header__action-btn header__theme-btn" data-action="toggle-theme" aria-label="Toggle theme">
            <span class="header__theme-icon">${theme === 'dark' ? MOON : SUN}</span>
          </button>

          <div class="header__avatar" data-action="user-menu" role="button" tabindex="0" aria-label="User menu">
            ${user?.photoUrl
              ? `<img src="${this._escapeHtml(String(user.photoUrl))}" alt="User" />`
              : USER}
          </div>
        </div>
      </header>`;

    this._el = this.container.querySelector('.header');
    this._searchInput = this._el?.querySelector('[data-search-input]');
  }

  _bindEvents() {
    this.container.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target.closest('[data-action]'));
      if (!btn) return;

      const action = btn.getAttribute('data-action');

      switch (action) {
        case 'toggle-sidebar': {
          store.toggleSidebar();
          break;
        }
        case 'upload': {
          this._emit('header:upload');
          break;
        }
        case 'notifications': {
          this._emit('header:notifications');
          break;
        }
        case 'toggle-theme': {
          const current = /** @type {string} */ (store.get('ui.theme') ?? 'dark');
          const next = current === 'dark' ? 'light' : 'dark';
          store.setTheme(next);
          this._updateThemeIcon(next);
          break;
        }
        case 'clear-search': {
          this.clearSearch();
          break;
        }
        case 'user-menu': {
          this._emit('header:user-menu');
          break;
        }
      }
    });

    /* Search input handling */
    if (this._searchInput) {
      this._searchInput.addEventListener('input', this._onSearchInput.bind(this));
      this._searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.clearSearch();
          this._searchInput?.blur();
        }
        if (e.key === 'Enter') {
          this._executeSearch();
        }
      });
      this._searchInput.addEventListener('focus', () => {
        this._el?.classList.add('header__search--focused');
      });
      this._searchInput.addEventListener('blur', () => {
        this._el?.classList.remove('header__search--focused');
      });
    }

    /* Debounced search */
    this._debouncedSearch = debounce((value) => {
      const q = String(value ?? '').trim();
      store.set('search.query', q);
      if (q.length >= 2) {
        this._emit('header:search', q);
      }
    }, CONFIG.DEBOUNCE_DELAY);

    /* Subscribe to theme changes */
    this._unsubscribers.push(
      store.subscribe('ui.theme', (theme) => {
        this._updateThemeIcon(String(theme));
      }),
    );

    /* Subscribe to search query changes from elsewhere */
    this._unsubscribers.push(
      store.subscribe('search.query', (query) => {
        const q = String(query ?? '');
        if (this._searchInput && this._searchInput.value !== q) {
          this._searchInput.value = q;
        }
        this._toggleClearButton(Boolean(q));
      }),
    );

    /* Subscribe to user changes */
    this._unsubscribers.push(
      store.subscribe('user', () => {
        this._render();
      }),
    );
  }

  /**
   * @param {Event} e
   */
  _onSearchInput(e) {
    const value = /** @type {HTMLInputElement} */ (e.target).value;
    this._toggleClearButton(Boolean(value));
    this._debouncedSearch(value);
  }

  _executeSearch() {
    this._debouncedSearch.flush();
    const q = /** @type {string} */ (store.get('search.query'));
    if (q && q.trim().length >= 2) {
      router.navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  clearSearch() {
    if (this._searchInput) {
      this._searchInput.value = '';
    }
    store.set('search.query', '');
    this._toggleClearButton(false);
    this._debouncedSearch.cancel();
  }

  /**
   * @param {boolean} visible
   */
  _toggleClearButton(visible) {
    const btn = this._el?.querySelector('[data-action="clear-search"]');
    if (btn) {
      btn.classList.toggle('header__search-clear--hidden', !visible);
    }
  }

  /**
   * @param {string} theme
   */
  _updateThemeIcon(theme) {
    const iconEl = this._el?.querySelector('.header__theme-icon');
    if (iconEl) {
      iconEl.innerHTML = theme === 'dark' ? MOON : SUN;
    }
  }

  /**
   * Emit a custom event for parent consumption.
   * @param {string} type
   * @param {unknown} [detail]
   */
  _emit(type, detail) {
    try {
      this.container.dispatchEvent(
        new CustomEvent(type, { bubbles: true, detail }),
      );
    } catch { /* ignore */ }
  }

  /* ---- destroy ---- */

  destroy() {
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { /* skip */ }
    }
    this._unsubscribers = [];
    if (this._debouncedSearch) {
      this._debouncedSearch.cancel();
    }
    if (this._searchInput) {
      this._searchInput.removeEventListener('input', this._onSearchInput);
    }
    this.container.innerHTML = '';
    this._el = null;
    this._searchInput = null;
  }

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
}
