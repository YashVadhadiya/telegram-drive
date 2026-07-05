import { store } from '../store.js';
import { router } from '../router.js';
import { api } from '../services/api.js';
import {
  TRASH, RESTORE, FOLDER, FILE, REFRESH,
} from '../constants/icons.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { formatFileSize, formatRelativeDate } from '../utils/format.js';

export class TrashPage {
  constructor() {
    this._items = [];
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

    const files = this._items.filter((i) => i.type === 'file');
    const folders = this._items.filter((i) => i.type === 'folder');
    const isEmpty = files.length === 0 && folders.length === 0;

    if (isEmpty) {
      return this._renderEmpty();
    }

    const grouped = this._groupByDate(this._items);

    return `
      <div class="trash-page" data-page="trash">
        <div class="page-header">
          <h1 class="page-header__title">
            <span class="page-header__icon">${TRASH}</span>
            Trash
          </h1>
          <button class="btn btn--danger" data-action="empty-trash">
            <span class="btn__icon">${TRASH}</span>
            Empty Trash
          </button>
        </div>

        <p class="trash__subtitle">Files and folders in trash are deleted after 30 days</p>

        <div class="trash__list" data-trash-list>
          ${Object.entries(grouped).map(([label, items]) => `
            <div class="trash__group">
              <h3 class="trash__group-label">${this._escapeHtml(label)}</h3>
              ${items.map((item) => this._renderItem(item)).join('')}
            </div>`).join('')}
        </div>
      </div>`;
  }

