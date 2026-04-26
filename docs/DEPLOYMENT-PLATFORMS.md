# Deployment Platforms

This is the current deployment plan for running PSScript without local Docker.
Docker-era files are archived in `/retired/docker` for reference only.

## Recommended topology

Use this layout:

1. Netlify for the frontend SPA
2. Hosted backend API
3. Hosted AI service
4. Supabase Postgres
5. Managed Redis / Key Value

This matches the actual codebase structure:

- frontend: React + Vite in `/src/frontend`
- backend: Express + TypeScript in `/src/backend`
- AI service: FastAPI in `/src/ai`
- stateful services: PostgreSQL and Redis

## Why this is the low-risk path

- Netlify is a strong fit for the Vite frontend.
- The backend and AI service both need long-running server processes and live database connectivity.
- The AI service is Python-based and should stay deployable as its own service.
- PostgreSQL and Redis should be managed services instead of app-local containers in production.

## Environment map

### Frontend

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `VITE_API_URL` | yes | Public backend API base URL | `https://api.example.com/api` |
| `VITE_DISABLE_AUTH` | yes | Must be `false` in production | `false` |
| `VITE_DEMO_EMAIL` | no | Local-only convenience | empty |
| `VITE_DEMO_PASSWORD` | no | Local-only convenience | empty |

### Backend

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | yes | Use `production` |
| `PORT` | yes | Bind port from host platform |
| `FRONTEND_URL` | yes | Public frontend origin for CSRF/CORS |
| `JWT_SECRET` | yes | JWT signing secret |
| `DISABLE_AUTH` | yes | Must be `false` in production |
| `DATABASE_URL` | yes | Supabase Postgres pooler URL |
| `DB_SSL` | yes | Use `true` |
| `DB_PROFILE` | yes | Use `supabase` |
| `REDIS_URL` | yes | Redis / Key Value connection string |
| `AI_SERVICE_URL` | yes | Internal AI service URL |
| `OPENAI_API_KEY` | yes | Used by backend-side OpenAI paths |

### AI service

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | yes | Bind port from host platform |
| `OPENAI_API_KEY` | yes | Primary OpenAI access |
| `ANTHROPIC_API_KEY` | no | Optional secondary provider |
| `DATABASE_URL` | yes | Supabase Postgres pooler URL |
| `DB_SSL` | yes | Use `true` |
| `DB_PROFILE` | yes | Use `supabase` |
| `CORS_ORIGINS` | yes | Public frontend origins allowed to call AI routes through the backend |

## Pre-deploy checklist

1. Set `VITE_DISABLE_AUTH=false`
2. Set a real public `VITE_API_URL`
3. Set `DISABLE_AUTH=false` on the backend
4. Set `FRONTEND_URL` to the real frontend origin
5. Set `CORS_ORIGINS` on the AI service to the real frontend origin list
6. Set `OPENAI_API_KEY` on backend and AI
7. Provision Supabase Postgres and managed Redis before deploying the backend
8. Deploy the AI service before the backend, or deploy both together with the backend pointed at the AI service URL

## Netlify

The repo already includes:

- `/netlify.toml`

It builds the frontend from `/src/frontend` and publishes the Vite `dist` output with SPA fallback routing.

Linked Netlify project:

- project: `psscript`
- primary site: `http://psscript.netlify.app`
- project URL: `https://app.netlify.com/projects/psscript`

### Netlify variables

Set these in Netlify:

- `VITE_API_URL=https://your-backend-domain/api`
- `VITE_DISABLE_AUTH=false`

## Backend And AI Hosting

The frontend is Netlify-first. The backend API and AI service should run as
hosted Node/Python services with managed Supabase Postgres and managed Redis.

Do not use Docker as the default deployment path. Historical Docker files were
moved to `/retired/docker` and should only be used for reference or recovery.

Backend and AI hosts must expose stable HTTPS URLs. After those URLs exist, set:

- Netlify `VITE_API_URL` to the backend API URL ending in `/api`
- Backend `AI_SERVICE_URL` to the hosted AI service URL
- Backend and AI `DATABASE_URL` to the Supabase pooler URL

## Post-deploy smoke checks

Run these after deployment:

1. Frontend root loads
2. Backend `/health` returns healthy
3. AI `/health` returns healthy
4. Login works with real auth
5. Script upload succeeds
6. Script analysis completes
7. Voice synth works
8. Voice recognition works
9. Admin backup listing and creation both work

## Recommended first production path

If you want the fewest moving parts:

1. Deploy frontend on Netlify
2. Deploy backend and AI on Render
3. Use managed Postgres and Render Key Value

That is the cleanest path for this repository as it exists today.
