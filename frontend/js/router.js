/**
 * @file Hash-based SPA router with route params, auth guards, and component lifecycle.
 *
 * Route pattern syntax:
 *   - `/folders/:id/files`  →  `{ id: "123" }`
 *   - `/`                   →  home
 *   - `/settings`           →  settings
 *
 * Component interface:
 *   ```js
 *   class MyPage {
 *     render(params) { return '<h1>Hello</h1>'; }
 *     mount(container, params) { /* attach listeners *\/ }
 *     unmount() { /* cleanup *\/ }
 *   }
 *   ```
 */

import { auth } from './services/auth.js';

/* ------------------------------------------------------------------ */
/*  Typedefs                                                          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} RouteConfig
 * @property {string} title - Page title suffix
 * @property {boolean} [auth] - Whether the route requires authentication
 * @property {boolean} [exact] - Only match exact hash (no extra segments)
 */

/**
 * @typedef {Object} MatchedRoute
 * @property {RegExp} regex
 * @property {string[]} paramNames
 * @property {new() => { render: Function, mount?: Function, unmount?: Function }} component
 * @property {RouteConfig} options
 * @property {Record<string, string>} params
 */

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

class Router {
  constructor() {
    /** @type {Map<string, { regex: RegExp, paramNames: string[], component: new() => { render: Function, mount?: Function, unmount?: Function }, options: RouteConfig }>} */
    this.routes = new Map();

    /** @type {{ component: { unmount?: () => void }, params: Record<string, string> } | null} */
    this.currentRoute = null;

    /** @type {HTMLElement | null} */
    this.container = null;

    /** @type {((path: string) => boolean) | null} */
    this._authGuard = null;

    /** @type {(() => void) | null} */
    this._notFoundHandler = null;

    /** @type {Map<string, { component: new() => { render: Function, mount?: Function, unmount?: Function }, params: Record<string, string> }>} */
    this.pageCache = new Map();

    this._boundHandleRoute = this._handleRoute.bind(this);
    window.addEventListener('hashchange', this._boundHandleRoute);
  }

  /* ---- public API ---- */

  /**
   * Register a route.
   *
   * @param {string} pattern - e.g. `/folders/:id/files`
   * @param {new() => { render: Function, mount?: Function, unmount?: Function }} componentClass
   * @param {RouteConfig} [options={}]
   */
  addRoute(pattern, componentClass, options = {}) {
    const paramNames = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);

    this.routes.set(pattern, {
      regex,
      paramNames,
      component: componentClass,
      options: { title: options.title ?? '', auth: options.auth ?? false },
    });
  }

  /**
   * Programmatically navigate to a path.
   * @param {string} path - e.g. `/folders/123/files`
   */
  navigate(path) {
    const hash = path.startsWith('/') ? `#${path}` : `#/${path}`;
    if (window.location.hash === hash) {
      /* Same hash — force re-route (e.g. params changed) */
      this._handleRoute();
    } else {
      window.location.hash = hash;
    }
  }

  /**
   * Extract the named parameters from the current route.
   * @returns {Record<string, string>}
   */
  getCurrentParams() {
    return this.currentRoute?.params ?? {};
  }

  /**
   * Set a custom auth guard function. Defaults to `auth.isAuthenticated()`.
   * @param {() => boolean} guard
   */
  setAuthGuard(guard) {
    this._authGuard = guard;
  }

  /**
   * Set a handler for unmatched routes.
   * @param {() => void} handler
   */
  setNotFoundHandler(handler) {
    this._notFoundHandler = handler;
  }

  /**
   * Initialise the router with a DOM container and handle the initial route.
   * @param {string|HTMLElement} container - CSS selector or element
   */
  start(container) {
    if (typeof container === 'string') {
      const el = document.querySelector(container);
      if (!el) throw new Error(`Router container "${container}" not found`);
      this.container = /** @type {HTMLElement} */ (el);
    } else {
      this.container = container;
    }

    /* Handle the initial hash */
    this._handleRoute();
  }

  /* ---- route handling ---- */

  /**
   * Match the current hash against all registered routes.
   * @param {string} hash
   * @returns {MatchedRoute | null}
   */
  _matchRoute(hash) {
    for (const [, route] of this.routes) {
      const match = hash.match(route.regex);
      if (match) {
        const params = /** @type {Record<string, string>} */ ({});
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { ...route, params };
      }
    }
    return null;
  }

  /**
   * Handle a hash change event.
   */
  async _handleRoute() {
    if (!this.container) return;

    let hash = window.location.hash.replace(/^#/, '') || '/';

    /* Normalise: ensure leading slash */
    if (!hash.startsWith('/')) hash = `/${hash}`;

    const matched = this._matchRoute(hash);

    if (!matched) {
      if (this._notFoundHandler) {
        this._notFoundHandler();
      } else {
        this.container.innerHTML = '<div class="not-found"><h1>404</h1><p>Page not found</p></div>';
      }
      return;
    }

    /* Auth guard */
    const authRequired = matched.options.auth ?? false;
    if (authRequired) {
      const isAuth = this._authGuard ? this._authGuard() : auth.isAuthenticated();
      if (!isAuth) {
        this._redirectToLogin();
        return;
      }
    }

    /* Unmount current component */
    if (this.currentRoute && this.currentRoute.component.unmount) {
      try {
        this.currentRoute.component.unmount();
      } catch {
        /* skip */
      }
    }

    /* Build or retrieve the component instance */
    let instance;
    const cacheKey = matched.options.title || matched.regex.source;

    if (this.pageCache.has(cacheKey)) {
      const cached = this.pageCache.get(cacheKey);
      if (cached) {
        instance = cached;
      }
    }

    if (!instance) {
      instance = new matched.component();
    }

    this.currentRoute = {
      component: instance,
      params: matched.params,
    };

    /* Update document title */
    const appName = 'Telegram Drive';
    const title = matched.options.title;
    document.title = title ? `${title} — ${appName}` : appName;

    /* Render */
    try {
      const html = instance.render(matched.params);
      if (typeof html === 'string') {
        this.container.innerHTML = html;
      } else if (html instanceof HTMLElement) {
        this.container.innerHTML = '';
        this.container.appendChild(html);
      }

      if (instance.mount) {
        instance.mount(this.container, matched.params);
      }
    } catch (err) {
      this.container.innerHTML = `<div class="error-boundary"><h2>Something went wrong</h2><pre>${err instanceof Error ? err.message : 'Unknown error'}</pre></div>`;
    }
  }

  /**
   * Redirect unauthenticated users to the login page.
   */
  _redirectToLogin() {
    const loginPath = '/login';
    const currentHash = window.location.hash.replace(/^#/, '') || '/';
    if (currentHash !== loginPath) {
      this.navigate(loginPath);
    }
  }

  /**
   * Destroy the router — remove event listeners and clean up.
   */
  destroy() {
    window.removeEventListener('hashchange', this._boundHandleRoute);
    this.routes.clear();
    this.pageCache.clear();
    this.currentRoute = null;
    this.container = null;
  }
}

/** @type {Router} */
export const router = new Router();
