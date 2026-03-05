# PSScript

AI-assisted PowerShell script management, analysis, and documentation tooling.

![Dashboard screenshot](./docs/screenshots/dashboard.png)

## Current local defaults

| Service | URL | Notes |
| --- | --- | --- |
| Frontend | `https://127.0.0.1:3090` | Vite dev server over HTTPS |
| Backend API | `https://127.0.0.1:4000` | Express + TypeScript |
| AI service | `http://127.0.0.1:8000` | FastAPI |
| PostgreSQL | `localhost:5432` | Primary DB with pgvector |
| Redis | `localhost:6379` | Cache and background state |

## What is current in this repo

- JWT-protected backend APIs with a single shared auth middleware.
- Admin database maintenance endpoints for backup, restore, and test-data cleanup.
- Script analysis endpoints that now return explicit failure states instead of fabricated success payloads.
- Analytics queries running through the shared Sequelize connection stack.
- React/Vite frontend running on port `3090` with route-level lazy loading.

## Local development

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker Engine with `docker compose`
- PostgreSQL 15+ with `pgvector`
- Redis 7+

### Start the full stack

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

### Start services individually

```bash
# backend
cd src/backend && npm install && npm run dev

# frontend
cd src/frontend && npm install && npm run dev

# ai service
cd src/ai && python main.py
```

## Authentication behavior in local dev

The checked-in local `.env` currently sets `VITE_DISABLE_AUTH=true`.
That means the frontend auto-creates a local `dev-admin` session instead of showing the login form.
If you want to validate the real login flow, disable that flag and use your seeded credentials or demo env vars.

## Important operational notes

### Admin data maintenance

Admin maintenance routes live under:

- `GET /api/admin/db/backups`
- `POST /api/admin/db/backup`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

Restore now reseeds serial and identity sequences after bulk inserts, so post-restore writes do not collide on reused IDs.

### Script analysis API semantics

The backend no longer returns mock analysis data when no stored analysis exists or the AI service fails.
Current behavior is:

- `404 analysis_not_found`
- `502 analysis_service_error`
- `503 analysis_unavailable`
- `504 analysis_timeout`

### Analytics DB access

Analytics now uses the same shared Sequelize-managed database connection layer as the rest of the backend.

## Validation commands

```bash
# backend
cd src/backend && npm run build
cd src/backend && npm test -- --runInBand

# frontend
cd src/frontend && npm run build
cd src/frontend && npm run test:run
```

## Canonical docs

- [src/backend/README.md](./src/backend/README.md)
- [src/frontend/README.md](./src/frontend/README.md)
- [docs/DATA-MAINTENANCE.md](./docs/DATA-MAINTENANCE.md)
- [docs/AUTHENTICATION-IMPROVEMENTS.md](./docs/AUTHENTICATION-IMPROVEMENTS.md)
- [docs/API-ISSUE-REVIEW-2026-02-26.md](./docs/API-ISSUE-REVIEW-2026-02-26.md)
- [docs/UPDATES.md](./docs/UPDATES.md)
- [docs/README-VOICE-API.md](./docs/README-VOICE-API.md)
