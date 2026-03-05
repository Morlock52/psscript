# Backend

Express/TypeScript API for authentication, script management, analytics, admin maintenance workflows, and AI-backed script operations.

## Current responsibilities

- Authentication and user/session APIs
- Script CRUD, versioning, search, and analysis orchestration
- AI compatibility routes for question answering, explanation, examples, and generation
- Analytics and reporting APIs
- Documentation crawl and storage APIs
- Admin backup, restore, and cleanup endpoints

## Current backend behavior

### Auth

- Protected routes use the shared `authMiddleware` path.
- Admin DB maintenance endpoints no longer rely on a separate legacy JWT middleware.
- Optional auth now resolves JWT secrets through the same auth configuration path as primary auth.
- Demo-token bypasses are rejected.
- Registration and profile updates translate uniqueness races into clean `409` responses:
  - `email_already_exists`
  - `username_already_exists`

### AI and script analysis

- Live backend routes no longer return fabricated mock AI payloads when the AI service fails.
- Legacy compatibility routes now return explicit upstream-service errors:
  - `502 ai_service_error`
  - `503 ai_service_unavailable`
  - `504 ai_service_timeout`
- Script analysis controllers return explicit API states instead of fabricated success payloads:
  - `404 analysis_not_found`
  - `502 analysis_service_error`
  - `503 analysis_unavailable`
  - `504 analysis_timeout`
- Async upload analysis now calls the real AI `/analyze` endpoint.
- Similar-script vector-search failures now return `503 vector_search_unavailable` instead of random similarity scores.

### Database maintenance

Admin endpoints:

- `GET /api/admin/db/backups`
- `POST /api/admin/db/backup`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

Restore truncates target tables, reloads backup rows, and reseeds serial/identity sequences afterward.

### Analytics

Analytics queries run through the shared Sequelize connection stack instead of a separate raw `pg` pool.

## Local runbook

From this directory:

```bash
npm install
npm run dev
```

Default local API endpoint:

```text
https://127.0.0.1:4000
```

The backend is commonly used together with:

- frontend: `https://127.0.0.1:3090`
- ai service: `http://127.0.0.1:8000`

## Validation

```bash
npm run build
npm test -- --runInBand
```

## Related docs

- `../../docs/DATA-MAINTENANCE.md`
- `../../docs/AUTHENTICATION-IMPROVEMENTS.md`
- `../../docs/API-ISSUE-REVIEW-2026-02-26.md`
- `../../docs/UPDATES.md`
