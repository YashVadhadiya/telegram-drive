import { store } from '../store.js';
import { router } from '../router.js';
import { api } from '../services/api.js';
import {
  HARD_DRIVE, FILE, FOLDER, UPLOAD, CLOCK, STAR,
  DOWNLOAD, TRASH, SHARE, EDIT, REFRESH,
} from '../constants/icons.js';
import { FileCard } from '../components/FileCard.js';
import { formatFileSize, formatRelativeDate } from '../utils/format.js';

export class DashboardPage {
  constructor() {
    this._unsubscribers = [];
    this._stats = null;
    this._recentFiles = [];
    this._activity = [];
    this._largestFiles = [];
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

    const stats = this._stats || {};
    const recentFiles = this._recentFiles || [];
    const activity = this._activity || [];
    const largestFiles = this._largestFiles || [];

    const isWelcome = !stats.totalFiles && !stats.totalFolders && recentFiles.length === 0;

    if (isWelcome) {
      return this._renderEmpty();
    }

    return `
      <div class="dashboard-page" data-page="dashboard">
        <div class="page-header">
          <h1 class="page-header__title">Dashboard</h1>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--storage">${HARD_DRIVE}</div>
            <div class="stat-card__info">
              <span class="stat-card__value">${formatFileSize(stats.usedStorage || 0)}</span>
              <span class="stat-card__label">of Unlimited</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--files">${FILE}</div>
            <div class="stat-card__info">
              <span class="stat-card__value">${this._formatNumber(stats.totalFiles || 0)}</span>
              <span class="stat-card__label">files uploaded</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--folders">${FOLDER}</div>
            <div class="stat-card__info">
              <span class="stat-card__value">${this._formatNumber(stats.totalFolders || 0)}</span>
              <span class="stat-card__label">folders</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--uploads">${UPLOAD}</div>
            <div class="stat-card__info">
              <span class="stat-card__value">${this._formatNumber(stats.recentUploads || 0)}</span>
              <span class="stat-card__label">this week</span>
            </div>
          </div>
        </div>

        <div class="dashboard__grid">
          <div class="dashboard__section dashboard__section--activity">
            <h2 class="dashboard__section-title">Recent Activity</h2>
            <div class="activity-timeline">
              ${activity.length > 0
                ? activity.map((a) => this._renderActivityItem(a)).join('')
                : '<p class="dashboard__empty-text">No recent activity</p>'}
            </div>
          </div>

          <div class="dashboard__section dashboard__section--largest">
            <h2 class="dashboard__section-title">Largest Files</h2>
            <div class="largest-files">
              ${largestFiles.length > 0
                ? largestFiles.map((f) => this._renderLargestFile(f)).join('')
                : '<p class="dashboard__empty-text">No files yet</p>'}
            </div>
          </div>
        </div>

        <div class="dashboard__section dashboard__section--recent">
          <h2 class="dashboard__section-title">Recent Files</h2>
          ${recentFiles.length > 0
            ? `<div class="dashboard__recent-scroll" data-recent-scroll>
                ${recentFiles.map((f) => new FileCard(f, 'grid').render()).join('')}
               </div>`
            : '<p class="dashboard__empty-text">No files uploaded yet</p>'}
        </div>
      </div>`;
  }

  async mount(container) {
    this._container = container;
    this._loading = true;
    this._reRender();

    await this._loadData();

    const scrollEl = container.querySelector('[data-recent-scroll]');
    if (scrollEl) {
      scrollEl.addEventListener('click', (e) => this._handleFileClick(e));
    }

    container.addEventListener('click', (e) => {
      const retryBtn = e.target.closest('[data-action="retry"]');
      if (retryBtn) {
        this._loadData();
      }
    });

    this._unsubscribers.push(
      store.subscribe('user', () => {
        if (store.get('user')) {
          this._loadData();
        }
      }),
    );
  }

