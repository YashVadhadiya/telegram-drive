import { store } from '../store.js';
import { router } from '../router.js';
import { api } from '../services/api.js';
import {
  CLOSE, CHEVRON_LEFT, CHEVRON_RIGHT, FILE, IMAGE, VIDEO, MUSIC,
  DOWNLOAD, SHARE, TRASH, STAR, STAR_FILLED, FILE_TEXT, REFRESH,
} from '../constants/icons.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { formatFileSize, formatDate } from '../utils/format.js';

export class MediaPage {
  constructor() {
    this.fileId = null;
    this._file = null;
    this._files = [];
    this._currentIndex = -1;
    this._loading = true;
    this._error = null;
    this._container = null;
    this._unsubscribers = [];
  }

  render() {
    if (this._loading) {
      return `
        <div class="media-page" data-page="media">
          <div class="media__loading">
            <div class="media__spinner"></div>
            <span>Loading media...</span>
          </div>
        </div>`;
    }

    if (this._error || !this._file) {
      return `
        <div class="media-page" data-page="media">
          <div class="error-state">
            <span class="error-state__icon">${REFRESH}</span>
            <p class="error-state__text">${this._escapeHtml(this._error || 'File not found')}</p>
            <button class="btn btn--primary" data-action="close-preview">Close</button>
          </div>
        </div>`;
    }

    const file = this._file;
    const ext = this._extractExtension(file.name || '');
    const previewType = this._getPreviewType(ext, file.mimeType || '');
    const hasPrev = this._currentIndex > 0;
    const hasNext = this._currentIndex < this._files.length - 1;

    return `
      <div class="media-page" data-page="media">
        <div class="media__overlay">
          <div class="media__top-bar">
            <button class="media__btn media__btn--close" data-action="close-preview" aria-label="Close">${CLOSE}</button>
            <div class="media__top-actions">
              <button class="media__btn" data-action="download-file" data-file-id="${file.id}" aria-label="Download">${DOWNLOAD}</button>
              <button class="media__btn" data-action="share-file" data-file-id="${file.id}" aria-label="Share">${SHARE}</button>
              <button class="media__btn media__btn--fav${file.isFavorite ? ' media__btn--active' : ''}" data-action="favorite-file" data-file-id="${file.id}" aria-label="Favorite">
                ${file.isFavorite ? STAR_FILLED : STAR}
              </button>
              <button class="media__btn media__btn--danger" data-action="delete-file" data-file-id="${file.id}" aria-label="Delete">${TRASH}</button>
            </div>
          </div>

          <div class="media__main">
            ${hasPrev ? `<button class="media__nav media__nav--prev" data-action="prev-file" aria-label="Previous">${CHEVRON_LEFT}</button>` : ''}

            <div class="media__content">
              ${this._renderPreview(file, previewType)}
            </div>

            ${hasNext ? `<button class="media__nav media__nav--next" data-action="next-file" aria-label="Next">${CHEVRON_RIGHT}</button>` : ''}
          </div>

          <div class="media__sidebar">
            <div class="media__meta">
              <h2 class="media__filename" title="${this._escapeAttr(file.name || '')}">${this._escapeHtml(file.name || '')}</h2>
              <div class="media__details">
                <div class="media__detail">
                  <span class="media__detail-label">Size</span>
                  <span class="media__detail-value">${formatFileSize(file.size || 0)}</span>
                </div>
                <div class="media__detail">
                  <span class="media__detail-label">Date</span>
                  <span class="media__detail-value">${file.createdAt ? formatDate(file.createdAt) : 'Unknown'}</span>
                </div>
                <div class="media__detail">
                  <span class="media__detail-label">Type</span>
                  <span class="media__detail-value">${ext.toUpperCase() || 'Unknown'}</span>
                </div>
                <div class="media__detail">
                  <span class="media__detail-label">Folder</span>
                  <span class="media__detail-value">${file.folderName || 'Root'}</span>
                </div>
              </div>
            </div>

            ${this._files.length > 1 ? `
              <div class="media__thumbnails">
                <h3 class="media__thumbnails-title">Gallery (${this._files.length})</h3>
                <div class="media__thumbnails-grid">
                  ${this._files.map((f, i) => `
                    <button class="media__thumb${i === this._currentIndex ? ' media__thumb--active' : ''}"
                            data-action="goto-file" data-index="${i}" title="${this._escapeAttr(f.name || '')}">
                      ${this._renderThumb(f)}
                    </button>`).join('')}
                </div>
              </div>` : ''}
          </div>
        </div>
      </div>`;
  }

