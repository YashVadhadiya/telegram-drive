import { store } from '../store.js';
import { router } from '../router.js';
import { api } from '../services/api.js';
import {
  STAR, FOLDER, FILE, SEARCH, SORT_ASC, SORT_DESC, REFRESH,
} from '../constants/icons.js';
import { FolderCard } from '../components/FolderCard.js';
import { FileCard } from '../components/FileCard.js';
import { formatFileSize } from '../utils/format.js';

export class FavoritesPage {
  constructor() {
    this._favorites = { folders: [], files: [] };
    this._searchQuery = '';
    this._sortBy = 'name';
    this._sortAsc = true;
    this._activeTab = 'all';
    this._loading = true;
    this._error = null;
    this._container = null;
    this._unsubscribers = [];
  }

  render() {
    if (this._loading) {
      return this._renderSkeleton();
    }
    if (this._error) {
      return this._renderError();
    }

    const folders = this._sortItems(this._favorites.folders || [], 'folder');
    const files = this._sortItems(this._favorites.files || [], 'file');

    const hasSearch = this._searchQuery.trim().length > 0;
    const filteredFolders = hasSearch ? this._filterItems(folders) : folders;
    const filteredFiles = hasSearch ? this._filterItems(files) : files;

    const showAll = this._activeTab === 'all';
    const showFolders = this._activeTab === 'folders' || (showAll && filteredFolders.length > 0);
    const showFiles = this._activeTab === 'files' || (showAll && filteredFiles.length > 0);

    const totalItems = folders.length + files.length;
    const isEmpty = totalItems === 0 && !hasSearch;
    const noResults = hasSearch && filteredFolders.length === 0 && filteredFiles.length === 0;

    if (isEmpty) {
      return this._renderEmpty();
    }

    return `
      <div class="favorites-page" data-page="favorites">
        <div class="page-header">
          <h1 class="page-header__title">
            <span class="page-header__icon">${STAR}</span>
            Favorites
          </h1>
        </div>

        <div class="favorites__toolbar">
          <div class="favorites__search-wrap">
            <span class="favorites__search-icon">${SEARCH}</span>
            <input type="text" class="favorites__search-input" placeholder="Search favorites..." data-search-input value="${this._escapeAttr(this._searchQuery)}" />
          </div>

          <div class="favorites__toolbar-actions">
            <div class="favorites__tabs">
              <button class="favorites__tab${this._activeTab === 'all' ? ' favorites__tab--active' : ''}" data-action="tab" data-tab="all">All</button>
              <button class="favorites__tab${this._activeTab === 'folders' ? ' favorites__tab--active' : ''}" data-action="tab" data-tab="folders">Folders (${folders.length})</button>
              <button class="favorites__tab${this._activeTab === 'files' ? ' favorites__tab--active' : ''}" data-action="tab" data-tab="files">Files (${files.length})</button>
            </div>
            <button class="btn btn--icon" data-action="toggle-sort" title="${this._sortAsc ? 'Ascending' : 'Descending'}">
              ${this._sortAsc ? SORT_ASC : SORT_DESC}
            </button>
          </div>
        </div>

        ${noResults
          ? `<div class="empty-state">
               <div class="empty-state__icon">${SEARCH}</div>
               <p class="empty-state__text">No favorites matching "${this._escapeHtml(this._searchQuery)}"</p>
             </div>`
          : ''}

        ${showFolders && filteredFolders.length > 0 ? `
          <div class="favorites__section">
            <h2 class="favorites__section-title">Folders</h2>
            <div class="folder-grid" data-folder-grid>
              ${filteredFolders.map((f) => new FolderCard(f).render()).join('')}
            </div>
          </div>` : ''}

        ${showFiles && filteredFiles.length > 0 ? `
          <div class="favorites__section">
            <h2 class="favorites__section-title">Files</h2>
            <div class="file-grid" data-file-grid>
              ${filteredFiles.map((f) => new FileCard(f, 'grid').render()).join('')}
            </div>
          </div>` : ''}
      </div>`;
  }

