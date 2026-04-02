# Deployment Platforms

This is the current deployment plan for running PSScript without the local-only issues that come from `127.0.0.1`, self-signed TLS, and dev-mode auth shortcuts.

## Recommended topology

Use this layout:

1. Netlify for the frontend SPA
2. Render or Railway for the backend API
3. Render or Railway for the AI service
4. Managed PostgreSQL
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
| `DB_HOST` | yes | Postgres host |
| `DB_PORT` | yes | Postgres port |
| `DB_NAME` | yes | Postgres database |
| `DB_USER` | yes | Postgres user |
| `DB_PASSWORD` | yes | Postgres password |
| `REDIS_URL` | yes | Redis / Key Value connection string |
| `AI_SERVICE_URL` | yes | Internal AI service URL |
| `OPENAI_API_KEY` | yes | Used by backend-side OpenAI paths |

### AI service

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | yes | Bind port from host platform |
| `OPENAI_API_KEY` | yes | Primary OpenAI access |
| `ANTHROPIC_API_KEY` | no | Optional secondary provider |
| `DB_HOST` | yes | Postgres host |
| `DB_PORT` | yes | Postgres port |
| `DB_NAME` | yes | Postgres database |
| `DB_USER` | yes | Postgres user |
| `DB_PASSWORD` | yes | Postgres password |
| `CORS_ORIGINS` | yes | Public frontend origins allowed to call AI routes through the backend |

## Pre-deploy checklist

1. Set `VITE_DISABLE_AUTH=false`
2. Set a real public `VITE_API_URL`
3. Set `DISABLE_AUTH=false` on the backend
4. Set `FRONTEND_URL` to the real frontend origin
5. Set `CORS_ORIGINS` on the AI service to the real frontend origin list
6. Set `OPENAI_API_KEY` on backend and AI
7. Provision Postgres and Redis before deploying the backend
8. Deploy the AI service before the backend, or deploy both together with the backend pointed at the AI service URL

## Netlify

The repo already includes:

- `/netlify.toml`

It builds the frontend from `/src/frontend` and publishes the Vite `dist` output with SPA fallback routing.

### Netlify variables

Set these in Netlify:

- `VITE_API_URL=https://your-backend-domain/api`
- `VITE_DISABLE_AUTH=false`

## Render

Official references used here:

- [Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Blueprints / infrastructure as code](https://render.com/docs/infrastructure-as-code)
- [Monorepo support](https://render.com/docs/monorepo-support)
- [Docker on Render](https://render.com/docs/docker)

This repo now includes:

- `/render.yaml`
- `/deploy/docker/backend.Dockerfile`
- `/deploy/docker/ai.Dockerfile`
- `/deploy/docker/frontend.Dockerfile`

### Render plan

The blueprint provisions:

1. Render Postgres
2. Render Key Value
3. AI web service
4. Backend web service

Values still marked `sync: false` must be set in Render after the first sync:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY` if used
- `FRONTEND_URL`
- `CORS_ORIGINS`

### Render sequence

1. Create a new Blueprint from this repo
2. Let Render create Postgres and Key Value
3. Set the missing secret/env values
4. Deploy AI
5. Deploy backend
6. Point Netlify `VITE_API_URL` at the backend public URL

## Railway

Official references used here:

- [Deploying a monorepo](https://docs.railway.com/guides/monorepo)
- [Dockerfiles](https://docs.railway.com/deploy/dockerfiles)
- [Build configuration](https://docs.railway.com/builds/build-configuration)
- [Services](https://docs.railway.com/guides/services)

Railway monorepos are easier to keep stable here by deploying each service with a dedicated Dockerfile path instead of relying on auto-detection from subdirectories.

Use the Dockerfiles in:

- `/deploy/docker/frontend.Dockerfile`
- `/deploy/docker/backend.Dockerfile`
- `/deploy/docker/ai.Dockerfile`

### Railway service setup

Create these Railway services:

1. `psscript-frontend`
2. `psscript-backend`
3. `psscript-ai`
4. PostgreSQL service
5. Redis service

For each app service:

1. Connect the GitHub repo
2. Keep the source at repo root `/`
3. In the Railway service settings, point the service at one of these Dockerfiles:
   - `/deploy/docker/frontend.Dockerfile`
   - `/deploy/docker/backend.Dockerfile`
   - `/deploy/docker/ai.Dockerfile`
4. Set the runtime env variables from the tables above
5. Generate a public domain for frontend and backend

### Railway notes

- The frontend Docker image serves the built SPA with nginx and SPA fallback routing.
- The backend and AI images bind to `0.0.0.0` and use runtime `PORT`.
- Keep `VITE_DISABLE_AUTH=false` and `DISABLE_AUTH=false` in production Railway services.

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
