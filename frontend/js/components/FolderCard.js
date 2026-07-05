/**
 * @file Folder card component for grid display.
 * Renders an HTML string — events handled by parent via delegation.
 */

import { FOLDER, STAR, STAR_FILLED, MORE_VERTICAL } from '../constants/icons.js';
import { formatFileSize, formatRelativeDate } from '../utils/format.js';

export class FolderCard {
  /**
   * @param {{
   *   id: number|string,
   *   name: string,
   *   icon?: string,
   *   color?: string,
   *   fileCount?: number,
   *   totalSize?: number,
   *   isFavorite?: boolean,
   *   createdAt?: string|number|Date,
   * }|null} data
   */
  constructor(data) {
    if (!data) throw new Error('FolderCard: data is required');
    this.data = data;
  }

  /**
   * Returns an HTML string for a folder card.
   * @returns {string}
   */
  render() {
    const d = this.data;
    const id = d.id ?? '';
    const name = d.name || 'Untitled folder';
    const color = d.color || '#FFD54F';
    const fileCount = typeof d.fileCount === 'number' ? d.fileCount : 0;
    const totalSize = typeof d.totalSize === 'number' ? d.totalSize : 0;
    const isFavorite = Boolean(d.isFavorite);
    const createdAt = d.createdAt ? formatRelativeDate(d.createdAt) : '';

    const itemCountText = fileCount === 1 ? '1 item' : `${fileCount} items`;

    return `
      <div class="folder-card" data-folder-id="${id}" data-action="open" role="button" tabindex="0">
        <div class="folder-card__header">
          <div class="folder-card__icon" style="color:${this._escapeAttr(color)}">
            ${FOLDER}
          </div>
          <button class="folder-card__fav-btn${isFavorite ? ' folder-card__fav-btn--active' : ''}"
                  data-action="favorite"
                  data-folder-id="${id}"
                  aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
            ${isFavorite ? STAR_FILLED : STAR}
          </button>
          <button class="folder-card__menu-btn"
                  data-action="context-menu"
                  data-folder-id="${id}"
                  aria-label="More actions">
            ${MORE_VERTICAL}
          </button>
        </div>

        <div class="folder-card__body">
          <div class="folder-card__name" title="${this._escapeAttr(name)}">
            ${this._escapeHtml(name)}
          </div>
        </div>

        <div class="folder-card__footer">
          <span class="folder-card__count">${itemCountText}</span>
          <span class="folder-card__size">${formatFileSize(totalSize)}</span>
        </div>

        ${createdAt ? `<div class="folder-card__date">${createdAt}</div>` : ''}
      </div>`;
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
