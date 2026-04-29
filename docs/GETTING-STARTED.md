# PSScript Getting Started

Last updated: April 28, 2026.

Use this as the short path. Use [Setup Guide With Screenshots](./SETUP-WITH-SCREENSHOTS.md) for the longer walkthrough.

## Current Posture

- Production: `https://pstest.morloksmaze.com`
- Hosting: Netlify static site plus Netlify Functions.
- Database: hosted Supabase Postgres only.
- Auth: Supabase Auth plus admin approval in `app_profiles`.
- Local development: frontend can run locally, but database state should still point to hosted Supabase.
- Docker and local Postgres are retired from the active path and preserved only as history.

## Prerequisites

- Node.js 20+
- Python 3.10+ only if you are working on local AI service code
- Netlify CLI for deploy work
- hosted Supabase project with all migrations applied
- Supabase pooler `DATABASE_URL`
- OpenAI and/or Anthropic keys for AI-backed analysis and chat

## Install

```bash
npm install
npm install --prefix src/frontend
npm install --prefix src/backend
python3 -m pip install -r src/ai/requirements.txt
```

## Configure

Create `.env` at the repo root for local development and mirror production secrets in Netlify environment variables.

```bash
DATABASE_URL=postgresql://...supabase-pooler-url...
DB_PROFILE=supabase
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=...
DEFAULT_ADMIN_BOOTSTRAP_TOKEN=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_HOSTED_STATIC_ANALYSIS_ONLY=true
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, or provider keys as `VITE_*` values.

## Run The Frontend Locally

For UI work with mock data and no hosted mutations:

```bash
cd src/frontend
VITE_DISABLE_AUTH=true VITE_USE_MOCKS=true npm run dev -- --host 127.0.0.1 --port 5173
```

For hosted-auth testing, use real Supabase browser keys and keep auth enabled:

```bash
cd src/frontend
VITE_DISABLE_AUTH=false \
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_ANON_KEY=... \
npm run dev -- --host 127.0.0.1 --port 5173
```

## Deploy

```bash
npm run build:netlify
netlify deploy --prod
```

## Validate

```bash
cd src/frontend
npm test -- --run --maxWorkers=1
npm run build
```

```bash
curl -fsS https://pstest.morloksmaze.com/api/health
```

## Current Screenshots

Fresh screenshots are stored in:

- `docs/screenshots/current-2026-04-28/`
- `docs/screenshots/readme/`

They cover production login, desktop dashboard/scripts/upload/settings, agentic alias behavior, and mobile dashboard/navigation/scripts.
