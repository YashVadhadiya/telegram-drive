/**
 * @file Search input with autocomplete / suggestions dropdown.
 * Debounced search, filter chips, keyboard navigation.
 */

import { store } from '../store.js';
import { router } from '../router.js';
import { SEARCH, CLOSE, FOLDER, FILE, CHEVRON_DOWN } from '../constants/icons.js';
import { debounce } from '../utils/debounce.js';
import { CONFIG } from '../constants/config.js';

/**
 * @typedef {Object} SearchResult
 * @property {number|string} id
 * @property {string} name
 * @property {'folder'|'file'} type
 * @property {string} [subtitle]
 */

/**
 * @typedef {Object} SearchBarOptions
 * @property {string} [placeholder='Search...']
 * @property {(query: string) => Promise<SearchResult[]>|SearchResult[]} [onSearch]
 * @property {number} [debounceMs=300]
 */

const FILTER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'folders', label: 'Folders' },
  { id: 'files', label: 'Files' },
];

export class SearchBar {
  /**
   * @param {HTMLElement} container
   * @param {SearchBarOptions} [options={}]
   */
  constructor(container, options = {}) {
    if (!container) throw new Error('SearchBar: container element is required');

    /** @type {HTMLElement} */
    this.container = container;

    /** @type {SearchBarOptions} */
    this.options = {
      placeholder: options.placeholder || 'Search...',
      onSearch: options.onSearch,
      debounceMs: options.debounceMs ?? CONFIG.DEBOUNCE_DELAY,
    };

    /** @type {HTMLElement|null} */
    this._el = null;

    /** @type {HTMLInputElement|null} */
    this._input = null;

    /** @type {HTMLElement|null} */
    this._suggestions = null;

    /** @type {SearchResult[]} */
    this._results = [];

    /** @type {string} */
    this._activeFilter = 'all';

    /** @type {number} */
    this._highlightedIndex = -1;

    /** @type {Array<() => void>} */
    this._unsubscribers = [];

    this._render();
    this._bindEvents();
  }

  _render() {
    this.container.innerHTML = `
      <div class="search-bar" data-component="search-bar">
        <div class="search-bar__input-wrap">
          <span class="search-bar__icon">${SEARCH}</span>
          <input type="text"
                 class="search-bar__input"
                 placeholder="${this._escapeAttr(this.options.placeholder || 'Search...')}"
                 autocomplete="off"
                 spellcheck="false"
                 data-search-input />
          <button class="search-bar__clear${this._input?.value ? '' : ' search-bar__clear--hidden'}"
                  data-action="clear"
                  aria-label="Clear search">
            ${CLOSE}
          </button>
        </div>

        <div class="search-bar__chips" data-chips>
          ${FILTER_CHIPS.map((chip) => `
            <button class="search-bar__chip${chip.id === this._activeFilter ? ' search-bar__chip--active' : ''}"
                    data-filter="${chip.id}"
                    data-action="filter">${chip.label}</button>`).join('')}
        </div>

        <div class="search-bar__dropdown search-bar__dropdown--hidden" data-suggestions></div>
      </div>`;

    this._el = this.container.querySelector('.search-bar');
    this._input = this._el?.querySelector('[data-search-input]');
    this._suggestions = this._el?.querySelector('[data-suggestions]');
  }

  _bindEvents() {
    if (!this._input) return;

    /* Input handling */
    this._input.addEventListener('input', (e) => {
      const value = /** @type {HTMLInputElement} */ (e.target).value;
      this._toggleClearButton(Boolean(value));
      this._debouncedSearch(value);
    });

    this._input.addEventListener('focus', () => {
      this._el?.classList.add('search-bar--focused');
      if (this._results.length > 0) {
        this._showDropdown();
      }
    });

    this._input.addEventListener('blur', () => {
      /* Delay to allow click on dropdown */
      setTimeout(() => {
        this._el?.classList.remove('search-bar--focused');
        if (!this._el?.matches(':focus-within')) {
          this._hideDropdown();
        }
      }, 200);
    });

    this._input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape':
          this.clear();
          this._input?.blur();
          break;
        case 'Enter':
          e.preventDefault();
          if (this._highlightedIndex >= 0 && this._highlightedIndex < this._results.length) {
            this._selectResult(this._results[this._highlightedIndex]);
          } else {
            this._executeSearch();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          this._highlightNext(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._highlightNext(-1);
          break;
      }
    });