  async mount(container, params) {
    this._container = container;
    this.fileId = params?.id;

    if (!this.fileId) {
      this._error = 'No file specified';
      this._loading = false;
      this._reRender();
      return;
    }

    document.body.classList.add('body--media-open');

    await this._loadMedia();

    this._bindEvents();
  }

  unmount() {
    document.body.classList.remove('body--media-open');
    this._unbindEvents();
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { }
    }
    this._unsubscribers = [];
    this._container = null;
  }

  async _loadMedia() {
    this._loading = true;
    this._error = null;
    this._reRender();

    try {
      const [fileRes, folderFilesRes] = await Promise.all([
        api.get(`/files/${this.fileId}`),
        api.get(`/folders/${this.fileId}/files`, { siblings: 'true' }),
      ]);

      if (fileRes.success) {
        this._file = fileRes.data;
        store.set('currentFile', this._file);
      } else {
        this._error = fileRes.error || 'Failed to load file';
        this._loading = false;
        this._reRender();
        return;
      }

      if (folderFilesRes.success) {
        const folderData = folderFilesRes.data || {};
        this._files = folderData.files || [];
      } else {
        this._files = [this._file];
      }

      this._currentIndex = this._files.findIndex((f) => String(f.id) === String(this.fileId));
      if (this._currentIndex === -1) {
        this._files.unshift(this._file);
        this._currentIndex = 0;
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load media';
    } finally {
      this._loading = false;
      this._reRender();
    }
  }

  _renderPreview(file, type) {
    const url = this._getFileUrl(file);

    switch (type) {
      case 'image':
        return this._renderImage(file, url);
      case 'video':
        return this._renderVideo(file, url);
      case 'audio':
        return this._renderAudio(file, url);
      case 'pdf':
        return this._renderPdf(file, url);
      case 'text':
        return this._renderText(file, url);
      default:
        return this._renderFallback(file);
    }
  }

  _renderImage(file, url) {
    return `
      <div class="media__image-container">
        <img class="media__image" src="${this._escapeAttr(url || '')}" alt="${this._escapeAttr(file.name || '')}" />
      </div>`;
  }

  _renderVideo(file, url) {
    return `
      <div class="media__video-container">
        <video class="media__video" controls autoplay preload="metadata">
          <source src="${this._escapeAttr(url || '')}" type="${this._escapeAttr(file.mimeType || 'video/mp4')}" />
          Your browser does not support video playback.
        </video>
      </div>`;
  }

  _renderAudio(file, url) {
    return `
      <div class="media__audio-container">
        <div class="media__audio-visualizer">
          ${Array.from({ length: 40 }, () => `<div class="media__audio-bar"></div>`).join('')}
        </div>
        <div class="media__audio-info">
          <span class="media__audio-name">${this._escapeHtml(file.name || '')}</span>
          <span class="media__audio-size">${formatFileSize(file.size || 0)}</span>
        </div>
        <audio class="media__audio" controls autoplay preload="metadata">
          <source src="${this._escapeAttr(url || '')}" type="${this._escapeAttr(file.mimeType || 'audio/mpeg')}" />
          Your browser does not support audio playback.
        </audio>
      </div>`;
  }

  _renderPdf(file, url) {
    return `
      <div class="media__pdf-container">
        <iframe class="media__pdf" src="${this._escapeAttr(url || '')}#navpanes=0" frameborder="0"></iframe>
      </div>`;
  }

  _renderText(file, url) {
    const textContent = this._textContent || 'Loading...';
    return `
      <div class="media__text-container">
        <pre class="media__text"><code>${this._escapeHtml(textContent)}</code></pre>
      </div>`;
  }

  _renderFallback(file) {
    return `
      <div class="media__fallback">
        <div class="media__fallback-icon">${FILE}</div>
        <h3 class="media__fallback-title">Preview not available</h3>
        <p class="media__fallback-text">This file type cannot be previewed. Please download it to view.</p>
        <button class="btn btn--primary" data-action="download-file" data-file-id="${file.id}">
          <span class="btn__icon">${DOWNLOAD}</span>
          Download
        </button>
      </div>`;
  }

  _renderThumb(file) {
    const ext = this._extractExtension(file.name || '');
    const type = this._getPreviewType(ext, file.mimeType || '');

    if (type === 'image' && file.thumbnailUrl) {
      return `<img class="media__thumb-img" src="${this._escapeAttr(String(file.thumbnailUrl))}" alt="" loading="lazy" />`;
    }
    return `<span class="media__thumb-icon">${IMAGE}</span>`;
  }

  async _loadTextContent(url) {
    if (!url) return;
    try {
      const res = await fetch(url);
      const text = await res.text();
      this._textContent = text;
      this._reRender();
    } catch {
      this._textContent = 'Failed to load text content';
      this._reRender();
    }
  }

  _bindEvents() {
    if (!this._container) return;
    this._container.addEventListener('click', this._boundClick);

    this._boundKeydown = (e) => {
      switch (e.key) {
        case 'Escape':
          this._close();
          break;
        case 'ArrowLeft':
          this._navigate(-1);
          break;
        case 'ArrowRight':
          this._navigate(1);
          break;
      }
    };
    document.addEventListener('keydown', this._boundKeydown);
  }

  _unbindEvents() {
    if (this._container) {
      this._container.removeEventListener('click', this._boundClick);
    }
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
    }
  }

  _boundClick = async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');
    const fileId = actionBtn.getAttribute('data-file-id');
    const index = actionBtn.getAttribute('data-index');

    switch (action) {
      case 'close-preview':
        this._close();
        break;
      case 'prev-file':
        this._navigate(-1);
        break;
      case 'next-file':
        this._navigate(1);
        break;
      case 'goto-file':
        if (index !== null) {
          const idx = parseInt(index, 10);
          const target = this._files[idx];
          if (target) {
            this._navigateTo(idx);
          }
        }
        break;
      case 'download-file':
        if (fileId) await this._downloadFile(fileId);
        break;
      case 'share-file':
        if (fileId) await this._shareFile(fileId);
        break;
      case 'favorite-file':
        if (fileId) await this._toggleFavorite(fileId);
        break;
      case 'delete-file':
        if (fileId) await this._deleteFile(fileId);
        break;
    }
  };

  _navigate(direction) {
    const newIndex = this._currentIndex + direction;
    if (newIndex >= 0 && newIndex < this._files.length) {
      this._navigateTo(newIndex);
    }
  }

  _navigateTo(index) {
    const file = this._files[index];
    if (file) {
      this.fileId = String(file.id);
      this._currentIndex = index;
      this._loadMedia();
    }
  }

  _close() {
    const prevRoute = this._getPreviousRoute();
    router.navigate(prevRoute || '/');
  }

  _getPreviousRoute() {
    const ref = document.referrer;
    if (ref && ref.includes(window.location.host)) {
      try {
        const url = new URL(ref);
        return url.hash.replace(/^#/, '') || '/';
      } catch { }
    }
    return null;
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

  async _toggleFavorite(id) {
    if (!this._file) return;
    const res = await api.patch(`/files/${id}/favorite`, { isFavorite: !this._file.isFavorite });
    if (res.success) {
      this._file.isFavorite = !this._file.isFavorite;
      this._reRender();
    } else {
      toast.error(res.error || 'Failed to update favorite');
    }
  }

  async _deleteFile(id) {
    const confirmed = await Modal.confirm('Delete this file permanently?', { confirmVariant: 'danger' });
    if (!confirmed) return;

    const res = await api.delete(`/files/${id}`);
    if (res.success) {
      toast.success('File deleted');
      this._close();
    } else {
      toast.error(res.error || 'Failed to delete file');
    }
  }

  _getFileUrl(file) {
    return file?.downloadUrl || file?.url || file?.fileId ? `/api/files/${file.fileId}/download` : '';
  }

  _getPreviewType(ext, mimeType) {
    if (!ext && mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
      if (mimeType === 'application/pdf') return 'pdf';
      if (mimeType.startsWith('text/')) return 'text';
      return 'other';
    }

    const image = ['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tiff', 'tif', 'webp'];
    const video = ['avi', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', 'wmv'];
    const audio = ['aac', 'flac', 'm4a', 'mid', 'midi', 'mp3', 'ogg', 'opus', 'wav', 'wma'];
    const textExts = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'c', 'cpp', 'cs', 'go', 'java', 'kt', 'less', 'php', 'py', 'rb', 'rs', 'sass', 'scss', 'sh', 'sql', 'swift', 'vue', 'yaml', 'yml', 'ini', 'cfg', 'log', 'env', 'gitignore', 'dockerfile'];

    if (image.includes(ext)) return 'image';
    if (video.includes(ext)) return 'video';
    if (audio.includes(ext)) return 'audio';
    if (ext === 'pdf') return 'pdf';
    if (textExts.includes(ext)) return 'text';
    return 'other';
  }

  _extractExtension(name) {
    if (!name) return '';
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  _reRender() {
    if (!this._container) return;
    const html = this.render();
    this._container.innerHTML = html;

    if (!this._loading && this._file) {
      const ext = this._extractExtension(this._file.name || '');
      const type = this._getPreviewType(ext, this._file.mimeType || '');
      if (type === 'text') {
        const url = this._getFileUrl(this._file);
        this._loadTextContent(url);
      }
    }
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
