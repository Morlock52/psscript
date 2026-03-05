# Data Maintenance

_Last updated: March 5, 2026_

Admin-only database maintenance is exposed through backend routes under `/api/admin/db/*` and, in the current frontend source, through the settings UI at `/settings/data`.

![Data maintenance screenshot](./screenshots/data-maintenance.png)

## What changed recently

- Admin DB endpoints now use the same shared auth middleware as the rest of the backend.
- Restore now reseeds serial and identity sequences after inserting backup rows.
- Clear-test-data responses include requested, filtered, and ignored table lists.
- Screenshot assets were refreshed from the current workspace-backed frontend session.

## Endpoints

- `GET /api/admin/db/backups`
- `POST /api/admin/db/backup`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

All endpoints require an admin JWT unless auth is disabled in local development.

## Backup directory

```bash
export DB_BACKUP_DIR=/path/to/psscript-db-backups
mkdir -p "$DB_BACKUP_DIR"
```

If `DB_BACKUP_DIR` is unset, the backend writes backups to `/tmp/psscript-db-backups`.

## API examples

### List backups

```bash
curl -k -X GET "https://127.0.0.1:4000/api/admin/db/backups" \
  -H "Authorization: Bearer $TOKEN"
```

### Create backup

```bash
curl -k -X POST "https://127.0.0.1:4000/api/admin/db/backup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"before-release"}'
```

### Restore backup

```bash
curl -k -X POST "https://127.0.0.1:4000/api/admin/db/restore" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"before-release.json"}'
```

Restore semantics:

- target tables are truncated with `RESTART IDENTITY CASCADE`
- backup rows are inserted table by table
- sequences are reseeded with `setval(...)` after inserts complete

### Clear test data

```bash
curl -k -X POST "https://127.0.0.1:4000/api/admin/db/clear-test-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "confirmText":"CLEAR TEST DATA",
        "backupFirst":true,
        "backupFilename":"pre-clear-test-data"
      }'
```

Optional table filtering:

```bash
curl -k -X POST "https://127.0.0.1:4000/api/admin/db/clear-test-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "confirmText":"CLEAR TEST DATA",
        "backupFirst":false,
        "tables":["scripts","script_versions","execution_logs"]
      }'
```

## Validation helpers

From repo root:

```bash
node scripts/db-maintenance-stress-test.mjs --base-url "https://127.0.0.1:4000" --smoke-only --insecure-tls
npm run stress:data-maintenance:smoke:restore -- --base-url "https://127.0.0.1:4000" --insecure-tls
npm run verify:data-maintenance:e2e -- --base-url "https://127.0.0.1:4000" --insecure-tls
```

## Operational notes

- Back up before any destructive cleanup.
- Use a maintenance window for production restores.
- If the long-running Docker frontend does not show `/settings/data`, restart or rebuild that frontend service; the current source tree includes the route and page.
