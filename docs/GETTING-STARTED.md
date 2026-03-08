# PSScript - Getting Started Guide

This guide reflects the current checked-in local development setup as of March 6, 2026.

## Canonical local URLs

- Frontend: `https://127.0.0.1:3090`
- Backend API: `https://127.0.0.1:4000`
- AI service: `http://127.0.0.1:8000`

## Current local auth behavior

The common checked-in frontend mode uses:

```bash
VITE_DISABLE_AUTH=true
```

That means:
- the frontend auto-signs in as `dev-admin`
- `/login` redirects to `/dashboard`
- login-form-only browser tests are intentionally skipped in the default local suite
- older docs that reference hard-coded demo credentials are historical only

If you need to validate real login behavior, disable `VITE_DISABLE_AUTH` and restart the frontend.

## Prerequisites

- Node.js 18+
- Python 3.10+
- Docker Engine with `docker compose`
- PostgreSQL 15+ with `pgvector`
- Redis 7+

## Quick start

```bash
npm run install:all
python -m pip install -r src/ai/requirements.txt
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

Or start services individually:

```bash
# backend
cd src/backend && npm install && npm run dev

# frontend
cd src/frontend && npm install && npm run dev

# ai service
cd src/ai && python -m pip install -r requirements.txt && python main.py
```

## Recommended first validation steps

```bash
cd src/backend && npm run lint
cd src/backend && npm run build
cd src/backend && npm test -- --runInBand
cd src/backend && RUN_DB_TESTS=true npm test -- --runInBand
cd src/frontend && npm run lint
cd src/frontend && npm run build
cd src/frontend && npm run test:run
cd src/ai && python test_langgraph_setup.py
node scripts/verify-data-maintenance-e2e.mjs --reuse-backend --base-url https://127.0.0.1:4000 --insecure-tls
node scripts/voice-tests-1-8.mjs --base-url https://127.0.0.1:4000 --insecure-tls
npx playwright test --project=chromium
```

## Canonical current docs

- `../README.md`
- `../src/backend/README.md`
- `../src/frontend/README.md`
- `../src/ai/README.md`
- `./DATA-MAINTENANCE.md`
- `./README-VOICE-API.md`
- `./AUTHENTICATION-IMPROVEMENTS.md`
- `./UPDATES.md`

## Optional local Git auto-update

If you want this clone to stay current automatically, the repo includes:

- `../scripts/setup/git-auto-update.sh`

Typical local setup on macOS:
- run the script from a `launchd` agent every 5 minutes
- let it `git fetch origin main`
- show a notification when `origin/main` changes
- allow `git pull --ff-only origin main` only when the current branch is `main` and the worktree is clean
