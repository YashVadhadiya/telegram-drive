# Telegram Drive Architecture

## Overview

Telegram Drive is a cloud storage application that uses Telegram Groups as storage
backends. Each "folder" in the application maps to a Telegram Group, and each "file"
maps to a Telegram Message with an attached document.

## System Architecture

```
Browser (GitHub Pages)
     │
     │ HTTPS / JWT
     ▼
Cloudflare Worker (Edge Runtime)
     │
     ├── D1 (SQLite) — Metadata, users, folders, files
     ├── KV — Sessions, rate limiting, cache
     │
     ├── Telegram Bot API — Group management, files < 50MB
     └── MTProto (gram.js) — Files 50MB–2GB
```

## Core Design Decisions

### Why Bot API + MTProto Hybrid?

| Aspect | Bot API | MTProto |
|--------|---------|---------|
| File upload limit | 50MB | 2GB |
| File download limit | 20MB | 2GB |
| Group management | Full | Limited |
| Authentication | Bot token | User phone + OTP |
| Setup complexity | Low | High |

Using both gives us:
- Bot API for 99% of operations (simple, fast)
- MTProto only when file size exceeds Bot API limits

### Why Flat Folder Structure First?

Flat folders simplify:
- Database queries (no recursive CTEs)
- UI navigation (no breadcrumb complexity)
- Telegram group management (no hierarchy mapping)

Nested folders will be added via `parent_id` column later.

### Why Unlimited Storage?

Telegram Groups have no practical storage limit. Each group can hold millions of
messages. Files are stored as messages, so the only limit is Telegram's message
count per group (~1M+), which translates to terabytes of data.

## Data Flow

### Upload < 50MB (Bot API)
```
1. Frontend chunks file (if needed) into 50MB pieces
2. POST /upload/init → Worker creates D1 record, returns uploadId
3. POST /upload/:id/chunk → Worker streams file to Telegram Bot API
4. POST /upload/:id/complete → Worker stores message ID ↔ file mapping
```

### Upload >= 50MB (MTProto)
```
1. Frontend chunks file into 50MB pieces
2. POST /upload/init → Worker marks chunked=1
3. POST /upload/:id/chunk → Worker sends via MTProto user session
4. POST /upload/:id/complete → Worker sends manifest message, stores mapping
```

### Download
```
1. GET /files/:id/download → Worker checks file size
2. < 20MB: Bot API download URL (redirect)
3. >= 20MB: MTProto stream via chunked HTTP response
```

## Storage Layout

```
D1 Database:
  users         → Auth, preferences, quotas
  sessions      → JWT session management
  telegram_sessions → Encrypted MTProto sessions
  folders       → Folder ↔ Telegram Group mapping
  files         → File ↔ Telegram Message mapping
  tags          → User-defined labels
  file_tags     → Many-to-many
  activities    → Audit log / dashboard timeline
  upload_queue  → Resumable uploads

KV Namespace:
  session:{token} → Session data (fast lookup)
  ratelimit:{key} → Rate limit counters
  cache:{query}   → Query result cache
  lock:{id}       → Distributed locks for chunked uploads
```

## Telegram Group Strategy

Each folder gets:
1. A Telegram Group (created by bot)
2. The bot is group admin
3. The user's MTProto session is added as admin (for large file uploads)
4. Files sent as documents to the group
5. Group title = folder name (synced on rename)

## Security Model

- **Zero secrets on frontend** — All API calls go through Cloudflare Worker
- **HTTPS-only** — HSTS enforced
- **JWT with short expiry** — 15min access + 7d refresh
- **Encrypted at rest** — MTProto sessions encrypted with AES-256-GCM
- **Rate limited** — Per-endpoint, per-user token buckets
- **Input validated** — All inputs sanitized server-side
- **CSP enforced** — Strict Content-Security-Policy headers

## Performance

- **Lazy loading** — IntersectionObserver for images and content
- **Infinite scroll** — Cursor-based pagination
- **KV cache** — Frequently accessed data cached at edge
- **Chunked upload** — 50MB pieces with parallel upload (2-4 concurrent)
- **Exponential backoff** — Upload retry with jitter
- **Compression** — Cloudflare automatic brotli compression
