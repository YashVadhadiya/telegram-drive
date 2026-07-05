import { store } from '../store.js';
import { router } from '../router.js';
import { api } from '../services/api.js';
import {
  FOLDER, PLUS, STAR, STAR_FILLED, SEARCH, GRID, LIST,
  SORT_ASC, SORT_DESC, MORE_VERTICAL, EDIT, TRASH, REFRESH,
} from '../constants/icons.js';
import { FolderCard } from '../components/FolderCard.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { formatFileSize } from '../utils/format.js';

export class FoldersPage {
  constructor() {
    this._unsubscribers = [];
    this._folders = [];
    this._filteredFolders = [];
    this._searchQuery = '';
    this._sortBy = 'name';
    this._sortAsc = true;
    this._viewMode = 'grid';
    this._loading = true;
    this._error = null;
    this._container = null;
  }

  render() {
    if (this._loading) {
      return this._renderSkeleton();
    }
    if (this._error) {
      return this._renderError();
    }

    const folders = this._filteredFolders;
    const isEmpty = folders.length === 0;

    return `
      <div class="folders-page" data-page="folders">
        <div class="page-header">
          <h1 class="page-header__title">Folders</h1>
          <button class="btn btn--primary" data-action="create-folder">
            <span class="btn__icon">${PLUS}</span>
            Create Folder
          </button>
        </div>

        <div class="folders__toolbar">
          <div class="folders__search-wrap">
            <span class="folders__search-icon">${SEARCH}</span>
            <input type="text" class="folders__search-input" placeholder="Search folders..." data-search-input value="${this._escapeAttr(this._searchQuery)}" />
          </div>

          <div class="folders__toolbar-actions">
            <select class="folders__sort-select" data-sort-select>
              <option value="name" ${this._sortBy === 'name' ? 'selected' : ''}>Name</option>
              <option value="date" ${this._sortBy === 'date' ? 'selected' : ''}>Date</option>
              <option value="size" ${this._sortBy === 'size' ? 'selected' : ''}>Size</option>
              <option value="count" ${this._sortBy === 'count' ? 'selected' : ''}>Files</option>
            </select>
            <button class="btn btn--icon" data-action="toggle-sort" title="${this._sortAsc ? 'Ascending' : 'Descending'}">
              ${this._sortAsc ? SORT_ASC : SORT_DESC}
            </button>
            <button class="btn btn--icon ${this._viewMode === 'grid' ? 'btn--active' : ''}" data-action="view-grid" title="Grid view">
              ${GRID}
            </button>
            <button class="btn btn--icon ${this._viewMode === 'list' ? 'btn--active' : ''}" data-action="view-list" title="List view">
              ${LIST}
            </button>
          </div>
        </div>

        ${isEmpty
          ? this._renderEmpty()
          : this._viewMode === 'grid'
            ? `<div class="folder-grid" data-folder-grid>
                ${folders.map((f) => new FolderCard(f).render()).join('')}
               </div>`
            : `<div class="folder-list" data-folder-list>
                ${folders.map((f) => this._renderListRow(f)).join('')}
               </div>`}
      </div>`;
  }

  async mount(container) {
    this._container = container;

    await this._loadFolders();

    this._bindEvents();
  }

