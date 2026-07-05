/**
 * @file Upload progress bar component.
 * Renders a file upload item with progress, speed, ETA, and cancel.
 */

import { FILE, CLOSE, CHECK, ALERT_CIRCLE } from '../constants/icons.js';
import { formatFileSize, formatSpeed } from '../utils/format.js';

/**
 * @typedef {Object} UploadData
 * @property {string|number} id
 * @property {string} [fileName]
 * @property {number} [fileSize]
 * @property {number} [bytesUploaded]
 * @property {number} [speed]
 * @property {string} [status] - 'uploading'|'paused'|'completed'|'failed'|'cancelled'
 * @property {number} [progress]
 */

export class ProgressBar {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    if (!container) throw new Error('ProgressBar: container element is required');
    /** @type {HTMLElement} */
    this.container = container;

    /** @type {HTMLElement|null} */
    this._el = null;

    /** @type {string|null} */
    this._currentId = null;
  }

  /**
   * Render or update a progress bar for the given upload data.
   * @param {UploadData} uploadData
   */
  render(uploadData) {
    if (!uploadData) return;

    const id = uploadData.id ?? '';
    const fileName = uploadData.fileName || 'Unknown file';
    const fileSize = typeof uploadData.fileSize === 'number' ? uploadData.fileSize : 0;
    const bytesUploaded = typeof uploadData.bytesUploaded === 'number' ? uploadData.bytesUploaded : 0;
    const speed = typeof uploadData.speed === 'number' ? uploadData.speed : 0;
    const status = uploadData.status || 'uploading';
    const progress = typeof uploadData.progress === 'number' ? Math.min(100, Math.max(0, uploadData.progress)) : 0;

    /* Compute ETA */
    let etaText = '';
    if (speed > 0 && progress > 0 && progress < 100) {
      const remaining = fileSize - bytesUploaded;
      const etaSeconds = Math.ceil(remaining / speed);
      etaText = this._formatEta(etaSeconds);
    }

    const isCompleted = status === 'completed';
    const isFailed = status === 'failed' || status === 'cancelled';
    const isPaused = status === 'paused';
    const isUploading = status === 'uploading';

    const statusIcon = isCompleted ? CHECK : (isFailed ? ALERT_CIRCLE : '');
    const statusClass = isCompleted ? 'progress-bar--completed' : (isFailed ? 'progress-bar--failed' : (isPaused ? 'progress-bar--paused' : ''));

    /* Build or reuse element */
    if (!this._el || this._currentId !== id) {
      /* New item — create element */
      const el = document.createElement('div');
      el.className = `progress-bar ${statusClass}`;
      el.setAttribute('data-upload-id', String(id));
      el.innerHTML = `
        <div class="progress-bar__header">
          <span class="progress-bar__icon">${FILE}</span>
          <span class="progress-bar__name" title="${this._escapeHtml(fileName)}">${this._escapeHtml(fileName)}</span>
          <span class="progress-bar__status-icon">${statusIcon}</span>
          <button class="progress-bar__cancel-btn" data-action="cancel-upload" data-upload-id="${id}" aria-label="Cancel upload">
            ${CLOSE}
          </button>
        </div>
        <div class="progress-bar__track">
          <div class="progress-bar__fill" style="width:${progress}%"></div>
        </div>
        <div class="progress-bar__footer">
          <span class="progress-bar__percent">${Math.round(progress)}%</span>
          <span class="progress-bar__size">${formatFileSize(bytesUploaded)} / ${formatFileSize(fileSize)}</span>
          ${speed > 0 ? `<span class="progress-bar__speed">${formatSpeed(speed)}</span>` : ''}
          ${etaText ? `<span class="progress-bar__eta">${etaText}</span>` : ''}
        </div>`;

      if (this._el && this._el.parentNode) {
        this._el.replaceWith(el);
      } else {
        this.container.appendChild(el);
      }
      this._el = el;
      this._currentId = id;
    }

    /* Update existing element */
    if (this._el) {
      this._el.className = `progress-bar ${statusClass}`;
      this._el.querySelector('.progress-bar__name')!.textContent = fileName;

      const fill = this._el.querySelector('.progress-bar__fill');
      if (fill) {
        (fill).style.width = `${progress}%`;
      }

      const statusIconEl = this._el.querySelector('.progress-bar__status-icon');
      if (statusIconEl) statusIconEl.innerHTML = statusIcon;

      const percentEl = this._el.querySelector('.progress-bar__percent');
      if (percentEl) percentEl.textContent = `${Math.round(progress)}%`;

      const sizeEl = this._el.querySelector('.progress-bar__size');
      if (sizeEl) sizeEl.textContent = `${formatFileSize(bytesUploaded)} / ${formatFileSize(fileSize)}`;

      const speedEl = this._el.querySelector('.progress-bar__speed');
      if (speedEl) {
        if (speed > 0 && isUploading) {
          speedEl.textContent = formatSpeed(speed);
          speedEl.style.display = '';
        } else {
          speedEl.style.display = 'none';
        }
      }

      const etaEl = this._el.querySelector('.progress-bar__eta');
      if (etaEl) {
        if (etaText && isUploading) {
          etaEl.textContent = etaText;
          etaEl.style.display = '';
        } else {
          etaEl.style.display = 'none';
        }
      }

      const cancelBtn = this._el.querySelector('.progress-bar__cancel-btn');
      if (cancelBtn) {
        cancelBtn.style.display = (isCompleted || isFailed) ? 'none' : '';
      }
    }
  }

  /**
   * Update with new upload data.
   * @param {UploadData} uploadData
   */
  update(uploadData) {
    this.render(uploadData);
  }

  /**
   * Animate out and remove the progress bar.
   */
  remove() {
    if (!this._el) return;
    this._el.classList.add('progress-bar--removing');

    const done = () => {
      if (this._el && this._el.parentNode) {
        this._el.parentNode.removeChild(this._el);
      }
      this._el = null;
      this._currentId = null;
    };

    this._el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 300);
  }

  /**
   * @param {number} seconds
   * @returns {string}
   */
  _formatEta(seconds) {
    if (seconds <= 0) return '';
    if (seconds < 60) return `${seconds}s remaining`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s remaining`;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return `${h}h ${mins}m remaining`;
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

  /** Clean up. */
  destroy() {
    this.remove();
  }
}
