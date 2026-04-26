# PSScript - Getting Started Guide

This guide reflects the current checked-in Netlify and Supabase setup as of April 26, 2026.

## Canonical local URLs

- Frontend: `https://127.0.0.1:3090`
- Backend API: `https://127.0.0.1:4000`
- AI service: `http://127.0.0.1:8000`

## Production targets

- Netlify frontend: `http://psscript.netlify.app`
- Database: hosted Supabase Postgres via `DATABASE_URL`
- Backend and AI service: hosted services configured through environment variables

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

If you need to validate real login behavior, run a separate frontend/backend pair with both auth-disable flags set to `false`.

## Prerequisites

- Node.js 18+
- Python 3.10+
- Netlify CLI for Netlify-compatible local builds
- A hosted Supabase Postgres database URL in `DATABASE_URL`
- Redis URL when running the backend with cache support

## Quick start

```bash
npm run install:all
python -m pip install -r src/ai/requirements.txt
cd src/frontend && npm run build
npm run netlify:build
```

For full local app testing, start services individually against Supabase:

```bash
# backend
cd src/backend && DATABASE_URL="$DATABASE_URL" DB_PROFILE=supabase DB_SSL=true npm run dev

# frontend
cd src/frontend && npm install && npm run dev

# ai service
cd src/ai && DATABASE_URL="$DATABASE_URL" DB_SSL=true python main.py
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
PLAYWRIGHT_STACK_MODE=local npx playwright test tests/e2e/project-review-validation.spec.ts --project=chromium
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

## Canonical screenshots

Refresh the checked-in screenshots with:

```bash
SCREENSHOT_BASE_URL=https://127.0.0.1:3090 \
SCREENSHOT_LOGIN_URL=http://127.0.0.1:3191 \
node scripts/capture-screenshots.js
```

Use `3191` only when you have an auth-enabled frontend running there for the real login screen. The rest of the screenshot set can still come from the default local app on `3090`.

Docker-era setup files and docs are archived under `../retired/docker/` for reference only.

## Optional local Git auto-update

If you want this clone to stay current automatically, the repo includes:

- `../scripts/setup/git-auto-update.sh`

Typical local setup on macOS:
- run the script from a `launchd` agent every 5 minutes
- let it `git fetch origin main`
- show a notification when `origin/main` changes
- allow `git pull --ff-only origin main` only when the current branch is `main` and the worktree is clean
