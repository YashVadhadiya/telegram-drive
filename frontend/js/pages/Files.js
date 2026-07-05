import { store } from '../store.js';
import { router } from '../router.js';
import { api } from '../services/api.js';
import { upload } from '../services/upload.js';
import {
  FOLDER, FILE, UPLOAD, PLUS, SEARCH, GRID, LIST,
  SORT_ASC, SORT_DESC, STAR, STAR_FILLED, DOWNLOAD,
  SHARE, TRASH, EDIT, MOVE, CHECK, CLOSE, MORE_VERTICAL,
  CHEVRON_RIGHT, REFRESH, LINK, FOLDER_OPEN,
} from '../constants/icons.js';
import { FileCard } from '../components/FileCard.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { formatFileSize, formatRelativeDate } from '../utils/format.js';

const FILE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'documents', label: 'Documents' },
  { id: 'audio', label: 'Audio' },
  { id: 'archives', label: 'Archives' },
];

export class FilesPage {
  constructor() {
    this.folderId = null;
    this._folder = null;
    this._files = [];
    this._filteredFiles = [];
    this._searchQuery = '';
    this._filterBy = 'all';
    this._sortBy = 'name';
    this._sortAsc = true;
    this._viewMode = 'grid';
    this._selectedIds = new Set();
    this._loading = true;
    this._error = null;
    this._container = null;
    this._unsubscribers = [];
    this._progressBars = new Map();
    this._uploadSection = null;
  }

  render() {
    if (this._loading) {
      return this._renderSkeleton();
    }
    if (this._error) {
      return this._renderError();
    }

    const folder = this._folder;
    const files = this._filteredFiles;
    const isEmpty = files.length === 0;
    const hasSelection = this._selectedIds.size > 0;

    return `
      <div class="files-page" data-page="files">
        <nav class="breadcrumb">
          <button class="breadcrumb__item" data-action="navigate" data-path="/">Dashboard</button>
          ${folder ? `
            <span class="breadcrumb__sep">${CHEVRON_RIGHT}</span>
            <span class="breadcrumb__item breadcrumb__item--current">${this._escapeHtml(folder.name || '')}</span>
          ` : ''}
        </nav>

        <div class="page-header">
          <h1 class="page-header__title">
            <span class="page-header__icon">${FOLDER_OPEN}</span>
            ${folder ? this._escapeHtml(folder.name || '') : 'Files'}
          </h1>
          <div class="page-header__actions">
            <button class="btn btn--primary" data-action="upload-files">
              <span class="btn__icon">${UPLOAD}</span>
              Upload
            </button>
            <button class="btn btn--icon" data-action="more-actions" aria-label="More actions">
              ${MORE_VERTICAL}
            </button>
          </div>
        </div>

        <div class="files__toolbar">
          <div class="files__search-wrap">
            <span class="files__search-icon">${SEARCH}</span>
            <input type="text" class="files__search-input" placeholder="Search in this folder..." data-search-input value="${this._escapeAttr(this._searchQuery)}" />
          </div>

          <div class="files__toolbar-actions">
            <div class="files__filter-chips">
              ${FILE_FILTERS.map((f) => `
                <button class="files__chip${f.id === this._filterBy ? ' files__chip--active' : ''}"
                        data-action="filter" data-filter="${f.id}">${f.label}</button>`).join('')}
            </div>

            <select class="files__sort-select" data-sort-select>
              <option value="name" ${this._sortBy === 'name' ? 'selected' : ''}>Name</option>
              <option value="size" ${this._sortBy === 'size' ? 'selected' : ''}>Size</option>
              <option value="date" ${this._sortBy === 'date' ? 'selected' : ''}>Date</option>
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

        ${hasSelection ? `
          <div class="selection-bar">
            <span class="selection-bar__count">${this._selectedIds.size} selected</span>
            <div class="selection-bar__actions">
              <button class="btn btn--sm" data-action="sel-download">${DOWNLOAD} Download</button>
              <button class="btn btn--sm" data-action="sel-move">${MOVE} Move</button>
              <button class="btn btn--sm" data-action="sel-favorite">${STAR} Favorite</button>
              <button class="btn btn--sm btn--danger" data-action="sel-delete">${TRASH} Delete</button>
              <button class="btn btn--sm" data-action="sel-clear">${CLOSE} Clear</button>
            </div>
          </div>` : ''}

        <input type="file" class="files__file-input" data-file-input multiple accept="*/*" style="display:none" />

        <div class="files__drop-zone" data-drop-zone>
          <span class="files__drop-icon">${UPLOAD}</span>
          <p>Drag & drop files here or click to browse</p>
        </div>

        ${isEmpty
          ? this._renderEmpty()
          : this._viewMode === 'grid'
            ? `<div class="file-grid" data-file-grid>
                ${files.map((f) => new FileCard({
                  ...f,
                  selected: this._selectedIds.has(String(f.id)),
                }, 'grid').render()).join('')}
               </div>`
            : `<div class="file-list" data-file-list>
                ${files.map((f) => new FileCard({
                  ...f,
                  selected: this._selectedIds.has(String(f.id)),
                }, 'list').render()).join('')}
               </div>`}

        <div class="files__upload-section" data-upload-section></div>
      </div>`;
  }

