/**
 * @file File card component for grid and list display.
 * Returns HTML strings — events handled by parent via delegation.
 */

import {
  FILE, IMAGE, VIDEO, MUSIC, ARCHIVE, ZIP,
  FILETEXT, FILECODE, FILE_SPREADSHEET, FILE_PRESENTATION,
  STAR, STAR_FILLED, DOWNLOAD, SHARE, TRASH, EDIT, MOVE,
  MORE_VERTICAL, CHECK, LINK,
} from '../constants/icons.js';
import { FILE_ICONS, FILE_COLORS } from '../constants/types.js';
import { formatFileSize, formatRelativeDate } from '../utils/format.js';

/**
 * @typedef {Object} FileData
 * @property {number|string} id
 * @property {string} name
 * @property {string} [extension]
 * @property {string} [mimeType]
 * @property {number} [size]
 * @property {boolean} [isFavorite]
 * @property {string|number|Date} [createdAt]
 * @property {string} [thumbnailUrl]
 * @property {boolean} [selected]
 */

export class FileCard {
  /**
   * @param {FileData} data
   * @param {'grid'|'list'} [viewMode='grid']
   */
  constructor(data, viewMode = 'grid') {
    if (!data) throw new Error('FileCard: data is required');
    /** @type {FileData} */
    this.data = data;
    /** @type {'grid'|'list'} */
    this.viewMode = viewMode;
  }

  /**
   * Render the file card in the configured view mode.
   * @returns {string}
   */
  render() {
    return this.viewMode === 'list' ? this.renderListRow() : this.renderGridCard();
  }

  /**
   * @returns {string}
   */
  renderGridCard() {
    const d = this.data;
    const id = d.id ?? '';
    const name = d.name || 'Untitled';
    const ext = d.extension || this._extractExtension(name);
    const size = typeof d.size === 'number' ? d.size : 0;
    const isFavorite = Boolean(d.isFavorite);
    const createdAt = d.createdAt ? formatRelativeDate(d.createdAt) : '';
    const iconSvg = this._getIcon(ext);
    const color = FILE_COLORS[ext.toLowerCase()] || '#9E9E9E';
    const hasThumb = Boolean(d.thumbnailUrl);

    return `
      <div class="file-card file-card--grid" data-file-id="${id}" data-action="open" role="button" tabindex="0">
        <div class="file-card__preview"${hasThumb ? ` style="background-image:url('${this._escapeAttr(String(d.thumbnailUrl))}')"` : ''}>
          ${hasThumb ? '' : `<div class="file-card__type-icon" style="color:${this._escapeAttr(color)}">${iconSvg}</div>`}
        </div>

        <div class="file-card__info">
          <div class="file-card__name" title="${this._escapeAttr(name)}">
            ${this._escapeHtml(name)}
          </div>
          <div class="file-card__meta">
            <span>${formatFileSize(size)}</span>
            ${createdAt ? `<span>${createdAt}</span>` : ''}
          </div>
        </div>

        <div class="file-card__actions">
          <button class="file-card__fav-btn${isFavorite ? ' file-card__fav-btn--active' : ''}"
                  data-action="favorite"
                  data-file-id="${id}"
                  aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
            ${isFavorite ? STAR_FILLED : STAR}
          </button>
          <button class="file-card__menu-btn"
                  data-action="context-menu"
                  data-file-id="${id}"
                  aria-label="More actions">
            ${MORE_VERTICAL}
          </button>
        </div>
      </div>`;
  }

  /**
   * @returns {string}
   */
  renderListRow() {
    const d = this.data;
    const id = d.id ?? '';
    const name = d.name || 'Untitled';
    const ext = d.extension || this._extractExtension(name);
    const size = typeof d.size === 'number' ? d.size : 0;
    const isFavorite = Boolean(d.isFavorite);
    const isSelected = Boolean(d.selected);
    const createdAt = d.createdAt ? formatRelativeDate(d.createdAt) : '';
    const iconSvg = this._getIcon(ext);
    const color = FILE_COLORS[ext.toLowerCase()] || '#9E9E9E';

    return `
      <div class="file-card file-card--list${isSelected ? ' file-card--selected' : ''}"
           data-file-id="${id}"
           data-action="open"
           role="row">
        <div class="file-card__checkbox">
          <button class="file-card__check-btn${isSelected ? ' file-card__check-btn--checked' : ''}"
                  data-action="select"
                  data-file-id="${id}"
                  aria-label="${isSelected ? 'Deselect' : 'Select'}">
            ${isSelected ? CHECK : ''}
          </button>
        </div>

        <div class="file-card__icon" style="color:${this._escapeAttr(color)}">
          ${iconSvg}
        </div>

        <div class="file-card__name-cell" title="${this._escapeAttr(name)}">
          ${this._escapeHtml(name)}
        </div>

        <div class="file-card__size-cell">${formatFileSize(size)}</div>

        <div class="file-card__date-cell">${createdAt}</div>

        <div class="file-card__action-cell">
          <button class="file-card__fav-btn${isFavorite ? ' file-card__fav-btn--active' : ''}"
                  data-action="favorite"
                  data-file-id="${id}"
                  aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
            ${isFavorite ? STAR_FILLED : STAR}
          </button>
          <button class="file-card__menu-btn"
                  data-action="context-menu"
                  data-file-id="${id}"
                  aria-label="More actions">
            ${MORE_VERTICAL}
          </button>
        </div>
      </div>`;
  }

  /**
   * Resolve icon SVG for a file extension.
   * @param {string} ext
   * @returns {string}
   */
  _getIcon(ext) {
    const iconName = FILE_ICONS[ext.toLowerCase()];
    const map = {
      image: IMAGE, video: VIDEO, music: MUSIC, archive: ARCHIVE,
      zip: ZIP, fileText: FILETEXT, fileCode: FILECODE,
      fileSpreadsheet: FILE_SPREADSHEET, filePresentation: FILE_PRESENTATION,
      document: FILETEXT,
    };
    return map[iconName] ?? FILE;
  }

  /**
   * Extract extension from filename.
   * @param {string} name
   * @returns {string}
   */
  _extractExtension(name) {
    if (!name) return '';
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
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
