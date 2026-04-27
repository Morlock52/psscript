# PSScript Getting Started

_Last updated: April 27, 2026_

Use [Setup Guide With Screenshots](./SETUP-WITH-SCREENSHOTS.md) for the full component-by-component setup. This page is the short path.

## Current Posture

- Production path: Netlify frontend + Netlify Functions + hosted Supabase.
- Local development path: Vite frontend, Express backend, FastAPI AI service, hosted Supabase `DATABASE_URL`.
- Docker is retired from active setup and preserved only under `retired/docker/`.
- Google OAuth users are disabled by default until an admin enables them in Settings -> User Management.

## Local URLs

| Component | URL |
| --- | --- |
| Frontend | `https://127.0.0.1:3090` |
| Backend API | `https://127.0.0.1:4000` |
| AI service | `http://127.0.0.1:8000` |

## Prerequisites

- Node.js 20+
- Python 3.10+
- hosted Supabase project with migrations applied
- Supabase pooler `DATABASE_URL`
- OpenAI and/or Anthropic API keys

## Install

```bash
npm install
npm install --prefix src/frontend
npm install --prefix src/backend
python3 -m pip install -r src/ai/requirements.txt
```

## Configure

Create `.env` at the repo root:

```bash
DATABASE_URL=postgresql://...supabase-pooler-url...
DB_PROFILE=supabase
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DEFAULT_ADMIN_EMAIL=admin@example.com
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_HOSTED_STATIC_ANALYSIS_ONLY=true
```

Apply Supabase migrations in filename order from `supabase/migrations/`.

## Run

Recommended validation startup:

```bash
npx playwright test tests/e2e/project-review-validation.spec.ts --project=chromium
```

Manual startup:

```bash
# terminal 1
cd src/ai
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

```bash
# terminal 2
cd src/backend
npm run dev
```

```bash
# terminal 3
cd src/frontend
npm run dev -- --host 0.0.0.0 --port 3090
```

## Validate

```bash
cd src/backend
npm run build
npm test -- --runInBand --forceExit
```

```bash
cd src/frontend
npm run build
```

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript
npx playwright test --project=chromium
```

## Screenshots And Setup Details

See [Setup Guide With Screenshots](./SETUP-WITH-SCREENSHOTS.md) for:

- Supabase setup
- Google OAuth approval gate
- Netlify setup
- AI model defaults
- documentation AI scanning
- PDF report export
- screenshots for login, pending approval, scripts, analysis, documentation, settings, and data maintenance