  unmount() {
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { }
    }
    this._unsubscribers = [];
    this._container = null;
  }

  async _loadData() {
    this._loading = true;
    this._error = null;
    this._reRender();

    try {
      const [statsRes, recentRes, activityRes, largestRes] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/files/recent', { limit: 10 }),
        api.get('/activity', { limit: 10 }),
        api.get('/files/largest', { limit: 5 }),
      ]);

      if (statsRes.success) {
        this._stats = statsRes.data;
        store.set('stats', statsRes.data);
      }
      if (recentRes.success) {
        this._recentFiles = recentRes.data || [];
      }
      if (activityRes.success) {
        this._activity = activityRes.data || [];
      }
      if (largestRes.success) {
        this._largestFiles = largestRes.data || [];
      }

      this._loading = false;
    } catch (err) {
      this._loading = false;
      this._error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    }

    this._reRender();
  }

  _reRender() {
    if (!this._container) return;
    const html = this.render();
    this._container.innerHTML = html;
  }

  _renderSkeleton() {
    return `
      <div class="dashboard-page" data-page="dashboard">
        <div class="page-header">
          <h1 class="page-header__title">Dashboard</h1>
        </div>
        <div class="stats-grid">
          ${Array.from({ length: 4 }, () => `
            <div class="stat-card stat-card--skeleton">
              <div class="skeleton skeleton--circle"></div>
              <div class="stat-card__info">
                <div class="skeleton skeleton--text skeleton--w-24"></div>
                <div class="skeleton skeleton--text skeleton--w-16"></div>
              </div>
            </div>`).join('')}
        </div>
        <div class="dashboard__grid">
          <div class="dashboard__section">
            <div class="skeleton skeleton--text skeleton--w-32"></div>
            ${Array.from({ length: 4 }, () => `
              <div class="skeleton skeleton--row"></div>`).join('')}
          </div>
          <div class="dashboard__section">
            <div class="skeleton skeleton--text skeleton--w-32"></div>
            ${Array.from({ length: 4 }, () => `
              <div class="skeleton skeleton--row"></div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  _renderError() {
    return `
      <div class="dashboard-page" data-page="dashboard">
        <div class="page-header">
          <h1 class="page-header__title">Dashboard</h1>
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
      <div class="dashboard-page" data-page="dashboard">
        <div class="page-header">
          <h1 class="page-header__title">Dashboard</h1>
        </div>
        <div class="empty-state">
          <div class="empty-state__icon">${UPLOAD}</div>
          <h2 class="empty-state__title">Welcome to Telegram Drive!</h2>
          <p class="empty-state__text">Upload your first file to get started</p>
          <button class="btn btn--primary" data-action="upload-first" data-navigate="/files/root">Upload your first file</button>
        </div>
      </div>`;
  }

  _renderActivityItem(a) {
    const iconMap = {
      upload: UPLOAD,
      download: DOWNLOAD,
      delete: TRASH,
      rename: EDIT,
      share: SHARE,
      favorite: STAR,
    };
    const icon = iconMap[a.type] || CLOCK;

    return `
      <div class="activity-item">
        <span class="activity-item__icon">${icon}</span>
        <div class="activity-item__content">
          <span class="activity-item__desc">${this._escapeHtml(a.description || '')}</span>
          <span class="activity-item__time">${a.createdAt ? formatRelativeDate(a.createdAt) : ''}</span>
        </div>
      </div>`;
  }

  _renderLargestFile(f) {
    const ext = this._extractExtension(f.name);
    return `
      <div class="largest-file-item" data-file-id="${f.id}" data-action="open-file">
        <span class="largest-file-item__icon file-type-icon file-type-icon--${ext || 'default'}">${FILE}</span>
        <div class="largest-file-item__info">
          <span class="largest-file-item__name" title="${this._escapeHtml(f.name)}">${this._escapeHtml(f.name)}</span>
          <span class="largest-file-item__meta">
            ${f.folderName ? `<span class="largest-file-item__folder">${this._escapeHtml(f.folderName)}</span>` : ''}
            <span>${formatFileSize(f.size || 0)}</span>
          </span>
        </div>
      </div>`;
  }

  _handleFileClick(e) {
    const card = e.target.closest('[data-file-id]');
    if (card) {
      const fileId = card.getAttribute('data-file-id');
      if (fileId) {
        router.navigate(`/files/${fileId}`);
      }
    }
  }

  _extractExtension(name) {
    if (!name) return '';
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  _formatNumber(n) {
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('en-US');
  }

  _escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}
