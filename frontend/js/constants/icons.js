/**
 * @file SVG icon constants — Feather-style, 24×24, stroke-width 1.5.
 * Each export is an SVG template literal string.
 */

/** @param {number} [size] */
const s = (size = 24) => size;
/** @param {number} [sw] */
const sw = (sw = 1.5) => sw;

/* ---------- Navigation / layout ---------- */

export const HOME = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m-4 0h8"/><path d="M9 21V12h6v9"/></svg>`;
export const MENU = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="20" x2="21" y2="20"/></svg>`;
export const CLOSE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
export const CHEVRON_LEFT = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
export const CHEVRON_RIGHT = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
export const CHEVRON_DOWN = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
export const CHEVRON_UP = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
export const ARROW_UP = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
export const ARROW_DOWN = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
export const PLUS = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
export const MINUS = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
export const CHECK = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
export const MORE_VERTICAL = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;

/* ---------- View modes ---------- */

export const GRID = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
export const LIST = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;

/* ---------- Actions ---------- */

export const SEARCH = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
export const UPLOAD = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
export const DOWNLOAD = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
export const TRASH = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
export const RESTORE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
export const SHARE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
export const LINK = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
export const COPY = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
export const MOVE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
export const EDIT = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
export const EXTERNAL_LINK = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

/* ---------- File type icons ---------- */

export const FOLDER = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
export const FOLDER_OPEN = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M6 14l-2 6"/><path d="M18 14l2 6"/><path d="M10 14l-1 6"/><path d="M14 14l1 6"/></svg>`;
export const FILE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
export const FILE_TEXT = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
export const IMAGE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
export const VIDEO = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
export const MUSIC = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
export const ARCHIVE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
export const DOCUMENT = FILE_TEXT;
export const FILM = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>`;
export const HEADPHONE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;
export const ZIP = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="10" y1="16" x2="14" y2="16"/></svg>`;
export const FILE_SPREADSHEET = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="8" y2="9.01"/></svg>`;
export const FILE_PRESENTATION = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="11" width="8" height="4"/><line x1="12" y1="15" x2="12" y2="17"/></svg>`;
export const FILE_CODE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>`;

/* ---------- UI / status ---------- */

export const INFO = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
export const ALERT_CIRCLE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
export const CHECK_CIRCLE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
export const REFRESH = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
export const FILTER = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`;
export const TAG = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;

/* ---------- User / auth ---------- */

export const USER = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
export const USERS = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
export const LOGOUT = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
export const SETTINGS = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

/* ---------- Ratings / bookmarks ---------- */

export const STAR = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
export const STAR_FILLED = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
export const HEART = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
export const BOOKMARK = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
export const CLOCK = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

/* ---------- Keys / security ---------- */

export const KEY = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`;
export const LOCK = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
export const EYE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
export const EYE_OFF = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

/* ---------- Cloud / transfer ---------- */

export const CLOUD = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
export const UPLOAD_CLOUD = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="12 15 12 3"/><line x1="9" y1="6" x2="12" y2="3"/><line x1="15" y1="6" x2="12" y2="3"/></svg>`;
export const DOWNLOAD_CLOUD = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="12 15 12 3"/><line x1="9" y1="12" x2="12" y2="15"/><line x1="15" y1="12" x2="12" y2="15"/></svg>`;

/* ---------- Sort / order ---------- */

export const SORT_ASC = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="17 10 12 5 7 10"/><line x1="17" y1="19" x2="7" y2="19"/></svg>`;
export const SORT_DESC = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="17 14 12 19 7 14"/><line x1="17" y1="5" x2="7" y2="5"/></svg>`;

/* ---------- Dev / code ---------- */

export const TERMINAL = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`;
export const CPU = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`;
export const DB = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`;
export const HARD_DRIVE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>`;

/* ---------- Charts / analytics ---------- */

export const BAR_CHART = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`;
export const ACTIVITY = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;

/* ---------- Misc ---------- */

export const GLOBE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
export const BELL = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
export const MOON = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
export const SUN = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
export const MONITOR = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
export const SMARTPHONE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
export const FOLDER_PLUS = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`;
export const FILE_PLUS = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
export const UNDO = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
export const REDO = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
export const PRINTER = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;
export const CAMERA = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
export const MESSAGE_CIRCLE = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
export const SEND = `<svg width="${s()}" height="${s()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw()}" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

/** Map of icon name (lowercase, no dash) to SVG string for dynamic access. */
export const ICON_MAP = {
  home: HOME,
  menu: MENU,
  close: CLOSE,
  chevronleft: CHEVRON_LEFT,
  chevronright: CHEVRON_RIGHT,
  chevrondown: CHEVRON_DOWN,
  chevronup: CHEVRON_UP,
  arrowup: ARROW_UP,
  arrowdown: ARROW_DOWN,
  plus: PLUS,
  minus: MINUS,
  check: CHECK,
  morevertical: MORE_VERTICAL,
  grid: GRID,
  list: LIST,
  search: SEARCH,
  upload: UPLOAD,
  download: DOWNLOAD,
  trash: TRASH,
  restore: RESTORE,
  share: SHARE,
  link: LINK,
  copy: COPY,
  move: MOVE,
  edit: EDIT,
  externallink: EXTERNAL_LINK,
  folder: FOLDER,
  folderopen: FOLDER_OPEN,
  file: FILE,
  filetext: FILE_TEXT,
  image: IMAGE,
  video: VIDEO,
  music: MUSIC,
  archive: ARCHIVE,
  document: DOCUMENT,
  film: FILM,
  headphone: HEADPHONE,
  zip: ZIP,
  filespreadsheet: FILE_SPREADSHEET,
  filepresentation: FILE_PRESENTATION,
  filecode: FILE_CODE,
  info: INFO,
  alertcircle: ALERT_CIRCLE,
  checkcircle: CHECK_CIRCLE,
  refresh: REFRESH,
  filter: FILTER,
  tag: TAG,
  user: USER,
  users: USERS,
  logout: LOGOUT,
  settings: SETTINGS,
  star: STAR,
  starfilled: STAR_FILLED,
  heart: HEART,
  bookmark: BOOKMARK,
  clock: CLOCK,
  key: KEY,
  lock: LOCK,
  eye: EYE,
  eyeoff: EYE_OFF,
  cloud: CLOUD,
  uploadcloud: UPLOAD_CLOUD,
  downloadcloud: DOWNLOAD_CLOUD,
  sortasc: SORT_ASC,
  sortdesc: SORT_DESC,
  terminal: TERMINAL,
  cpu: CPU,
  db: DB,
  harddrive: HARD_DRIVE,
  barchart: BAR_CHART,
  activity: ACTIVITY,
  globe: GLOBE,
  bell: BELL,
  moon: MOON,
  sun: SUN,
  monitor: MONITOR,
  smartphone: SMARTPHONE,
  folderplus: FOLDER_PLUS,
  fileplus: FILE_PLUS,
  undo: UNDO,
  redo: REDO,
  printer: PRINTER,
  camera: CAMERA,
  messagecircle: MESSAGE_CIRCLE,
  send: SEND,
};
