# PSScript - Getting Started Guide

This guide reflects the current local development setup.

## Current local URLs

- Frontend: `https://127.0.0.1:3090`
- Backend API: `https://127.0.0.1:4000`
- AI service: `http://127.0.0.1:8000`

## Current local auth behavior

The checked-in local environment commonly uses:

```bash
VITE_DISABLE_AUTH=true
```

That means:

- the frontend auto-signs in as `dev-admin`
- `/login` redirects to `/dashboard`
- old docs that reference `admin@psscript.com`, `ChangeMe1!`, `admin123`, or demo-token shortcuts are historical only

If you need to validate real login behavior, disable `VITE_DISABLE_AUTH` and use your actual seeded credentials.

## Prerequisites

- Node.js 18+
- Python 3.10+
- Docker Engine with `docker compose`
- PostgreSQL 15+ with `pgvector`
- Redis 7+

## Quick start

```bash
# from repo root
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

Or start services individually:

```bash
# backend
cd src/backend && npm install && npm run dev

# frontend
cd src/frontend && npm install && npm run dev

# ai service
cd src/ai && python main.py
```

## Canonical current docs

- `README.md`
- `src/backend/README.md`
- `src/frontend/README.md`
- `docs/DATA-MAINTENANCE.md`
- `docs/AUTHENTICATION-IMPROVEMENTS.md`
- `docs/API-ISSUE-REVIEW-2026-02-26.md`
- `docs/UPDATES.md`
