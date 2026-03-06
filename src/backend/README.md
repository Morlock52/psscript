# Backend

Express + TypeScript API for authentication, script management, analytics, admin maintenance workflows, documentation crawl storage, and AI-backed operations.

## Canonical local target

- Base URL: `https://127.0.0.1:4000`
- Frontend peer: `https://127.0.0.1:3090`
- AI service peer: `http://127.0.0.1:8000`

## Current responsibilities

- Authentication and user/session APIs
- Script CRUD, versioning, search, upload, and analysis orchestration
- Voice proxy routes and validation
- Analytics and reporting APIs
- Documentation crawl and storage APIs
- Admin backup, restore, and cleanup endpoints

## Current backend behavior

### Auth

- Protected routes use the shared `authMiddleware` path.
- Admin DB maintenance routes use the same auth middleware as the rest of the backend.
- Optional auth resolves secrets through the same auth configuration path as primary auth.
- Demo-token shortcuts are rejected.
- Registration and profile uniqueness races return `409` instead of `500`.

### Scripts and AI

- Script creation returns immediately after the DB write and runs AI analysis in the background.
- Script analysis endpoints return explicit failure states instead of fabricated success payloads.
- Legacy AI compatibility routes return explicit upstream-service failures instead of invented fallback data.
- Async upload analysis calls the real AI `/analyze` endpoint.
- Similar-script vector-search failures return `503 vector_search_unavailable` instead of random similarity scores.

### Database maintenance

Admin endpoints:
- `GET /api/admin/db/backups`
- `POST /api/admin/db/backup`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

Restore behavior now includes:
- truncation with identity reset
- foreign-key-safe table restore ordering
- normalization of JSON-like backup values before insert
- post-restore sequence reseeding with `setval(...)`

Backup listing is excluded from the generic GET cache so newly created backups appear immediately.

### Analytics

Analytics queries run through the shared Sequelize connection stack instead of a separate raw `pg` pool.

## Local runbook

```bash
npm install
npm run dev
```

## Validation

```bash
npm install
npm run lint
npm run build
npm test -- --runInBand
RUN_DB_TESTS=true npm test -- --runInBand
```

Current checked-in validation surface:
- lint
- TypeScript build
- unit and integration tests
- DB-enabled integration tests
- browser and API flows through Playwright and the maintenance verifier

Known non-blocking warnings:
- `2` camelcase lint warnings in `src/routes/__tests__/admin-db.test.ts`
- existing dependency-driven Node `url.parse()` deprecation warning during tests

## Related docs

- `../../docs/DATA-MAINTENANCE.md`
- `../../docs/AUTHENTICATION-IMPROVEMENTS.md`
- `../../docs/API-ISSUE-REVIEW-2026-02-26.md`
- `../../docs/README-VOICE-API.md`
- `../../docs/UPDATES.md`
