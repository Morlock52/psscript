# Data Maintenance (Backups, Restore, and Test Data Cleanup)

_Last updated: February 14, 2026_

This project now includes admin-only data maintenance tools under **Settings → Data Maintenance** and matching backend admin API routes.

## What this system does

- Create JSON backups of all application tables (except `schema_migrations`).
- List available backups from the server backup directory.
- Restore database content from a selected backup.
- Clear test/data tables used by scripts, analyses, versions, tags, logs, and chat history while preserving core reference/identity tables.

## Install + enable prerequisites

1. Ensure admin users are enabled in normal auth flow.
2. Confirm the backend can write to a backup directory:

```bash
export DB_BACKUP_DIR=/path/to/psscript-db-backups
mkdir -p "$DB_BACKUP_DIR"
```

If `DB_BACKUP_DIR` is not set, backups are written to `/tmp/psscript-db-backups`.

3. Confirm the backend route is mounted:

- `POST /api/admin/db/backup`
- `GET /api/admin/db/backups`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

4. Ensure role-based access is enabled (`admin` role required).

The script examples below default to `--base-url "http://localhost:3001"`.  
If your backend is exposed on a different host or port, set `API_URL`/`API_BASE_URL` or pass `--base-url`.

## Install script usage (local development)

From repository root:

```bash
cp .env.example .env
# set DB_BACKUP_DIR to a writable absolute path
export DB_BACKUP_DIR=/abs/path/psscript-db-backups
mkdir -p "$DB_BACKUP_DIR"
```

## Using the UI (recommended)

Navigate to `Settings -> Data Maintenance` (admin users only).

- **Create backup**
  - Optionally enter a filename and click **Create Backup**.
- **Restore**
  - Select a backup from the list and type `RESTORE BACKUP`.
  - Confirm by clicking **Restore Selected Backup**.
- **Clear test data**
  - (optional) Enable backup before clear if you want rollback safety.
  - Type `CLEAR TEST DATA`.
  - Click **Clear Test Data**.

## API usage examples

> All endpoints require an admin JWT in `Authorization: Bearer <token>` unless your environment runs with auth disabled.

### List backups

```bash
curl -X GET "$API_URL/api/admin/db/backups" \
  -H "Authorization: Bearer $TOKEN"
```

### Create backup

```bash
curl -X POST "$API_URL/api/admin/db/backup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"pre-release-2026-02-14"}'
```

### Restore backup

```bash
curl -X POST "$API_URL/api/admin/db/restore" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"pre-release-2026-02-14.json"}'
```

### Clear test data

```bash
curl -X POST "$API_URL/api/admin/db/clear-test-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "confirmText":"CLEAR TEST DATA",
        "backupFirst": true,
        "backupFilename":"pre-clear-test-data-2026-02-14"
  }'
```

The response includes:

- `requestedTables`: tables requested by the caller (or defaults used)
- `filteredTables`: tables confirmed to exist in the database schema
- `ignoredTables`: tables requested but skipped (not found)

You can also pass a custom table list (safe table names only):

```bash
curl -X POST "$API_URL/api/admin/db/clear-test-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "confirmText":"CLEAR TEST DATA",
        "backupFirst": false,
        "tables":["scripts","script_versions","execution_logs"]
  }'
```

## Stress testing

Pre-flight validation is built in with a maintenance smoke check. It validates:

- list backups endpoint response shape
- backup creation
- restore by name
- clear with response schema and table filtering metadata

Use the smoke mode to validate endpoints before running repeated cycles:

```bash
node scripts/db-maintenance-stress-test.mjs \
  --base-url "http://localhost:3001" \
  --smoke-only
```

Use `--no-smoke` to skip pre-flight checks.

Run stress loops:

Use the repository script to execute repeated maintenance operations:

```bash
node scripts/db-maintenance-stress-test.mjs \
  --base-url "http://localhost:3001" \
  --cycles 10
```

You can verify rollback in each cycle by restoring immediately after each clear with:

```bash
node scripts/db-maintenance-stress-test.mjs \
  --base-url "http://localhost:3001" \
  --cycles 10 \
  --restore-after-clear
```

You can also keep clear protection enabled and run a full smoke+stress sequence:

```bash
npm run stress:data-maintenance -- --base-url "http://localhost:3001" --cycles 10
```

You can run smoke + restore validation via package alias:

```bash
npm run stress:data-maintenance:smoke:restore -- --base-url "http://localhost:3001"
```

For local HTTPS endpoints with self-signed certificates:

```bash
npm run stress:data-maintenance:smoke:restore -- --base-url "https://127.0.0.1:4000" --insecure-tls
```

You can run a full local end-to-end verifier that builds backend, starts it, waits for health, runs smoke+restore checks, then shuts backend down:

```bash
npm run verify:data-maintenance:e2e -- --base-url "http://localhost:3001"
```

If backend is already running and you only want verification:

```bash
npm run verify:data-maintenance:e2e:reuse -- --base-url "http://localhost:3001"
```

For self-signed HTTPS backends, append `--insecure-tls`.

Smoke output includes:

- check-by-check success status
- backup names used during validation
- per-cycle `restoredAfterClear` payload when `--restore-after-clear` is set

Optional parameters and env vars:

- `--cycles N` / `DB_STRESS_CYCLES`
- `--base-url URL` / `API_URL`
- `--token TOKEN` / `ADMIN_TOKEN`
- `--smoke-only` (run only the endpoint smoke check)
- `--no-smoke` (skip pre-flight smoke checks)
- `--no-backup-first` (disables backup before clear)
- `--restore-after-clear` (restores from backup created at cycle start after clear)
- `--insecure-tls` (disables TLS verification for local/self-signed testing)
- `--help` (print full CLI usage)
- `DB_STRESS_REQUEST_TIMEOUT_MS`
- `DB_STRESS_REPORT_FILE`

## CI support

GitHub Actions now includes a `Maintenance Smoke` job that:

1. starts backend with Postgres + Redis services,
2. runs `npm run verify:data-maintenance:e2e`.

Artifacts include backend startup logs and backup directory output for troubleshooting.

## Safety notes

- Always back up before clear operations.
- Keep backup files in version control only if they are sanitized and safe.
- Use this tooling in a controlled maintenance window for production.

## Support for this script

If the script is failing, capture:

1. Exact command and flags used
2. `DB_STRESS_REPORT_FILE` output when possible
3. backend URL, token source, and `DB_BACKUP_DIR`
4. backend logs from the failure window
5. `npm run stress:data-maintenance:smoke -- --help` output for the exact flags supported in your checkout

## Support

- For usage questions: follow the support workflow in `docs/SUPPORT.md`.
- For runtime issues: collect these logs before escalation:
  - `src/backend/logs/*.log`
  - backup command output
  - result payload from `/api/admin/db/clear-test-data`
