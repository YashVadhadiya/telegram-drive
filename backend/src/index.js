import { createRouter } from './services/simpleRouter.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';

import { errorHandler } from './middleware/errorHandler.js';
import { validateMiddleware } from './middleware/validate.js';

import {
  telegramAuthHandler, refreshTokenHandler, getMeHandler, logoutHandler,
} from './handlers/auth.js';

import {
  listFoldersHandler, createFolderHandler, getFolderHandler,
  updateFolderHandler, deleteFolderHandler, toggleFolderFavoriteHandler,
} from './handlers/folders.js';

import {
  listFilesHandler, getFileHandler, updateFileHandler, deleteFileHandler,
  toggleFileFavoriteHandler, copyFileHandler, moveFileHandler,
} from './handlers/files.js';

import {
  initUploadHandler, uploadChunkHandler, completeUploadHandler,
  getUploadStatusHandler, cancelUploadHandler,
} from './handlers/upload.js';

import { searchHandler } from './handlers/search.js';

import {
  getOverviewStatsHandler, getRecentStatsHandler, getLargestFilesHandler,
} from './handlers/stats.js';

import {
  listTrashHandler, emptyTrashHandler, restoreFromTrashHandler,
} from './handlers/trash.js';

import {
  getSettingsHandler, updateSettingsHandler,
} from './handlers/settings.js';

import { listFavoritesHandler } from './handlers/favorites.js';

import {
  createShareLinkHandler, deleteShareLinkHandler, getSharedFileHandler,
} from './handlers/sharing.js';

import {
  startSessionHandler, verifySessionHandler, deleteSessionHandler,
} from './handlers/telegramSession.js';

const router = createRouter();

router.post('/api/v1/auth/telegram', telegramAuthHandler);
router.post('/api/v1/auth/refresh', refreshTokenHandler);

router.all('/api/v1/*', authMiddleware);

router.get('/api/v1/auth/me', getMeHandler);
router.post('/api/v1/auth/logout', logoutHandler);

router.get('/api/v1/folders', listFoldersHandler);
router.post('/api/v1/folders', validateMiddleware({
  name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
  parent_id: { type: 'string' },
  icon: { type: 'string' },
  color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
}), createFolderHandler);
router.get('/api/v1/folders/:id', getFolderHandler);
router.put('/api/v1/folders/:id', validateMiddleware({
  name: { type: 'string', minLength: 1, maxLength: 100 },
  icon: { type: 'string' },
  color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  parent_id: { type: 'string' },
}), updateFolderHandler);
router.delete('/api/v1/folders/:id', deleteFolderHandler);
router.patch('/api/v1/folders/:id/favorite', validateMiddleware({
  is_favorite: { required: true, type: 'boolean' },
}), toggleFolderFavoriteHandler);

router.get('/api/v1/folders/:folderId/files', listFilesHandler);
router.get('/api/v1/files/:id', getFileHandler);
router.put('/api/v1/files/:id', validateMiddleware({
  name: { type: 'string', minLength: 1, maxLength: 255 },
  folder_id: { type: 'string' },
}), updateFileHandler);
router.delete('/api/v1/files/:id', deleteFileHandler);
router.patch('/api/v1/files/:id/favorite', validateMiddleware({
  is_favorite: { required: true, type: 'boolean' },
}), toggleFileFavoriteHandler);
router.post('/api/v1/files/:id/copy', copyFileHandler);
router.post('/api/v1/files/:id/move', validateMiddleware({
  folder_id: { required: true, type: 'string' },
}), moveFileHandler);

router.post('/api/v1/upload/init', validateMiddleware({
  folder_id: { required: true, type: 'string' },
  file_name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
  file_size: { required: true, type: 'number', min: 1 },
  mime_type: { required: true, type: 'string' },
  total_chunks: { required: true, type: 'number', min: 1 },
}), initUploadHandler);
router.post('/api/v1/upload/:uploadId/chunk', uploadChunkHandler);
router.post('/api/v1/upload/:uploadId/complete', completeUploadHandler);
router.get('/api/v1/upload/:uploadId/status', getUploadStatusHandler);
router.delete('/api/v1/upload/:uploadId', cancelUploadHandler);

router.get('/api/v1/files/:id/download', async (req, env, ctx) => {
  return new Response(JSON.stringify({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Download via Bot API - not yet implemented' } }), {
    status: 501, headers: { 'Content-Type': 'application/json' },
  });
});
router.get('/api/v1/files/:id/stream', async (req, env, ctx) => {
  return new Response(JSON.stringify({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Stream via Bot API - not yet implemented' } }), {
    status: 501, headers: { 'Content-Type': 'application/json' },
  });
});

router.get('/api/v1/search', validateMiddleware({
  q: { required: true, type: 'string', minLength: 1 },
  type: { type: 'string' },
  folder_id: { type: 'string' },
  page: { type: 'number', min: 1 },
  per_page: { type: 'number', min: 1, max: 100 },
}), searchHandler);

router.get('/api/v1/stats/overview', getOverviewStatsHandler);
router.get('/api/v1/stats/recent', getRecentStatsHandler);
router.get('/api/v1/stats/largest', getLargestFilesHandler);

router.get('/api/v1/trash', listTrashHandler);
router.delete('/api/v1/trash/empty', emptyTrashHandler);
router.post('/api/v1/trash/restore/:id', restoreFromTrashHandler);

router.get('/api/v1/settings', getSettingsHandler);
router.put('/api/v1/settings', updateSettingsHandler);

router.get('/api/v1/favorites', listFavoritesHandler);

router.post('/api/v1/share/:fileId', validateMiddleware({
  expires_in_days: { type: 'number', min: 1, max: 30 },
}), createShareLinkHandler);
router.delete('/api/v1/share/:shareId', deleteShareLinkHandler);
router.get('/api/v1/share/:shareId', getSharedFileHandler);

router.post('/api/v1/telegram/session/start', startSessionHandler);
router.post('/api/v1/telegram/session/verify', validateMiddleware({
  code: { required: true, type: 'string', minLength: 1 },
  phone_code_hash: { required: true, type: 'string' },
}), verifySessionHandler);
router.delete('/api/v1/telegram/session', deleteSessionHandler);

router.all('/api/v1/*', () => new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }), {
  status: 404, headers: { 'Content-Type': 'application/json' },
}));
router.all('*', () => new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }), {
  status: 404, headers: { 'Content-Type': 'application/json' },
}));

export default {
  async fetch(request, env, ctx) {
    try {
      const origin = request.headers.get('Origin') || '';
      const allowedOrigins = [
        'http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173',
        'https://telegram-drive.pages.dev', 'https://telegram-drive.com',
        'https://YashVadhadiya.github.io',
      ];
      const allowedOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*');

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin',
          },
        });
      }

      const response = await router.handle(request, env, ctx);

      if (response) {
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', allowedOrigin);
        headers.set('Vary', 'Origin');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin' },
      });
    } catch (err) {
      return errorHandler(err, request);
    }
  },
};
