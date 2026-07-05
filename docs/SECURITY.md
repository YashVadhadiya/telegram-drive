# Telegram Drive Security Architecture

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Credential leakage | Zero secrets in frontend code |
| Token theft | Short-lived JWT (15min) + refresh rotation |
| Session hijacking | HTTP-only cookies + SameSite strict |
| CSRF | Double-submit cookie pattern |
| XSS | CSP headers + output encoding |
| Man-in-the-middle | HSTS + HTTPS-only |
| Rate abuse | Token bucket per user per endpoint |
| Large file abuse | File size validation + chunk limits |
| Telegram token theft | Encrypted environment variables |
| MTProto session theft | AES-256-GCM encrypted at rest |

## Authentication Flow

```
1. User clicks "Login with Telegram"
2. Telegram Login Widget opens, user authorizes
3. Widget returns auth data (id, hash, auth_date)
4. Frontend POSTs auth data to /auth/telegram
5. Worker verifies hash using bot token (server-side)
6. Worker checks auth_date is within 24h
7. Worker generates JWT access token (15min) + refresh token (7d)
8. Frontend stores tokens (access in memory, refresh in httpOnly cookie)
9. All subsequent requests use Authorization: Bearer <access_token>
```

## JWT Token Strategy

```javascript
// Access token (15 minutes)
{
  sub: "usr_xxx",
  tgId: 123456789,
  iat: 1700000000,
  exp: 1700000900
}

// Refresh token (7 days, single-use)
{
  sub: "usr_xxx",
  jti: "unique_id",
  type: "refresh",
  iat: 1700000000,
  exp: 1700604800
}
```

- Access tokens are signed with RS256 (asymmetric)
- Refresh tokens are signed with HS256 and stored in KV
- On refresh, old refresh token is invalidated (rotation)

## Encryption Strategy

### MTProto Session Encryption

```javascript
// Each user has a derived key:
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
  masterKey,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
);

// Session string encrypted:
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  key,
  new TextEncoder().encode(sessionString)
);
```

### D1 Storage
```sql
-- telegram_sessions table stores:
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
encrypted_session BLOB NOT NULL,  -- AES-256-GCM encrypted
iv BLOB NOT NULL,                  -- Initialization vector
salt BLOB NOT NULL,                -- PBKDF2 salt
phone TEXT,
created_at INTEGER NOT NULL
```

## Environment Variables (Cloudflare)

```toml
# wrangler.toml
[vars]
JWT_ALGORITHM = "RS256"
JWT_ACCESS_EXPIRY = "900"
JWT_REFRESH_EXPIRY = "604800"
ENCRYPTION_ITERATIONS = "100000"

# Secrets (set via wrangler secret)
# TELEGRAM_BOT_TOKEN
# JWT_PRIVATE_KEY
# JWT_PUBLIC_KEY
# ENCRYPTION_MASTER_KEY
# TELEGRAM_API_ID
# TELEGRAM_API_HASH
# COOKIE_SECRET
```

## CORS Configuration

```javascript
const CORS_ORIGINS = [
  "https://username.github.io",
  "https://telegram-drive.example.com",
  "http://localhost:8080"  // Development
];

// Strict: no wildcards, no credentials exposure
// Vary: Origin header for cache
```

## Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://telegram.org;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.telegram-drive.workers.dev;
  frame-src 'self' https://oauth.telegram.org;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
```

## Rate Limiting

```javascript
// Token bucket algorithm
const RATE_LIMITS = {
  "GET /api/v1/folders":     { window: 60, max: 100 },
  "POST /api/v1/upload/*":   { window: 60, max: 10 },
  "POST /api/v1/auth/*":     { window: 60, max: 5 },
  "GET /api/v1/search":      { window: 60, max: 30 },
  "GET /api/v1/files/*/download": { window: 60, max: 20 },
};
```

## Input Validation Rules

| Field | Rule |
|-------|------|
| Folder name | 1-100 chars, alphanumeric + spaces + hyphens |
| File name | 1-255 chars, no path separators |
| File size | 1 byte - 2GB (2147483648) |
| File type | Whitelist of allowed MIME types |
| Phone number | E.164 format |
| Auth hash | 64 char hex string |
| Custom color | Valid hex color (#RRGGBB) |
| Icon name | Alphanumeric + hyphens only |

## Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
