/**
 * @file Reusable modal dialog component.
 * Manages its own DOM lifecycle — show, close, focus trap, keyboard handling.
 */

import { CLOSE, INFO, ALERT_CIRCLE, CHECK_CIRCLE } from '../constants/icons.js';

/**
 * @typedef {Object} ModalOptions
 * @property {string} [title]
 * @property {string|HTMLElement} [content]
 * @property {'sm'|'md'|'lg'} [size='md']
 * @property {boolean} [closable=true]
 * @property {Array<{label: string, action: string, variant?: 'primary'|'secondary'|'danger', disabled?: boolean}>} [actions]
 */

export class Modal {
  /**
   * @param {ModalOptions} [options={}]
   */
  constructor(options = {}) {
    /** @type {ModalOptions} */
    this.options = {
      title: options.title ?? '',
      content: options.content ?? '',
      size: options.size ?? 'md',
      closable: options.closable ?? true,
      actions: options.actions ?? [],
    };

    /** @type {HTMLElement|null} */
    this._el = null;

    /** @type {HTMLElement|null} */
    this._bodyEl = null;

    /** @type {HTMLElement|null} */
    this._footerEl = null;

    /** @type {boolean} */
    this._isVisible = false;

    /** @type {boolean} */
    this._loading = false;

    /** @type {((modal: Modal) => void)[]} */
    this._closeCallbacks = [];

    /** @type {Map<string, Array<() => void>>} */
    this._actionCallbacks = new Map();

    /** @type {HTMLElement|null} */
    this._previousFocus = null;
  }

  /**
   * Render the modal HTML and return the element.
   * @returns {HTMLElement}
   */
  render() {
    const sizeClass = `modal--${this.options.size || 'md'}`;
    const actionsHtml = (this.options.actions ?? []).map((a) => {
      const variant = a.variant ?? 'primary';
      return `<button class="modal__btn modal__btn--${variant}"
              data-action-btn="${this._escapeAttr(a.action)}"
              ${a.disabled ? 'disabled' : ''}>${this._escapeHtml(a.label)}</button>`;
    }).join('');

    const wrapper = document.createElement('div');
    wrapper.className = 'modal__overlay';
    wrapper.innerHTML = `
      <div class="modal ${sizeClass}" role="dialog" aria-modal="true" aria-label="${this._escapeAttr(this.options.title || 'Dialog')}">
        <div class="modal__header">
          <h2 class="modal__title">${this._escapeHtml(this.options.title || '')}</h2>
          ${this.options.closable !== false
            ? `<button class="modal__close-btn" data-action="close" aria-label="Close dialog">${CLOSE}</button>`
            : ''}
        </div>
        <div class="modal__body" data-modal-body>
          ${typeof this.options.content === 'string' ? this.options.content : ''}
        </div>
        ${actionsHtml ? `<div class="modal__footer" data-modal-footer>${actionsHtml}</div>` : ''}
      </div>`;

    this._el = wrapper;
    this._bodyEl = wrapper.querySelector('[data-modal-body]');
    this._footerEl = wrapper.querySelector('[data-modal-footer]');

    /* If content is an element, append it to body */
    if (this.options.content instanceof HTMLElement && this._bodyEl) {
      this._bodyEl.appendChild(this.options.content);
    }

    return wrapper;
  }

  /**
   * Append the modal to the document body and animate in.
   */
  show() {
    if (this._isVisible) return;

    this._previousFocus = /** @type {HTMLElement} */ (document.activeElement);

    const el = this.render();
    document.body.appendChild(el);

    /* Force reflow for animation */
    el.offsetHeight;
    el.classList.add('modal__overlay--visible');

    this._isVisible = true;
    this._bindEvents();

    /* Focus the first focusable element */
    this._focusFirst();
  }

  /**
   * Animate out, remove from DOM, and clean up.
   */
  close() {
    if (!this._isVisible || !this._el) return;

    this._el.classList.remove('modal__overlay--visible');

    const el = this._el;
    const done = () => {
      if (el.parentNode) el.parentNode.removeChild(el);
      this._isVisible = false;
      this._el = null;
      this._bodyEl = null;
      this._footerEl = null;
      this._unbindEvents();

      /* Restore focus */
      if (this._previousFocus) {
        try { this._previousFocus.focus(); } catch { /* ignore */ }
        this._previousFocus = null;
      }

      for (const cb of this._closeCallbacks) {
        try { cb(this); } catch { /* skip */ }
      }
    };

    if (el) {
      el.addEventListener('transitionend', done, { once: true });
      /* Fallback if transition doesn't fire */
      setTimeout(done, 300);
    } else {
      done();
    }
  }

  /**
   * Update the body content.
   * @param {string|HTMLElement} html
   */
  setContent(html) {
    if (!this._bodyEl) return;
    this._bodyEl.innerHTML = '';
    if (typeof html === 'string') {
      this._bodyEl.innerHTML = html;
    } else if (html instanceof HTMLElement) {
      this._bodyEl.appendChild(html);
    }
    this.options.content = html;
  }

  /**
   * Show or hide a loading state in the modal body.
   * @param {boolean} loading
   */
  setLoading(loading) {
    this._loading = loading;
    if (!this._bodyEl) return;
    if (loading) {
      this._bodyEl.innerHTML = `
        <div class="modal__loading">
          <div class="modal__spinner"></div>
          <span>Loading...</span>
        </div>`;
    }
  }

