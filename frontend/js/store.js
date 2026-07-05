/**
 * @file Reactive state management using the Observer pattern.
 *
 * The store holds the entire application state in a single tree.
 * Components subscribe to specific paths and are notified when those
 * paths change. Nested paths use dot notation (e.g. `ui.theme`).
 */

import { CONFIG } from './constants/config.js';
import { api } from './services/api.js';

/* ------------------------------------------------------------------ */
/*  Typedefs                                                          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} firstName
 * @property {string} [lastName]
 * @property {string} [username]
 * @property {string} [photoUrl]
 * @property {number} authDate
 * @property {string} [languageCode]
 * @property {number} [storageUsed]
 * @property {number} [storageLimit]
 */

/**
 * @typedef {Object} Folder
 * @property {number} id
 * @property {string} name
 * @property {number|null} parentId
 * @property {number} ownerId
 * @property {number} itemCount
 * @property {number} totalSize
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} FileEntry
 * @property {number} id
 * @property {string} name
 * @property {string} mimeType
 * @property {number} size
 * @property {number|null} folderId
 * @property {number} ownerId
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} [fileId]
 * @property {string} [thumbnailUrl]
 * @property {boolean} [isFavorite]
 * @property {boolean} [isTrashed]
 */

/**
 * @typedef {Object} Stats
 * @property {number} totalFiles
 * @property {number} totalFolders
 * @property {number} totalSize
 * @property {number} usedStorage
 * @property {number} storageLimit
 * @property {number} trashSize
 */

/**
 * @typedef {Object} UploadItem
 * @property {string} uploadId
 * @property {string} fileName
 * @property {number} progress
 * @property {'pending'|'uploading'|'paused'|'completed'|'error'|'cancelled'} status
 * @property {string} [error]
 */

/**
 * @typedef {Object} Toast
 * @property {string} id
 * @property {string} message
 * @property {'info'|'success'|'warning'|'error'} type
 * @property {number} [duration]
 */

/**
 * @typedef {Object} Modal
 * @property {string} component
 * @property {Record<string, unknown>} [props]
 */

/**
 * @typedef {Object} UIState
 * @property {string} theme
 * @property {boolean} sidebarOpen
 * @property {'grid'|'list'} viewMode
 * @property {boolean} loading
 * @property {UploadItem[]} uploads
 * @property {Toast[]} toasts
 * @property {Modal[]} modals
 */

/**
 * @typedef {Object} SearchState
 * @property {string} query
 * @property {Array<Folder|FileEntry>} results
 */

/**
 * @typedef {Object} FavoritesData
 * @property {Folder[]} folders
 * @property {FileEntry[]} files
 */

/**
 * @typedef {Object} TrashData
 * @property {Folder[]} folders
 * @property {FileEntry[]} files
 */

/**
 * @typedef {Object} AppState
 * @property {User|null} user
 * @property {Folder[]} folders
 * @property {Folder|null} currentFolder
 * @property {FileEntry[]} files
 * @property {FileEntry|null} currentFile
 * @property {FavoritesData} favorites
 * @property {TrashData} trash
 * @property {Stats|null} stats
 * @property {Record<string, unknown>} settings
 * @property {SearchState} search
 * @property {UIState} ui
 */

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

class Store {
  constructor() {
    /** @type {AppState} */
    this.state = {
      user: null,
      folders: [],
      currentFolder: null,
      files: [],
      currentFile: null,
      favorites: { folders: [], files: [] },
      trash: { folders: [], files: [] },
      stats: null,
      settings: {},
      search: { query: '', results: [] },
      ui: {
        theme: 'dark',
        sidebarOpen: true,
        viewMode: 'grid',
        loading: false,
        uploads: [],
        toasts: [],
        modals: [],
      },
    };

    /** @type {Map<string, Set<(value: unknown, oldValue: unknown) => void>>} */
    this.listeners = new Map();

    /* Restore persisted UI preferences */
    this._restoreUiPreferences();
  }

  /* ---- read ---- */

  /**
   * Read a value from the state tree by dot-separated path.
   *
   * @param {string} key - e.g. `'ui.theme'` or `'folders'`
   * @returns {unknown}
   */
  get(key) {
    const keys = key.split('.');
    let current = /** @type {unknown} */ (this.state);
    for (const k of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = /** @type {Record<string, unknown>} */ (current)[k];
    }
    return current;
  }

  /* ---- write ---- */

  /**
   * Update a value in the state tree and notify subscribers.
   *
   * For plain-object values at the target key, performs a shallow merge
   * with the existing value. Array and primitive values are replaced entirely.
   *
   * @param {string} key - Dot-separated path
   * @param {unknown} value
   */
  set(key, value) {
    const keys = key.split('.');
    let current = /** @type {Record<string, unknown>} */ (this.state);

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = /** @type {Record<string, unknown>} */ (current[keys[i]]);
    }

    const lastKey = keys[keys.length - 1];
    const oldValue = current[lastKey];

    /* Shallow merge for plain objects */
    if (
      oldValue !== null && oldValue !== undefined && typeof oldValue === 'object' && !Array.isArray(oldValue) &&
      value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
    ) {
      current[lastKey] = { .../** @type {Record<string, unknown>} */ (oldValue), .../** @type {Record<string, unknown>} */ (value) };
    } else {
      current[lastKey] = value;
    }

    const newValue = current[lastKey];

