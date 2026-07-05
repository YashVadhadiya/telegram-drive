# Telegram Drive

Cloud storage powered by Telegram Groups.

- **Frontend**: Vanilla JS SPA on GitHub Pages
- **Backend**: Cloudflare Workers + D1 + KV
- **Storage**: Telegram Bot API

## Architecture

Every folder = a Telegram Group. Every file = a Telegram message with document attachment.

## Live

- **API**: https://telegram-drive.yashvadhadiaj.workers.dev
- **Frontend**: https://YashVadhadiya.github.io/telegram-drive

## Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS ES Modules |
| Hosting | GitHub Pages |
| Backend | Cloudflare Workers |
| Database | D1 (SQLite) + KV |
| Storage | Telegram Bot API |
| Auth | Telegram Login Widget + JWT |