  async mount(container, params) {
    this._container = container;
    this.folderId = params?.id || 'root';

    await this._loadFiles();

    this._bindEvents();
    this._bindUploadEvents();

    if (this.folderId) {
      this._unsubscribers.push(
        store.subscribe('files', () => {
          this._files = [...(store.get('files') || [])];
          this._applyFilters();
          this._reRender();
        }),
      );
    }
  }

  unmount() {
    this._unbindEvents();
    this._unbindUploadEvents();
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { }
    }
    this._unsubscribers = [];
    this._container = null;
  }

  async _loadFiles() {
    this._loading = true;
    this._error = null;
    this._reRender();

    try {
      const res = await api.get(`/folders/${this.folderId}/files`);
      if (res.success) {
        const data = res.data || {};
        this._folder = data.folder || null;
        this._files = data.files || [];
        store.set('currentFolder', this._folder);
        store.set('files', this._files);
      } else {
        this._error = res.error || 'Failed to load files';
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load files';
    } finally {
      this._loading = false;
      this._applyFilters();
      this._reRender();
    }
  }

  _applyFilters() {
    let filtered = [...this._files];

    if (this._searchQuery.trim()) {
      const q = this._searchQuery.toLowerCase();
      filtered = filtered.filter((f) => (f.name || '').toLowerCase().includes(q));
    }

    if (this._filterBy !== 'all') {
      filtered = filtered.filter((f) => {
        const ext = this._extractExtension(f.name || '');
        const category = this._getCategory(ext);
        return category === this._filterBy;
      });
    }

    const sortFieldMap = { name: 'name', size: 'size', date: 'updatedAt' };
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

    this._filteredFiles = filtered;
  }

  _renderSkeleton() {
    return `
      <div class="files-page">
        <div class="breadcrumb">
          <span class="skeleton skeleton--text skeleton--w-16"></span>
        </div>
        <div class="page-header">
          <div class="skeleton skeleton--text skeleton--w-32"></div>
        </div>
        <div class="file-grid">
          ${Array.from({ length: 8 }, () => `
            <div class="file-card file-card--skeleton">
              <div class="skeleton skeleton--file-preview"></div>
              <div class="skeleton skeleton--text skeleton--w-20"></div>
              <div class="skeleton skeleton--text skeleton--w-12"></div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  _renderError() {
    return `
      <div class="files-page">
        <div class="breadcrumb">
          <button class="breadcrumb__item" data-action="navigate" data-path="/">Dashboard</button>
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
          <p class="empty-state__text">No files matching "${this._escapeHtml(this._searchQuery)}"</p>
        </div>`;
    }
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${FOLDER}</div>
        <h2 class="empty-state__title">This folder is empty</h2>
        <p class="empty-state__text">Upload files to get started</p>
        <button class="btn btn--primary" data-action="upload-files">
          <span class="btn__icon">${UPLOAD}</span>
          Upload files
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

    this._fileInput = this._container.querySelector('[data-file-input]');
    if (this._fileInput) {
      this._fileInput.addEventListener('change', this._boundFileInputChange);
    }

    this._dropZone = this._container.querySelector('[data-drop-zone]');
    if (this._dropZone) {
      this._dropZone.addEventListener('click', () => this._fileInput?.click());
      this._dropZone.addEventListener('dragover', this._boundDragOver);
      this._dropZone.addEventListener('dragleave', this._boundDragLeave);
      this._dropZone.addEventListener('drop', this._boundDrop);
    }
  }

  _unbindEvents() {
    if (!this._container) return;
    this._container.removeEventListener('click', this._boundClick);
    this._container.removeEventListener('dblclick', this._boundDblClick);

    if (this._searchInput) {
      this._searchInput.removeEventListener('input', this._boundSearchInput);
    }
    if (this._sortSelect) {
      this._sortSelect.removeEventListener('change', this._boundSortChange);
    }
    if (this._fileInput) {
      this._fileInput.removeEventListener('change', this._boundFileInputChange);
    }
    if (this._dropZone) {
      this._dropZone.removeEventListener('click', () => { });
      this._dropZone.removeEventListener('dragover', this._boundDragOver);
      this._dropZone.removeEventListener('dragleave', this._boundDragLeave);
      this._dropZone.removeEventListener('drop', this._boundDrop);
    }

    this._searchInput = null;
    this._sortSelect = null;
    this._fileInput = null;
    this._dropZone = null;
  }

  _boundClick = async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');
    const fileId = actionBtn.getAttribute('data-file-id');

    switch (action) {
      case 'upload-files':
        this._fileInput?.click();
        break;
      case 'open':
        if (fileId) router.navigate(`/media/${fileId}`);
        break;
      case 'select':
        if (fileId) this._toggleSelection(fileId);
        break;
      case 'favorite':
        if (fileId) await this._toggleFavorite(fileId);
        break;
      case 'context-menu':
        if (fileId) this._showFileContextMenu(actionBtn, fileId);
        break;
      case 'sel-clear':
        this._selectedIds.clear();
        this._reRender();
        break;
      case 'sel-delete':
        await this._deleteSelected();
        break;
      case 'sel-favorite':
        await this._favoriteSelected();
        break;
      case 'sel-download':
        this._downloadSelected();
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
      case 'filter':
        this._filterBy = actionBtn.getAttribute('data-filter') || 'all';
        this._applyFilters();
        this._reRender();
        break;
      case 'navigate': {
        const path = actionBtn.getAttribute('data-path');
        if (path) router.navigate(path);
        break;
      }
      case 'retry':
        await this._loadFiles();
        break;
      case 'more-actions':
        this._showFolderActions(actionBtn);
        break;
    }
  };

  _boundDblClick = (e) => {
    const card = e.target.closest('[data-file-id]');
    if (card) {
      const id = card.getAttribute('data-file-id');
      if (id) router.navigate(`/media/${id}`);
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

  _boundFileInputChange = () => {
    const files = this._fileInput?.files;
    if (files && files.length > 0) {
      this._uploadFiles(Array.from(files));
    }
    if (this._fileInput) this._fileInput.value = '';
  };

  _boundDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this._dropZone?.classList.add('files__drop-zone--active');
  };

  _boundDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this._dropZone?.classList.remove('files__drop-zone--active');
  };

  _boundDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this._dropZone?.classList.remove('files__drop-zone--active');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this._uploadFiles(Array.from(files));
    }
  };

  _toggleSelection(fileId) {
    const id = String(fileId);
    if (this._selectedIds.has(id)) {
      this._selectedIds.delete(id);
    } else {
      this._selectedIds.add(id);
    }
    this._reRender();
  }

  async _toggleFavorite(id) {
    const file = this._files.find((f) => String(f.id) === String(id));
    if (!file) return;

    const res = await api.patch(`/files/${id}/favorite`, { isFavorite: !file.isFavorite });
    if (res.success) {
      file.isFavorite = !file.isFavorite;
      store.set('files', [...this._files]);
      this._reRender();
    } else {
      toast.error(res.error || 'Failed to update favorite');
    }
  }

  async _deleteFile(id) {
    const confirmed = await Modal.confirm('Permanently delete this file?', { confirmVariant: 'danger' });
    if (!confirmed) return;

    const res = await api.delete(`/files/${id}`);
    if (res.success) {
      toast.success('File deleted');
      await this._loadFiles();
    } else {
      toast.error(res.error || 'Failed to delete file');
    }
  }

  async _renameFile(id) {
    const file = this._files.find((f) => String(f.id) === String(id));
    const name = await Modal.prompt('Rename file', file?.name || '');
    if (name && name.trim()) {
      const res = await api.put(`/files/${id}`, { name: name.trim() });
      if (res.success) {
        toast.success('File renamed');
        await this._loadFiles();
      } else {
        toast.error(res.error || 'Failed to rename file');
      }
    }
  }

  async _downloadFile(id) {
    const res = await api.get(`/files/${id}/download`);
    if (res.success && res.data?.url) {
      const a = document.createElement('a');
      a.href = res.data.url;
      a.download = '';
      a.click();
    } else {
      toast.error('Download link unavailable');
    }
  }

  async _shareFile(id) {
    const res = await api.post(`/share/${id}`);
    if (res.success && res.data?.link) {
      try {
        await navigator.clipboard.writeText(res.data.link);
        toast.success('Share link copied to clipboard');
      } catch {
        toast.info(`Share link: ${res.data.link}`);
      }
    } else {
      toast.error(res.error || 'Failed to create share link');
    }
  }

  async _deleteSelected() {
    const ids = Array.from(this._selectedIds);
    if (ids.length === 0) return;

    const confirmed = await Modal.confirm(`Delete ${ids.length} selected file${ids.length > 1 ? 's' : ''}?`, { confirmVariant: 'danger' });
    if (!confirmed) return;

    let successCount = 0;
    for (const id of ids) {
      const res = await api.delete(`/files/${id}`);
      if (res.success) successCount++;
    }

    this._selectedIds.clear();
    toast.success(`${successCount} file${successCount !== 1 ? 's' : ''} deleted`);
    await this._loadFiles();
  }

  async _favoriteSelected() {
    const ids = Array.from(this._selectedIds);
    for (const id of ids) {
      await api.patch(`/files/${id}/favorite`, { isFavorite: true });
    }
    this._selectedIds.clear();
    toast.success('Marked as favorites');
    await this._loadFiles();
  }

  _downloadSelected() {
    for (const id of Array.from(this._selectedIds)) {
      this._downloadFile(id);
    }
  }

  _uploadFiles(files) {
    for (const file of files) {
      this._startUpload(file);
    }
  }

  async _startUpload(file) {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (!this._uploadSection) {
      this._uploadSection = this._container?.querySelector('[data-upload-section]');
    }

    const progressBar = new ProgressBar(this._uploadSection || document.body);

    progressBar.render({
      id: uploadId,
      fileName: file.name,
      fileSize: file.size,
      bytesUploaded: 0,
      speed: 0,
      progress: 0,
      status: 'pending',
    });

    this._progressBars.set(uploadId, progressBar);

    const progressUnsub = upload.on('progress', (payload) => {
      if (payload.uploadId === uploadId) {
        progressBar.render({
          id: uploadId,
          fileName: file.name,
          fileSize: file.size,
          bytesUploaded: Math.round((payload.progress || 0) / 100 * file.size),
          speed: 0,
          progress: payload.progress || 0,
          status: 'uploading',
        });
      }
    });

    try {
      if (this._progressBars.has(uploadId)) {
        await upload.uploadFile(this.folderId || 'root', file);
      }
    } catch (err) {
      progressBar.render({
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        bytesUploaded: 0,
        speed: 0,
        progress: 0,
        status: 'failed',
      });
      toast.error(`Upload failed: ${file.name}`);
    } finally {
      progressUnsub();
      setTimeout(() => {
        const pb = this._progressBars.get(uploadId);
        if (pb) {
          pb.remove();
          this._progressBars.delete(uploadId);
        }
      }, 2000);
    }

    this._loadFiles();
  }

  _bindUploadEvents() {
    this._uploadUnsubs = [
      upload.on('complete', (payload) => {
        toast.success(`${payload.fileName} uploaded successfully`);
      }),
      upload.on('error', (payload) => {
        toast.error(payload.error || `Upload failed: ${payload.fileName}`);
      }),
    ];
  }

  _unbindUploadEvents() {
    if (this._uploadUnsubs) {
      for (const unsub of this._uploadUnsubs) {
        try { unsub(); } catch { }
      }
      this._uploadUnsubs = [];
    }
  }

  _showFileContextMenu(anchor, fileId) {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    const file = this._files.find((f) => String(f.id) === String(fileId));
    const rect = anchor.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.innerHTML = `
      <button class="context-menu__item" data-action="ctx-download" data-file-id="${fileId}">
        <span class="context-menu__icon">${DOWNLOAD}</span> Download
      </button>
      <button class="context-menu__item" data-action="ctx-share" data-file-id="${fileId}">
        <span class="context-menu__icon">${SHARE}</span> Share
      </button>
      <button class="context-menu__item" data-action="ctx-rename" data-file-id="${fileId}">
        <span class="context-menu__icon">${EDIT}</span> Rename
      </button>
      <button class="context-menu__item context-menu__item--danger" data-action="ctx-delete" data-file-id="${fileId}">
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
        const id = item.getAttribute('data-file-id');

        switch (action) {
          case 'ctx-download':
            await this._downloadFile(id);
            break;
          case 'ctx-share':
            await this._shareFile(id);
            break;
          case 'ctx-rename':
            await this._renameFile(id);
            break;
          case 'ctx-delete':
            await this._deleteFile(id);
            break;
        }
        close();
      });
      document.addEventListener('click', close);
    });
  }

  _showFolderActions(anchor) {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    const rect = anchor.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.innerHTML = `
      <button class="context-menu__item" data-action="ctx-rename-folder">
        <span class="context-menu__icon">${EDIT}</span> Rename folder
      </button>
      <button class="context-menu__item context-menu__item--danger" data-action="ctx-delete-folder">
        <span class="context-menu__icon">${TRASH}</span> Delete folder
      </button>`;

    document.body.appendChild(menu);

    const close = () => {
      menu.remove();
      document.removeEventListener('click', close);
    };

    const folderId = this.folderId;

    requestAnimationFrame(() => {
      menu.addEventListener('click', async (e) => {
        const item = e.target.closest('[data-action]');
        if (!item) return;
        const action = item.getAttribute('data-action');

        switch (action) {
          case 'ctx-rename-folder': {
            const name = await Modal.prompt('Rename folder', this._folder?.name || '');
            if (name && name.trim() && folderId) {
              const res = await api.put(`/folders/${folderId}`, { name: name.trim() });
              if (res.success) {
                toast.success('Folder renamed');
                await this._loadFiles();
              } else {
                toast.error(res.error || 'Failed to rename folder');
              }
            }
            break;
          }
          case 'ctx-delete-folder': {
            if (!folderId) break;
            const confirmed = await Modal.confirm('Delete this folder and all its contents?', { confirmVariant: 'danger' });
            if (confirmed) {
              const res = await api.delete(`/folders/${folderId}`);
              if (res.success) {
                toast.success('Folder deleted');
                router.navigate('/');
              } else {
                toast.error(res.error || 'Failed to delete folder');
              }
            }
            break;
          }
        }
        close();
      });
      document.addEventListener('click', close);
    });
  }

  _extractExtension(name) {
    if (!name) return '';
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  _getCategory(ext) {
    const image = ['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tiff', 'tif', 'webp'];
    const video = ['avi', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', 'wmv'];
    const audio = ['aac', 'flac', 'm4a', 'mid', 'midi', 'mp3', 'ogg', 'opus', 'wav', 'wma'];
    const documentExts = ['csv', 'doc', 'docx', 'epub', 'json', 'md', 'ods', 'odt', 'pdf', 'ppt', 'pptx', 'rtf', 'txt', 'xls', 'xlsx', 'xml'];
    const archive = ['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'xz', 'zip'];

    if (image.includes(ext)) return 'images';
    if (video.includes(ext)) return 'videos';
    if (audio.includes(ext)) return 'audio';
    if (documentExts.includes(ext)) return 'documents';
    if (archive.includes(ext)) return 'archives';
    return 'other';
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
