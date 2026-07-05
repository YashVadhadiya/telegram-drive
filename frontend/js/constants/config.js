/**
 * @file Application configuration constants
 * Frontend-safe config only — no secrets.
 */

/** @type {Readonly<typeof CONFIG>} */
export const CONFIG = Object.freeze({
  API_BASE_URL: 'https://api.telegram-drive.workers.dev/api/v1',
  APP_NAME: 'Telegram Drive',
  APP_VERSION: '1.0.0',
  CHUNK_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2 GB
  MAX_CONCURRENT_UPLOADS: 3,
  UPLOAD_RETRY_ATTEMPTS: 3,
  UPLOAD_RETRY_DELAY: 1000,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  ITEMS_PER_PAGE: 50,
  INFINITE_SCROLL_THRESHOLD: 200,
  DEBOUNCE_DELAY: 300,
  THEME_STORAGE_KEY: 'td_theme',
  SESSION_STORAGE_KEY: 'td_session',
  FAVORITE_STORAGE_KEY: 'td_favorites',
  SIDEBAR_STATE_KEY: 'td_sidebar',
  TELEGRAM_LOGIN_BOT_USERNAME: 'my_storage_telegram_bot',
});