  async mount(container) {
    this._container = container;

    await this._loadTrash();
    this._bindEvents();

    this._unsubscribers.push(
      store.subscribe('trash', () => {
        const trash = store.get('trash');
        if (trash) {
          this._items = [
            ...(trash.folders || []).map((f) => ({ ...f, type: 'folder' })),
            ...(trash.files || []).map((f) => ({ ...f, type: 'file' })),
          ];
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

  async _loadTrash() {
    this._loading = true;
    this._error = null;
    this._reRender();

    try {
      const res = await api.get('/trash');
      if (res.success) {
        const data = res.data || {};
        const folders = data.folders || [];
        const files = data.files || [];
        this._items = [
          ...folders.map((f) => ({ ...f, type: 'folder' })),
          ...files.map((f) => ({ ...f, type: 'file' })),
        ];
        store.set('trash', { folders, files });
      } else {
        this._error = res.error || 'Failed to load trash';
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load trash';
    } finally {
      this._loading = false;
      this._reRender();
    }
  }

  _renderItem(item) {
    const id = item.id ?? '';
    const name = item.name || 'Untitled';
    const originalLocation = item.originalFolderName || item.folderName || 'Root';
    const deletedDate = item.deletedAt || item.updatedAt || item.createdAt;
    const size = typeof item.size === 'number' ? item.size : (item.totalSize || 0);
    const isFolder = item.type === 'folder';

    return `
      <div class="trash-item" data-trash-id="${id}" data-trash-type="${isFolder ? 'folder' : 'file'}">
        <span class="trash-item__icon">${isFolder ? FOLDER : FILE}</span>
        <div class="trash-item__info">
          <span class="trash-item__name" title="${this._escapeAttr(name)}">${this._escapeHtml(name)}</span>
          <span class="trash-item__meta">
            <span class="trash-item__location">${this._escapeHtml(originalLocation)}</span>
            ${!isFolder ? `<span class="trash-item__size">${formatFileSize(size)}</span>` : ''}
            <span class="trash-item__date">${deletedDate ? formatRelativeDate(deletedDate) : ''}</span>
          </span>
        </div>
        <div class="trash-item__actions">
          <button class="btn btn--sm" data-action="restore-item" data-trash-id="${id}" data-trash-type="${isFolder ? 'folder' : 'file'}" title="Restore">
            <span class="btn__icon">${RESTORE}</span>
            Restore
          </button>
          <button class="btn btn--sm btn--danger" data-action="delete-item" data-trash-id="${id}" data-trash-type="${isFolder ? 'folder' : 'file'}" title="Delete permanently">
            ${TRASH}
          </button>
        </div>
      </div>`;
  }

  _renderSkeleton() {
    return `
      <div class="trash-page">
        <div class="page-header">
          <h1 class="page-header__title">Trash</h1>
        </div>
        <div class="trash__list">
          ${Array.from({ length: 4 }, () => `
            <div class="skeleton skeleton--row"></div>`).join('')}
        </div>
      </div>`;
  }

  _renderError() {
    return `
      <div class="trash-page">
        <div class="page-header">
          <h1 class="page-header__title">Trash</h1>
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
      <div class="trash-page" data-page="trash">
        <div class="page-header">
          <h1 class="page-header__title">Trash</h1>
        </div>
        <div class="empty-state">
          <div class="empty-state__icon">${TRASH}</div>
          <h2 class="empty-state__title">Trash is empty</h2>
          <p class="empty-state__text">Deleted files and folders will appear here</p>
        </div>
      </div>`;
  }

  _groupByDate(items) {
    const groups = {};
    const now = Date.now();
    const dayMs = 86400000;

    for (const item of items) {
      const date = item.deletedAt || item.updatedAt || item.createdAt;
      let label = 'Older';
      if (date) {
        const diff = now - new Date(date).getTime();
        if (diff < dayMs) label = 'Today';
        else if (diff < 2 * dayMs) label = 'Yesterday';
        else if (diff < 7 * dayMs) label = 'Last 7 days';
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }

    const order = ['Today', 'Yesterday', 'Last 7 days', 'Older'];
    const sorted = {};
    for (const key of order) {
      if (groups[key]) sorted[key] = groups[key];
    }
    for (const key of Object.keys(groups)) {
      if (!order.includes(key)) sorted[key] = groups[key];
    }

    return sorted;
  }

  _bindEvents() {
    if (!this._container) return;
    this._container.addEventListener('click', this._boundClick);
  }

  _unbindEvents() {
    if (this._container) {
      this._container.removeEventListener('click', this._boundClick);
    }
  }

  _boundClick = async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');

    switch (action) {
      case 'restore-item': {
        const id = actionBtn.getAttribute('data-trash-id');
        const type = actionBtn.getAttribute('data-trash-type');
        if (id && type) await this._restoreItem(id, type);
        break;
      }
      case 'delete-item': {
        const id = actionBtn.getAttribute('data-trash-id');
        const type = actionBtn.getAttribute('data-trash-type');
        if (id && type) await this._permanentlyDelete(id, type);
        break;
      }
      case 'empty-trash': {
        const confirmed = await Modal.confirm(
          'Permanently delete all items in trash? This cannot be undone.',
          { confirmText: 'Empty Trash', confirmVariant: 'danger' },
        );
        if (confirmed) await this._emptyTrash();
        break;
      }
      case 'retry':
        await this._loadTrash();
        break;
    }
  };

  async _restoreItem(id, type) {
    const endpoint = type === 'folder' ? `/trash/restore/folder/${id}` : `/trash/restore/file/${id}`;
    const res = await api.post(endpoint);
    if (res.success) {
      toast.success('Item restored');
      await this._loadTrash();
    } else {
      toast.error(res.error || 'Failed to restore item');
    }
  }

  async _permanentlyDelete(id, type) {
    const confirmed = await Modal.confirm(
      'Permanently delete this item? This cannot be undone.',
      { confirmText: 'Delete', confirmVariant: 'danger' },
    );
    if (!confirmed) return;

    const endpoint = type === 'folder' ? `/folders/${id}` : `/files/${id}`;
    const res = await api.delete(endpoint);
    if (res.success) {
      toast.success('Item permanently deleted');
      await this._loadTrash();
    } else {
      toast.error(res.error || 'Failed to delete item');
    }
  }

  async _emptyTrash() {
    const res = await api.delete('/trash/empty');
    if (res.success) {
      toast.success('Trash emptied');
      this._items = [];
      this._reRender();
    } else {
      toast.error(res.error || 'Failed to empty trash');
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
