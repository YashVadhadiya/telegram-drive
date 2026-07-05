/**
 * @file Toast notification system.
 * Singleton with automatic stacking, animations, and auto-dismiss.
 */

import { INFO, CHECK_CIRCLE, ALERT_CIRCLE, CLOSE } from '../constants/icons.js';

/**
 * @typedef {'info'|'success'|'error'|'warning'} ToastType
 */

export class Toast {
  constructor() {
    /** @type {HTMLElement|null} */
    this._container = null;

    /** @type {number} */
    this._counter = 0;
  }

  /**
   * Ensure the toast container exists in the DOM.
   * @returns {HTMLElement}
   */
  _getContainer() {
    if (!this._container) {
      let el = document.getElementById('toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'toast-container';
        document.body.appendChild(el);
      }
      this._container = el;
    }
    return this._container;
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {ToastType} [type='info']
   * @param {number} [duration=4000] - Set to 0 for persistent toast
   * @returns {string} Toast ID
   */
  show(message, type = 'info', duration = 4000) {
    if (!message) return '';

    const id = `toast_${Date.now()}_${this._counter++}`;
    const icon = this._getIcon(type);
    const container = this._getContainer();

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.id = id;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <span class="toast__icon">${icon}</span>
      <span class="toast__message">${this._escapeHtml(message)}</span>
      <button class="toast__close" data-toast-id="${id}" aria-label="Dismiss">${CLOSE}</button>`;

    container.appendChild(el);

    /* Trigger slide-in animation */
    requestAnimationFrame(() => el.classList.add('toast--visible'));

    /* Close button */
    el.querySelector('.toast__close')?.addEventListener('click', () => {
      this._dismiss(id);
    });

    /* Auto-dismiss */
    if (duration > 0) {
      /** @type {ReturnType<typeof setTimeout>|null} */
      this._timers = this._timers || new Map();
      const timer = setTimeout(() => this._dismiss(id), duration);
      this._timers.set(id, timer);

      /* Pause on hover */
      el.addEventListener('mouseenter', () => {
        const t = this._timers?.get(id);
        if (t) clearTimeout(t);
      });
      el.addEventListener('mouseleave', () => {
        if (duration > 0) {
          const timer = setTimeout(() => this._dismiss(id), duration);
          this._timers?.set(id, timer);
        }
      });
    }

    return id;
  }

  /**
   * Show a success toast.
   * @param {string} message
   * @returns {string}
   */
  success(message) {
    return this.show(message, 'success');
  }

  /**
   * Show an error toast.
   * @param {string} message
   * @returns {string}
   */
  error(message) {
    return this.show(message, 'error', 6000);
  }

  /**
   * Show a warning toast.
   * @param {string} message
   * @returns {string}
   */
  warning(message) {
    return this.show(message, 'warning', 5000);
  }

  /**
   * Show an info toast.
   * @param {string} message
   * @returns {string}
   */
  info(message) {
    return this.show(message, 'info');
  }

  /**
   * Dismiss all visible toasts.
   */
  dismissAll() {
    const container = this._getContainer();
    const toasts = container.querySelectorAll('.toast');
    for (const t of toasts) {
      this._dismiss(t.id);
    }
  }

  /* ---- internal ---- */

  /**
   * Animate out and remove a specific toast.
   * @param {string} id
   */
  _dismiss(id) {
    const el = document.getElementById(id);
    if (!el) return;

    /* Clear timer */
    if (this._timers?.has(id)) {
      clearTimeout(this._timers.get(id));
      this._timers.delete(id);
    }

    el.classList.remove('toast--visible');
    el.classList.add('toast--dismissing');

    const done = () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 300);
  }

  /**
   * Get the icon SVG for a toast type.
   * @param {ToastType} type
   * @returns {string}
   */
  _getIcon(type) {
    switch (type) {
      case 'success': return CHECK_CIRCLE;
      case 'error': return ALERT_CIRCLE;
      case 'warning': return ALERT_CIRCLE;
      case 'info':
      default: return INFO;
    }
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

  /** Clean up all toasts and timers. */
  destroy() {
    if (this._timers) {
      for (const [, t] of this._timers) clearTimeout(t);
      this._timers.clear();
    }
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
  }
}

/** @type {Toast} */
export const toast = new Toast();
