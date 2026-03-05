# Backend - PowerShell Script Management Application

The backend API server handles script storage, retrieval, user authentication, and communication with the AI analysis system.

## Key Components

- **API Routes** - RESTful endpoints for all application features
- **Authentication** - JWT-based user authentication
- **Script Processing** - Upload, versioning, and execution
- **Integration Layer** - Communication with AI and PowerShell services

## Technology Stack

- Node.js with Express for API development
- JWT for secure authentication
- SQL ORM for database interactions
- Redis for caching frequently accessed scripts

## API Documentation

### Admin Data Maintenance

- `GET /api/admin/db/backups` - List available backups
- `POST /api/admin/db/backup` - Create backup from current DB
- `POST /api/admin/db/restore` - Restore database from backup
- `POST /api/admin/db/clear-test-data` - Clear configured test-data tables (requires admin and confirmation text)

You can find usage instructions and rollback workflow in `docs/DATA-MAINTENANCE.md` (project root docs).

## Testing

### Unit tests (default)

From this directory:

```bash
npm test
```

### Stress test (admin maintenance endpoints)

From repo root:

```bash
node scripts/db-maintenance-stress-test.mjs \
  --base-url "http://localhost:3001" \
  --cycles 5
```

You can run endpoint smoke validation only:

```bash
node scripts/db-maintenance-stress-test.mjs \
  --base-url "http://localhost:3001" \
  --smoke-only
```

Use `--no-smoke` to skip smoke validation and jump directly to cycles.
Use `--restore-after-clear` to validate restore rollback after each clear cycle.
Use `--insecure-tls` when targeting local self-signed HTTPS endpoints.
Use `npm run stress:data-maintenance:smoke:restore -- --base-url "http://localhost:3001"` from repo root for smoke+restore validation.
Use `npm run verify:data-maintenance:e2e -- --base-url "http://localhost:3001"` from repo root for a full automated backend build/start/verify/shutdown flow.

Provide `--token` or `ADMIN_TOKEN` for protected environments.

### DB integration tests (opt-in)

These require the Docker Postgres+pgvector service to be running.

From repo root (`/Users/morlock/fun/02_PowerShell_Projects/psscript`):

```bash
docker compose up -d postgres redis
cd src/backend && npm run test:integration
```
