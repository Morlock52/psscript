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
- Local AI chat routing through provider SDK-backed controller paths

## Current backend behavior

### Auth

- Protected routes use the shared `authMiddleware` path.
- Admin DB maintenance routes use the same auth middleware as the rest of the backend.
- Optional auth resolves secrets through the same auth configuration path as primary auth.
- Demo-token shortcuts are rejected.
- Registration and profile uniqueness races return `409` instead of `500`.

### Scripts and AI

- Script creation returns immediately after the DB write and runs AI analysis in the background.
- Script upload endpoints now authenticate through the shared JWT middleware before the upload controller runs.
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

### Documentation APIs

Documentation routes depend on the `documentation` table. The current schema and migration include it:

- `../../src/db/schema.sql`
- `../../src/db/migrations/20260424_create_documentation_table.sql`

Browser Use retesting on 2026-04-24 confirmed `/documentation`, `/documentation/crawl`, and `/documentation/data` render after the migration.

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
- live upload/save flow through `/api/scripts/upload`

Latest browser/API validation on April 24, 2026:
- `/api/health` passed through the app origin.
- Documentation API regression was fixed with the `documentation` table migration.
- Browser Use RUN2 passed current console health with no new relevant errors after the corrected run.

Prior backend suite results from March 6, 2026:
- `npm run lint`: passed with `2` existing camelcase warnings in `src/routes/__tests__/admin-db.test.ts`
- `npm run build`: passed
- `npm test -- --runInBand`: `29` active tests passed, `64` skipped
- `RUN_DB_TESTS=true npm test -- --runInBand`: `93` tests passed

Known non-blocking warnings:
- `2` camelcase lint warnings in `src/routes/__tests__/admin-db.test.ts`
- existing dependency-driven Node `url.parse()` deprecation warning during tests

## Related docs

- `../../docs/DATA-MAINTENANCE.md`
- `../../docs/AUTHENTICATION-IMPROVEMENTS.md`
- `../../docs/API-ISSUE-REVIEW-2026-02-26.md`
- `../../docs/README-VOICE-API.md`
- `../../docs/UPDATES.md`