  async mount(container) {
    this._container = container;

    await this._loadFavorites();
    this._bindEvents();

    this._unsubscribers.push(
      store.subscribe('favorites', (val) => {
        if (val) {
          this._favorites = val;
          this._reRender();
        }
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

  async _loadFavorites() {
    this._loading = true;
    this._error = null;
    this._reRender();

    try {
      await store.loadFavorites();
      const favs = store.get('favorites');
      this._favorites = favs || { folders: [], files: [] };
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load favorites';
    } finally {
      this._loading = false;
      this._reRender();
    }
  }

  _filterItems(items) {
    if (!this._searchQuery.trim()) return items;
    const q = this._searchQuery.toLowerCase();
    return items.filter((item) => (item.name || '').toLowerCase().includes(q));
  }

  _sortItems(items, type) {
    const field = type === 'folder' ? 'name' : 'name';
    const asc = this._sortAsc;

    return [...items].sort((a, b) => {
      const aVal = a[field] || '';
      const bVal = b[field] || '';
      if (type === 'folder') {
        return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }

  _renderSkeleton() {
    return `
      <div class="favorites-page">
        <div class="page-header">
          <h1 class="page-header__title">Favorites</h1>
        </div>
        <div class="folder-grid">
          ${Array.from({ length: 4 }, () => `
            <div class="folder-card folder-card--skeleton">
              <div class="skeleton skeleton--folder-icon"></div>
              <div class="skeleton skeleton--text skeleton--w-20"></div>
            </div>`).join('')}
        </div>
        <div class="file-grid" style="margin-top:16px">
          ${Array.from({ length: 4 }, () => `
            <div class="file-card file-card--skeleton">
              <div class="skeleton skeleton--file-preview"></div>
              <div class="skeleton skeleton--text skeleton--w-20"></div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  _renderError() {
    return `
      <div class="favorites-page">
        <div class="page-header">
          <h1 class="page-header__title">Favorites</h1>
        </div>
        <div class="error-state">
          <span class="error-state__icon">${REFRESH}</span>
          <p class="error-state__text">${this._escapeHtml(this._error || 'Something went wrong')}</p>
          <button class="btn btn--primary" data-action="retry">Retry</button>
        </div>
      </div>`;
  }

  _renderEmpty() {
    return `
      <div class="favorites-page">
        <div class="page-header">
          <h1 class="page-header__title">Favorites</h1>
        </div>
        <div class="empty-state">
          <div class="empty-state__icon">${STAR}</div>
          <h2 class="empty-state__title">No favorites yet</h2>
          <p class="empty-state__text">Tap the star icon on files or folders to add them here</p>
        </div>
      </div>`;
  }

  _bindEvents() {
    if (!this._container) return;
    this._container.addEventListener('click', this._boundClick);
    this._container.addEventListener('dblclick', this._boundDblClick);

    this._searchInput = this._container.querySelector('[data-search-input]');
    if (this._searchInput) {
      this._searchInput.addEventListener('input', this._boundSearchInput);
    }
  }

  _unbindEvents() {
    if (this._container) {
      this._container.removeEventListener('click', this._boundClick);
      this._container.removeEventListener('dblclick', this._boundDblClick);
    }
    if (this._searchInput) {
      this._searchInput.removeEventListener('input', this._boundSearchInput);
    }
    this._searchInput = null;
  }

  _boundClick = (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');
    const folderId = actionBtn.getAttribute('data-folder-id');
    const fileId = actionBtn.getAttribute('data-file-id');
    const tab = actionBtn.getAttribute('data-tab');

    switch (action) {
      case 'tab':
        if (tab) {
          this._activeTab = tab;
          this._reRender();
        }
        break;
      case 'toggle-sort':
        this._sortAsc = !this._sortAsc;
        this._reRender();
        break;
      case 'open':
        if (folderId) router.navigate(`/folders/${folderId}/files`);
        if (fileId) router.navigate(`/media/${fileId}`);
        break;
      case 'favorite':
        if (fileId) this._removeFileFavorite(fileId);
        if (folderId) this._removeFolderFavorite(folderId);
        break;
      case 'retry':
        this._loadFavorites();
        break;
    }
  };

  _boundDblClick = (e) => {
    const target = e.target.closest('[data-folder-id], [data-file-id]');
    if (!target) return;
    const folderId = target.getAttribute('data-folder-id');
    const fileId = target.getAttribute('data-file-id');
    if (folderId) router.navigate(`/folders/${folderId}/files`);
    if (fileId) router.navigate(`/media/${fileId}`);
  };

  _boundSearchInput = () => {
    this._searchQuery = this._searchInput?.value || '';
    this._reRender();
  };

  async _removeFileFavorite(id) {
    const res = await api.patch(`/files/${id}/favorite`, { isFavorite: false });
    if (res.success) {
      this._favorites.files = (this._favorites.files || []).filter((f) => String(f.id) !== String(id));
      store.set('favorites', this._favorites);
      this._reRender();
    }
  }

  async _removeFolderFavorite(id) {
    const res = await api.patch(`/folders/${id}/favorite`, { isFavorite: false });
    if (res.success) {
      this._favorites.folders = (this._favorites.folders || []).filter((f) => String(f.id) !== String(id));
      store.set('favorites', this._favorites);
      this._reRender();
    }
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
