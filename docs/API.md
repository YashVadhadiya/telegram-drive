# Telegram Drive API

**Base URL**: `https://api.telegram-drive.workers.dev/api/v1`

**Format**: JSON

**Auth**: `Authorization: Bearer <jwt_token>`

---

## Standard Response Envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 142,
    "hasMore": true
  },
  "error": null
}
```

Error response:

```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid file name",
    "details": { "name": "File name is required" }
  }
}
```

---

## Authentication

### POST /auth/telegram
Verify Telegram Login Widget data and issue JWT.

**Request:**
```json
{
  "id": 123456789,
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe",
  "photo_url": "https://t.me/i/userpic/...",
  "auth_date": 1700000000,
  "hash": "abc123def456..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresIn": 900,
  "user": { "id": "usr_xxx", "telegramId": 123456789, "username": "johndoe" }
}
```

### POST /auth/refresh
Exchange refresh token for new access token.

**Request:**
```json
{
  "refreshToken": "eyJhbG..."
}
```

### POST /auth/logout
Invalidate current session.

### GET /auth/me
Get current user profile.

---

## Telegram Session (MTProto)

### POST /telegram/session/start
Start MTProto authentication. Sends code to phone.

**Request:**
```json
{
  "phone": "+1234567890"
}
```

### POST /telegram/session/verify
Verify OTP code.

**Request:**
```json
{
  "phone": "+1234567890",
  "code": "12345",
  "phoneCodeHash": "abc123"
}
```

### DELETE /telegram/session
Revoke MTProto session.

---

## Folders

### GET /folders
List folders with pagination, search, sort.

**Query params:** `?page=1&limit=50&search=name&sort=name&order=asc&favorite=true`

**Response:**
```json
{
  "data": [
    {
      "id": "fld_xxx",
      "name": "Movies",
      "icon": "film",
      "color": "#E74C3C",
      "fileCount": 42,
      "totalSize": 8589934592,
      "isFavorite": true,
      "createdAt": 1700000000
    }
  ]
}
```

### POST /folders
Create folder (creates Telegram group).

**Request:** `{ "name": "Movies", "icon": "film", "color": "#E74C3C" }`

### GET /folders/:id
Get folder details including Telegram group info.

### PUT /folders/:id
Rename folder (renames Telegram group).

**Request:** `{ "name": "New Name" }`

### DELETE /folders/:id
Soft delete (move to trash).

### PATCH /folders/:id/favorite
Toggle favorite status.

---

## Files

### GET /folders/:folderId/files
List files in folder. **Query params:** `?page=1&limit=50&sort=name&order=asc&search=query`

**Response:**
```json
{
  "data": [
    {
      "id": "fil_xxx",
      "name": "document.pdf",
      "extension": "pdf",
      "mimeType": "application/pdf",
      "size": 1048576,
      "isFavorite": false,
      "createdAt": 1700000000
    }
  ]
}
```

### POST /upload/init
Initialize upload.

**Request:**
```json
{
  "folderId": "fld_xxx",
  "fileName": "video.mp4",
  "fileSize": 1073741824,
  "mimeType": "video/mp4"
}
```

**Response:** `{ "uploadId": "upl_xxx", "chunkSize": 52428800, "totalChunks": 20 }`

### POST /upload/:uploadId/chunk
Upload a single chunk (multipart/form-data).

**Form fields:** `chunkIndex`, `data` (binary)

### POST /upload/:uploadId/complete
Finalize upload. Triggers Telegram send.

### GET /upload/:uploadId/status
Get upload progress.

---

## Download

### GET /files/:id/download
Get download URL.

**Response:** `{ "url": "https://...", "expiresAt": 1700000100 }`

### GET /files/:id/stream
Stream file content directly.

---

## Search

### GET /search
Full-text search.

**Query params:**
```
?q=keyword
&type=image|video|audio|document|archive
&folder=fld_xxx
&ext=pdf,jpg
&minSize=0
&maxSize=10000000
&favorite=true
&trashed=false
&sort=name|size|date
&order=asc|desc
&page=1
&limit=50
```

---

## Statistics

### GET /stats/overview
**Response:**
```json
{
  "storageUsed": 4294967296,
  "totalFiles": 1024,
  "folderCount": 12,
  "largestFile": { "name": "movie.mp4", "size": 2147483648 },
  "recentUploads": 42,
  "uploadSpeed": 5242880,
  "downloadSpeed": 10485760
}
```

### GET /stats/recent
Recent activity timeline.

### GET /stats/largest
Top 20 largest files.

---

## Trash

### GET /trash
List trashed items.

### DELETE /trash/empty
Permanently delete all trashed items.

### POST /trash/restore/:id
Restore item from trash.

---

## Settings

### GET /settings
Get user settings.

**Response:**
```json
{
  "theme": "dark",
  "language": "en",
  "chunkSize": 52428800,
  "autoRetry": true,
  "notifications": true
}
```

### PUT /settings
Update settings.

---

## Favorites

### GET /favorites
List all favorited files and folders.

---

## Sharing

### POST /share/:fileId
Generate share link.

**Response:** `{ "shareId": "shr_xxx", "url": "https://drive.tg/s/shr_xxx" }`

### DELETE /share/:shareId
Revoke share link.

### GET /share/:shareId
Access shared file (public, no auth).