  unmount() {
    this._unbindEvents();
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { }
    }
    this._unsubscribers = [];
    this._container = null;
  }

  async _loadFolders() {
    this._loading = true;
    this._error = null;
    this._reRender();

    try {
      const res = await api.get('/folders');
      if (res.success) {
        this._folders = res.data || [];
        store.set('folders', this._folders);
      } else {
        this._error = res.error || 'Failed to load folders';
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load folders';
    } finally {
      this._loading = false;
      this._applyFilters();
      this._reRender();
    }
  }

  _applyFilters() {
    let filtered = [...this._folders];

    if (this._searchQuery.trim()) {
      const q = this._searchQuery.toLowerCase();
      filtered = filtered.filter((f) => (f.name || '').toLowerCase().includes(q));
    }

    const sortFieldMap = {
      name: 'name',
      date: 'updatedAt',
      size: 'totalSize',
      count: 'itemCount',
    };
    const field = sortFieldMap[this._sortBy] || 'name';
    const asc = this._sortAsc;

    filtered.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === 'string') {
        return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return asc ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });

    this._filteredFolders = filtered;
  }

  _renderSkeleton() {
    return `
      <div class="folders-page">
        <div class="page-header">
          <h1 class="page-header__title">Folders</h1>
        </div>
        <div class="folder-grid">
          ${Array.from({ length: 6 }, () => `
            <div class="folder-card folder-card--skeleton">
              <div class="skeleton skeleton--folder-icon"></div>
              <div class="skeleton skeleton--text skeleton--w-20"></div>
              <div class="skeleton skeleton--text skeleton--w-16"></div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  _renderError() {
    return `
      <div class="folders-page">
        <div class="page-header">
          <h1 class="page-header__title">Folders</h1>
        </div>
        <div class="error-state">
          <span class="error-state__icon">${REFRESH}</span>
          <p class="error-state__text">${this._escapeHtml(this._error || 'Something went wrong')}</p>
          <button class="btn btn--primary" data-action="retry">Retry</button>
        </div>
      </div>`;
  }

  _renderEmpty() {
    const hasSearch = this._searchQuery.trim().length > 0;
    if (hasSearch) {
      return `
        <div class="empty-state">
          <div class="empty-state__icon">${SEARCH}</div>
          <p class="empty-state__text">No folders matching "${this._escapeHtml(this._searchQuery)}"</p>
        </div>`;
    }
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${FOLDER}</div>
        <h2 class="empty-state__title">No folders yet</h2>
        <p class="empty-state__text">Create your first folder to organize your files</p>
        <button class="btn btn--primary" data-action="create-folder">
          <span class="btn__icon">${PLUS}</span>
          Create your first folder
        </button>
      </div>`;
  }

  _renderListRow(f) {
    const id = f.id ?? '';
    const name = f.name || 'Untitled';
    const isFavorite = Boolean(f.isFavorite);
    const fileCount = typeof f.itemCount === 'number' ? f.itemCount : (typeof f.fileCount === 'number' ? f.fileCount : 0);
    const totalSize = typeof f.totalSize === 'number' ? f.totalSize : 0;
    const updatedAt = f.updatedAt ? new Date(f.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return `
      <div class="folder-list__row" data-folder-id="${id}" data-action="open" role="button" tabindex="0">
        <span class="folder-list__icon">${FOLDER}</span>
        <span class="folder-list__name" title="${this._escapeAttr(name)}">${this._escapeHtml(name)}</span>
        <span class="folder-list__count">${fileCount} item${fileCount !== 1 ? 's' : ''}</span>
        <span class="folder-list__size">${formatFileSize(totalSize)}</span>
        <span class="folder-list__date">${updatedAt}</span>
        <button class="folder-list__fav-btn${isFavorite ? ' folder-list__fav-btn--active' : ''}"
                data-action="favorite" data-folder-id="${id}" aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
          ${isFavorite ? STAR_FILLED : STAR}
        </button>
        <button class="folder-list__menu-btn" data-action="context-menu" data-folder-id="${id}" aria-label="More actions">
          ${MORE_VERTICAL}
        </button>
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
    this._sortSelect = this._container.querySelector('[data-sort-select]');
    if (this._sortSelect) {
      this._sortSelect.addEventListener('change', this._boundSortChange);
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
    if (this._sortSelect) {
      this._sortSelect.removeEventListener('change', this._boundSortChange);
    }
    this._searchInput = null;
    this._sortSelect = null;
  }

  _boundClick = async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');
    const folderId = actionBtn.getAttribute('data-folder-id');

    switch (action) {
      case 'create-folder':
        await this._showCreateFolderModal();
        break;
      case 'open':
        if (folderId) router.navigate(`/folders/${folderId}/files`);
        break;
      case 'favorite':
        if (folderId) await this._toggleFavorite(folderId);
        break;
      case 'context-menu':
        if (folderId) this._showContextMenu(actionBtn, folderId);
        break;
      case 'toggle-sort':
        this._sortAsc = !this._sortAsc;
        this._applyFilters();
        this._reRender();
        break;
      case 'view-grid':
        this._viewMode = 'grid';
        store.set('ui.viewMode', 'grid');
        this._reRender();
        break;
      case 'view-list':
        this._viewMode = 'list';
        store.set('ui.viewMode', 'list');
        this._reRender();
        break;
      case 'retry':
        await this._loadFolders();
        break;
    }
  };

  _boundDblClick = (e) => {
    const card = e.target.closest('[data-folder-id]');
    if (card) {
      const id = card.getAttribute('data-folder-id');
      if (id) router.navigate(`/folders/${id}/files`);
    }
  };

  _boundSearchInput = () => {
    this._searchQuery = this._searchInput?.value || '';
    this._applyFilters();
    this._reRender();
  };

  _boundSortChange = () => {
    this._sortBy = this._sortSelect?.value || 'name';
    this._applyFilters();
    this._reRender();
  };

  async _showCreateFolderModal() {
    const result = await Modal.prompt('Enter folder name');
    if (result && result.trim()) {
      await this._createFolder(result.trim());
    }
  }

  async _createFolder(name) {
    const res = await api.post('/folders', { name });
    if (res.success) {
      toast.success('Folder created successfully');
      await this._loadFolders();
    } else {
      toast.error(res.error || 'Failed to create folder');
    }
  }

  async _renameFolder(id, name) {
    const res = await api.put(`/folders/${id}`, { name });
    if (res.success) {
      toast.success('Folder renamed');
      await this._loadFolders();
    } else {
      toast.error(res.error || 'Failed to rename folder');
    }
  }

  async _deleteFolder(id) {
    const confirmed = await Modal.confirm('Are you sure you want to delete this folder and all its contents?', { confirmVariant: 'danger' });
    if (!confirmed) return;

    const res = await api.delete(`/folders/${id}`);
    if (res.success) {
      toast.success('Folder moved to trash');
      await this._loadFolders();
    } else {
      toast.error(res.error || 'Failed to delete folder');
    }
  }

  async _toggleFavorite(id) {
    const folder = this._folders.find((f) => String(f.id) === String(id));
    if (!folder) return;

    const res = await api.patch(`/folders/${id}/favorite`, { isFavorite: !folder.isFavorite });
    if (res.success) {
      folder.isFavorite = !folder.isFavorite;
      store.set('folders', [...this._folders]);
      this._applyFilters();
      this._reRender();
    } else {
      toast.error(res.error || 'Failed to update favorite');
    }
  }

  _showContextMenu(anchor, folderId) {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    const folder = this._folders.find((f) => String(f.id) === String(folderId));
    const rect = anchor.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    menu.innerHTML = `
      <button class="context-menu__item" data-action="ctx-rename" data-folder-id="${folderId}">
        <span class="context-menu__icon">${EDIT}</span> Rename
      </button>
      <button class="context-menu__item context-menu__item--danger" data-action="ctx-delete" data-folder-id="${folderId}">
        <span class="context-menu__icon">${TRASH}</span> Delete
      </button>`;

    document.body.appendChild(menu);

    const close = () => {
      menu.remove();
      document.removeEventListener('click', close);
    };

    requestAnimationFrame(() => {
      menu.addEventListener('click', async (e) => {
        const item = e.target.closest('[data-action]');
        if (!item) return;

        const action = item.getAttribute('data-action');
        const id = item.getAttribute('data-folder-id');

        if (action === 'ctx-rename') {
          const name = await Modal.prompt('Rename folder', folder?.name || '');
          if (name && name.trim()) {
            await this._renameFolder(id, name.trim());
          }
        } else if (action === 'ctx-delete') {
          await this._deleteFolder(id);
        }
        close();
      });
      document.addEventListener('click', close);
    });
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
