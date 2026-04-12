# Data Maintenance

_Last updated: March 6, 2026_

Admin-only database maintenance is exposed through backend routes under `/api/admin/db/*` and through the frontend settings UI at `/settings/data`.

![Data maintenance screenshot](./screenshots/data-maintenance.png)

## Canonical runtime

- frontend: `https://127.0.0.1:3090`
- backend: `https://127.0.0.1:4000`

## Current fixes reflected in code

- Admin DB endpoints use the same shared auth middleware as the rest of the backend.
- Backup listing bypasses the generic GET cache, so new backups appear immediately in `GET /api/admin/db/backups`.
- Restore inserts tables in foreign-key-safe order.
- Restore normalizes JSON-like backup values before insert.
- Restore reseeds serial and identity sequences after insert.
- Clear-test-data responses include requested, filtered, cleared, and ignored table lists.

## Endpoints

- `GET /api/admin/db/backups`
- `POST /api/admin/db/backup`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

All endpoints require an admin JWT unless auth is disabled locally.

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
- target tables are truncated with identity reset
- backup rows are restored in FK-safe order
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

## Validation helpers

From repo root:

```bash
node scripts/db-maintenance-stress-test.mjs --base-url "https://127.0.0.1:4000" --smoke-only --restore-after-clear --insecure-tls
node scripts/verify-data-maintenance-e2e.mjs --reuse-backend --base-url "https://127.0.0.1:4000" --insecure-tls
```

Latest live verification on April 12, 2026:
- backup listing passed
- backup creation passed
- restore passed
- clear-test-data passed
- restore-after-clear passed

Latest verified result on March 6, 2026:
- smoke check passed
- backup creation and immediate listing passed
- restore passed
- clear-test-data passed
- restore-after-clear passed

## Operational notes

- Back up before destructive cleanup.
- Use a maintenance window for production restores.
- If a long-running frontend container does not show `/settings/data`, rebuild or restart that container; the current source tree includes the page.