    /* Click events via delegation */
    this._el?.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);

      /* Filter chips */
      const chip = target.closest('[data-action="filter"]');
      if (chip) {
        const filter = chip.getAttribute('data-filter') || 'all';
        this._setFilter(filter);
        return;
      }

      /* Clear button */
      const clearBtn = target.closest('[data-action="clear"]');
      if (clearBtn) {
        this.clear();
        return;
      }

      /* Dropdown items */
      const item = target.closest('[data-search-result]');
      if (item) {
        const idx = Number(item.getAttribute('data-search-result'));
        if (!Number.isNaN(idx) && this._results[idx]) {
          this._selectResult(this._results[idx]);
        }
        return;
      }
    });

    /* Debounced search */
    this._debouncedSearch = debounce((value) => {
      const q = String(value ?? '').trim();
      if (q.length < 2) {
        this._results = [];
        this._hideDropdown();
        return;
      }
      this._performSearch(q);
    }, this.options.debounceMs);

    /* Subscribe to search query from store */
    this._unsubscribers.push(
      store.subscribe('search.query', (query) => {
        const q = String(query ?? '');
        if (this._input && this._input.value !== q) {
          this._input.value = q;
          this._toggleClearButton(Boolean(q));
        }
      }),
    );
  }

  /* ---- public API ---- */

  /**
   * Programmatically set the search value.
   * @param {string} value
   */
  setValue(value) {
    if (this._input) {
      this._input.value = value ?? '';
      this._toggleClearButton(Boolean(value));
    }
  }

  /**
   * Focus the search input.
   */
  focus() {
    this._input?.focus();
  }

  /**
   * Clear input, results, and hide dropdown.
   */
  clear() {
    if (this._input) {
      this._input.value = '';
    }
    this._results = [];
    this._highlightedIndex = -1;
    this._hideDropdown();
    this._toggleClearButton(false);
    this._debouncedSearch?.cancel();
  }

  /* ---- internal ---- */

  /**
   * @param {string} value
   */
  _toggleClearButton(visible) {
    const btn = this._el?.querySelector('[data-action="clear"]');
    if (btn) {
      btn.classList.toggle('search-bar__clear--hidden', !visible);
    }
  }

  /**
   * @param {string} filter
   */
  _setFilter(filter) {
    this._activeFilter = filter;
    const chips = this._el?.querySelectorAll('[data-action="filter"]');
    if (chips) {
      for (const chip of chips) {
        chip.classList.toggle(
          'search-bar__chip--active',
          chip.getAttribute('data-filter') === filter,
        );
      }
    }
    /* Re-run search with current value */
    const q = this._input?.value ?? '';
    if (q.trim().length >= 2) {
      this._performSearch(q.trim());
    }
  }

  /**
   * @param {string} query
   */
  async _performSearch(query) {
    try {
      let results;

      if (typeof this.options.onSearch === 'function') {
        results = await this.options.onSearch(query);
      } else {
        results = this._defaultSearch(query);
      }

      /* Filter by active chip */
      if (this._activeFilter === 'folders') {
        results = results.filter((r) => r.type === 'folder');
      } else if (this._activeFilter === 'files') {
        results = results.filter((r) => r.type === 'file');
      }

      this._results = results.slice(0, 8);
      this._highlightedIndex = -1;

      if (this._results.length > 0 && this._el?.classList.contains('search-bar--focused')) {
        this._showDropdown();
      } else {
        this._hideDropdown();
      }
    } catch {
      this._results = [];
      this._hideDropdown();
    }
  }

  /**
   * Default search against store data.
   * @param {string} query
   * @returns {SearchResult[]}
   */
  _defaultSearch(query) {
    const q = query.toLowerCase();
    const results = [];

    const folders = /** @type {Array<Record<string, unknown>>} */ (store.get('folders') ?? []);
    for (const f of folders) {
      const name = String(f.name ?? '');
      if (name.toLowerCase().includes(q)) {
        results.push({
          id: String(f.id ?? ''),
          name,
          type: 'folder',
        });
      }
    }

    const files = /** @type {Array<Record<string, unknown>>} */ (store.get('files') ?? []);
    for (const f of files) {
      const name = String(f.name ?? '');
      if (name.toLowerCase().includes(q)) {
        results.push({
          id: String(f.id ?? ''),
          name,
          type: 'file',
          subtitle: formatFileSize(Number(f.size ?? 0)),
        });
      }
    }

    return results;
  }

  _executeSearch() {
    const q = this._input?.value?.trim() ?? '';
    if (q.length >= 2) {
      store.set('search.query', q);
      router.navigate(`/search?q=${encodeURIComponent(q)}`);
      this._hideDropdown();
    }
  }

  /**
   * @param {SearchResult} result
   */
  _selectResult(result) {
    this._hideDropdown();
    if (result.type === 'folder') {
      router.navigate(`/folders/${result.id}/files`);
    } else {
      router.navigate(`/files/${result.id}`);
    }
    if (this._input) {
      this._input.value = result.name;
    }
  }

  _showDropdown() {
    if (!this._suggestions) return;

    const itemsHtml = this._results.map((r, i) => {
      const icon = r.type === 'folder' ? FOLDER : FILE;
      const isHighlighted = i === this._highlightedIndex;
      return `<button class="search-bar__result${isHighlighted ? ' search-bar__result--highlighted' : ''}"
                      data-search-result="${i}"
                      type="button">
                <span class="search-bar__result-icon">${icon}</span>
                <span class="search-bar__result-info">
                  <span class="search-bar__result-name">${this._escapeHtml(r.name)}</span>
                  ${r.subtitle ? `<span class="search-bar__result-subtitle">${this._escapeHtml(r.subtitle)}</span>` : ''}
                </span>
              </button>`;
    }).join('');

    this._suggestions.innerHTML = itemsHtml;
    this._suggestions.classList.remove('search-bar__dropdown--hidden');
  }

  _hideDropdown() {
    if (this._suggestions) {
      this._suggestions.classList.add('search-bar__dropdown--hidden');
    }
  }

  /**
   * @param {number} direction
   */
  _highlightNext(direction) {
    if (this._results.length === 0) return;
    this._highlightedIndex = Math.max(
      0,
      Math.min(this._results.length - 1, this._highlightedIndex + direction),
    );
    this._updateHighlight();
  }

  _updateHighlight() {
    if (!this._suggestions) return;
    const items = this._suggestions.querySelectorAll('[data-search-result]');
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('search-bar__result--highlighted', i === this._highlightedIndex);
    }
    /* Scroll into view */
    const highlighted = this._suggestions.querySelector('.search-bar__result--highlighted');
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest' });
    }
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
    if (this._input) {
      this._input.removeEventListener('input', () => {});
    }
    this.container.innerHTML = '';
    this._el = null;
    this._input = null;
    this._suggestions = null;
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

  /**
   * @param {string} str
   * @returns {string}
   */
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
