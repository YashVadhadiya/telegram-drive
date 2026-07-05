# Deployment Guide

## Prerequisites

- Node.js 18+
- Cloudflare Workers account
- GitHub account
- Telegram Bot Token (from @BotFather)

## Backend Deployment (Cloudflare Workers)

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put JWT_PRIVATE_KEY
wrangler secret put JWT_PUBLIC_KEY
wrangler secret put ENCRYPTION_MASTER_KEY
wrangler secret put TELEGRAM_API_ID
wrangler secret put TELEGRAM_API_HASH
wrangler secret put COOKIE_SECRET
```

### 3. Create D1 Database

```bash
wrangler d1 create telegram-drive-db
# Copy the database ID into wrangler.toml
wrangler d1 execute telegram-drive-db --file=backend/src/database/schema.sql
```

### 4. Create KV Namespace

```bash
wrangler kv:namespace create telegram-drive-kv
```

### 5. Deploy Worker

```bash
cd backend
npm install
wrangler deploy --env production
```

### 6. Configure Custom Domain (Optional)

```bash
wrangler route create --domain api.telegram-drive.com api/*
```

## Frontend Deployment (GitHub Pages)

### 1. Configure Repository

```bash
git init
git remote add origin https://github.com/username/telegram-drive.git
```

### 2. Set GitHub Pages Source

- Go to Settings → Pages
- Source: GitHub Actions
- Or: Deploy from branch `main` folder `/frontend`

### 3. GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend
      - uses: actions/deploy-pages@v4

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install
        working-directory: backend
      - run: npx wrangler deploy
        working-directory: backend
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Development Setup

### Backend

```bash
cd backend
npm install
wrangler dev --port 8787
```

### Frontend

Serve `frontend/` directory with any static server:

```bash
npx serve frontend -p 8080
```

## Environment Configuration

### wrangler.toml

```toml
name = "telegram-drive"
main = "src/index.js"
compatibility_date = "2024-12-18"

[[d1_databases]]
binding = "DB"
database_name = "telegram-drive-db"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"

[vars]
JWT_ACCESS_EXPIRY = "900"
JWT_REFRESH_EXPIRY = "604800"
ENCRYPTION_ITERATIONS = "100000"
CORS_ORIGIN = "https://username.github.io"
```

## Monitoring

- **Cloudflare Dashboard**: Worker metrics, D1 query stats, KV operations
- **Logs**: `wrangler tail` for real-time logs
- **Errors**: Cloudflare Workers dashboard → Analytics → Errors

## Rollback

```bash
wrangler rollback
# Or deploy a specific version:
wrangler deploy --version 42
```