    /* Notify subscribers on the exact path and all ancestors */
    const parts = key.split('.');
    for (let i = parts.length; i > 0; i--) {
      this._notify(parts.slice(0, i).join('.'), newValue, oldValue);
    }
    this._notify('', newValue, oldValue);
  }

  /* ---- subscribe ---- */

  /**
   * Subscribe to changes on a specific path.
   *
   * The callback receives the **new value** and the **old value**.
   *
   * @param {string} key - Dot-separated path (empty string for all changes)
   * @param {(value: unknown, oldValue: unknown) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(key, listener) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = /** @type {Set<(value: unknown, oldValue: unknown) => void>} */ (this.listeners.get(key));
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  /**
   * Notify all subscribers for a given key.
   * @param {string} key
   * @param {unknown} newValue
   * @param {unknown} oldValue
   */
  _notify(key, newValue, oldValue) {
    const set = this.listeners.get(key);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(newValue, oldValue);
      } catch {
        /* subscriber error — do not break the loop */
      }
    }
  }

  /* ---- UI preferences persistence ---- */

  /** Restore theme, sidebar, and viewMode from localStorage. */
  _restoreUiPreferences() {
    try {
      const theme = localStorage.getItem(CONFIG.THEME_STORAGE_KEY);
      if (theme === 'light' || theme === 'dark') {
        this.state.ui.theme = theme;
      }
    } catch { /* ignore */ }

    try {
      const sidebar = localStorage.getItem(CONFIG.SIDEBAR_STATE_KEY);
      if (sidebar !== null) {
        this.state.ui.sidebarOpen = sidebar === 'true';
      }
    } catch { /* ignore */ }
  }

  /* ---- data loading actions ---- */

  /**
   * Set the global loading flag.
   * @param {boolean} loading
   */
  setLoading(loading) {
    this.set('ui.loading', loading);
  }

  /**
   * Load all folders from the API.
   * @returns {Promise<void>}
   */
  async loadFolders() {
    this.setLoading(true);
    try {
      const res = await api.get('/folders');
      if (res.success) {
        this.set('folders', /** @type {Folder[]} */ (res.data ?? []));
      }
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Load files for a given folder.
   * @param {number|string} folderId - Use `'root'` for root
   * @returns {Promise<void>}
   */
  async loadFiles(folderId) {
    this.setLoading(true);
    try {
      const res = await api.get(`/folders/${folderId}/files`);
      if (res.success) {
        const data = /** @type {{ folder: Folder, files: FileEntry[] }} */ (res.data);
        if (data.folder) this.set('currentFolder', data.folder);
        this.set('files', data.files ?? []);
      }
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Load storage statistics.
   * @returns {Promise<void>}
   */
  async loadStats() {
    try {
      const res = await api.get('/stats/overview');
      if (res.success) {
        this.set('stats', /** @type {Stats} */ (res.data));
      }
    } catch { /* best-effort */ }
  }

  /**
   * Load the user's favourites.
   * @returns {Promise<void>}
   */
  async loadFavorites() {
    try {
      const res = await api.get('/favorites');
      if (res.success) {
        this.set('favorites', /** @type {FavoritesData} */ (res.data ?? { folders: [], files: [] }));
      }
    } catch { /* best-effort */ }
  }

  /**
   * Load the trash contents.
   * @returns {Promise<void>}
   */
  async loadTrash() {
    this.setLoading(true);
    try {
      const res = await api.get('/trash');
      if (res.success) {
        this.set('trash', /** @type {TrashData} */ (res.data ?? { folders: [], files: [] }));
      }
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Load user settings.
   * @returns {Promise<void>}
   */
  async loadSettings() {
    try {
      const res = await api.get('/settings');
      if (res.success) {
        this.set('settings', /** @type {Record<string, unknown>} */ (res.data ?? {}));
      }
    } catch { /* best-effort */ }
  }

  /* ---- UI actions ---- */

  /**
   * Set the theme and persist to localStorage.
   * @param {'light'|'dark'} theme
   */
  setTheme(theme) {
    this.set('ui.theme', theme);
    try {
      localStorage.setItem(CONFIG.THEME_STORAGE_KEY, theme);
    } catch { /* ignore */ }
  }

  /** Toggle the sidebar open/closed. */
  toggleSidebar() {
    const current = /** @type {boolean} */ (this.get('ui.sidebarOpen'));
    this.set('ui.sidebarOpen', !current);
    try {
      localStorage.setItem(CONFIG.SIDEBAR_STATE_KEY, String(!current));
    } catch { /* ignore */ }
  }

  /**
   * Set the view mode for file listings.
   * @param {'grid'|'list'} mode
   */
  setViewMode(mode) {
    this.set('ui.viewMode', mode);
  }

  /* ---- toasts ---- */

  /**
   * Show a toast notification. Auto-dismisses after `duration` ms (default 4000).
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} [type='info']
   * @param {number} [duration=4000]
   */
  showToast(message, type = 'info', duration = 4000) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    /** @type {Toast} */
    const toast = { id, message, type, duration };

    const currentToasts = /** @type {Toast[]} */ (this.get('ui.toasts')) ?? [];
    this.set('ui.toasts', [...currentToasts, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismissToast(id), duration);
    }
  }

  /**
   * Remove a toast by ID.
   * @param {string} id
   */
  dismissToast(id) {
    const toasts = /** @type {Toast[]} */ (this.get('ui.toasts')) ?? [];
    this.set('ui.toasts', toasts.filter((t) => t.id !== id));
  }

  /* ---- modals ---- */

  /**
   * Show a modal with the given component and props.
   * @param {string} component - Component name (matches a registered component)
   * @param {Record<string, unknown>} [props]
   */
  showModal(component, props) {
    this.set('ui.modals', [{ component, props: props ?? {} }]);
  }

  /** Close the currently open modal. */
  closeModal() {
    this.set('ui.modals', []);
  }
}

/** @type {Store} */
export const store = new Store();
