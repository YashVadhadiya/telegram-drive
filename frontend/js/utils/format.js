/**
 * @file Formatting utility functions.
 */

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatFileSize(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const factor = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(factor)), units.length - 1);
  const val = bytes / factor ** i;
  return `${i < 2 ? val : val.toFixed(decimals)} ${units[i]}`;
}

/**
 * Format a timestamp into a date string.
 * @param {number|string|Date} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a timestamp into a relative time string.
 * @param {number|string|Date} timestamp
 * @returns {string}
 */
export function formatRelativeDate(timestamp) {
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  const now = Date.now();
  const diff = now - d.getTime();
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? '' : 's'} ago`;
}

/**
 * Format a duration in seconds to H:MM:SS or M:SS.
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

/**
 * Format a transfer speed.
 * @param {number} bytesPerSecond
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatSpeed(bytesPerSecond, decimals = 1) {
  return `${formatFileSize(bytesPerSecond, decimals)}/s`;
}

/**
 * Format a decimal as a percentage string.
 * @param {number} value  0–100
 * @returns {string}
 */
export function formatPercentage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n)}%`;
}

/**
 * Truncate a filename with ellipsis in the middle if too long.
 * @param {string} name
 * @param {number} [maxLen=40]
 * @returns {string}
 */
export function truncateFilename(name, maxLen = 40) {
  if (!name || name.length <= maxLen) return name;
  const extIdx = name.lastIndexOf('.');
  const ext = extIdx !== -1 ? name.slice(extIdx) : '';
  const base = extIdx !== -1 ? name.slice(0, extIdx) : name;
  const avail = maxLen - ext.length - 3;
  if (avail < 4) return name.slice(0, maxLen - 3) + '...';
  const front = Math.ceil(avail / 2);
  const back = Math.floor(avail / 2);
  return base.slice(0, front) + '...' + base.slice(base.length - back) + ext;
}

/**
 * Simple pluralization helper.
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}
 */
export function pluralize(count, singular, plural) {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

/**
 * Convert a string to a URL-safe slug.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Format a number with locale digit grouping (commas).
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}