  /**
   * Register a callback for when the modal is closed.
   * @param {(modal: Modal) => void} callback
   */
  onClose(callback) {
    if (typeof callback === 'function') {
      this._closeCallbacks.push(callback);
    }
  }

  /**
   * Register a callback for a button action.
   * @param {string} actionName
   * @param {() => void} callback
   */
  onAction(actionName, callback) {
    if (!actionName || typeof callback !== 'function') return;
    if (!this._actionCallbacks.has(actionName)) {
      this._actionCallbacks.set(actionName, []);
    }
    const arr = /** @type {Array<() => void>} */ (this._actionCallbacks.get(actionName));
    arr.push(callback);
  }

  /**
   * Create a confirm dialog.
   * @param {string} message
   * @param {Object} [options]
   * @param {string} [options.confirmText='Confirm']
   * @param {string} [options.cancelText='Cancel']
   * @param {'primary'|'danger'} [options.confirmVariant='primary']
   * @returns {Promise<boolean>}
   */
  static confirm(message, options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title: 'Confirm',
        content: `<p class="modal__confirm-msg">${message}</p>`,
        size: 'sm',
        actions: [
          { label: options.cancelText || 'Cancel', action: 'cancel', variant: 'secondary' },
          { label: options.confirmText || 'Confirm', action: 'confirm', variant: options.confirmVariant || 'primary' },
        ],
      });

      modal.onAction('confirm', () => {
        modal.close();
        resolve(true);
      });
      modal.onAction('cancel', () => {
        modal.close();
        resolve(false);
      });
      modal.onClose(() => resolve(false));

      modal.show();
    });
  }

  /**
   * Create a prompt dialog.
   * @param {string} message
   * @param {string} [defaultValue='']
   * @returns {Promise<string|null>}
   */
  static prompt(message, defaultValue = '') {
    return new Promise((resolve) => {
      const id = `modal_prompt_${Date.now()}`;
      const modal = new Modal({
        title: 'Input',
        content: `
          <p class="modal__prompt-msg">${message}</p>
          <input type="text" class="modal__prompt-input" id="${id}" value="${defaultValue}" />`,
        size: 'sm',
        actions: [
          { label: 'Cancel', action: 'cancel', variant: 'secondary' },
          { label: 'OK', action: 'ok', variant: 'primary' },
        ],
      });

      modal.onAction('ok', () => {
        const input = modal._bodyEl?.querySelector(`#${id}`);
        const val = input ? /** @type {HTMLInputElement} */ (input).value : '';
        modal.close();
        resolve(val);
      });
      modal.onAction('cancel', () => {
        modal.close();
        resolve(null);
      });
      modal.onClose(() => resolve(null));

      modal.show();

      /* Focus the input after render */
      requestAnimationFrame(() => {
        const input = modal._bodyEl?.querySelector(`#${id}`);
        if (input) /** @type {HTMLInputElement} */ (input).focus();
      });
    });
  }

  /**
   * Create an alert dialog.
   * @param {string} message
   * @returns {Promise<void>}
   */
  static alert(message) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title: 'Alert',
        content: `<p class="modal__alert-msg">${message}</p>`,
        size: 'sm',
        actions: [
          { label: 'OK', action: 'ok', variant: 'primary' },
        ],
      });

      modal.onAction('ok', () => {
        modal.close();
        resolve();
      });
      modal.onClose(() => resolve());

      modal.show();
    });
  }

  /* ---- internal ---- */

  _bindEvents() {
    if (!this._el) return;

    /* Click on overlay backdrop closes if closable */
    if (this.options.closable !== false) {
      this._boundOverlayClick = (e) => {
        if (e.target === this._el) this.close();
      };
      this._el.addEventListener('click', this._boundOverlayClick);
    }

    /* Click events on action buttons */
    this._el.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target.closest('[data-action-btn]'));
      if (btn) {
        const action = btn.getAttribute('data-action-btn');
        if (action === 'close') {
          this.close();
          return;
        }
        const cbs = this._actionCallbacks.get(action ?? '');
        if (cbs) {
          for (const cb of cbs) cb();
        }
      }

      const closeBtn = /** @type {HTMLElement} */ (e.target.closest('[data-action="close"]'));
      if (closeBtn) this.close();
    });

    /* Keyboard: Escape to close */
    this._boundKeydown = (e) => {
      if (e.key === 'Escape' && this.options.closable !== false) {
        this.close();
      }
      if (e.key === 'Tab') {
        this._trapFocus(e);
      }
    };
    document.addEventListener('keydown', this._boundKeydown);
  }

  _unbindEvents() {
    if (this._boundOverlayClick && this._el) {
      this._el.removeEventListener('click', this._boundOverlayClick);
    }
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
    }
  }

  _focusFirst() {
    if (!this._el) return;
    const focusable = this._el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) {
      /** @type {HTMLElement} */ (focusable[0]).focus();
    }
  }

  /**
   * Trap focus within the modal.
   * @param {KeyboardEvent} e
   */
  _trapFocus(e) {
    if (!this._el) return;
    const focusable = this._el.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
    );
    if (focusable.length === 0) return;

    const first = /** @type {HTMLElement} */ (focusable[0]);
    const last = /** @type {HTMLElement} */ (focusable[focusable.length - 1]);

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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

  /** Clean up without animation. */
  destroy() {
    this._unbindEvents();
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._bodyEl = null;
    this._footerEl = null;
    this._isVisible = false;
    this._closeCallbacks = [];
    this._actionCallbacks.clear();
  }
}
