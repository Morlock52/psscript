# Data Maintenance

Last updated: April 28, 2026.

Data maintenance is an admin-only hosted workflow. It is available in the UI at Settings -> Data Maintenance and through Netlify Functions under `/api/admin/db/*`.

![Data maintenance screenshot](./screenshots/data-maintenance.png)

## Current Production Contract

- Production app: `https://pstest.morloksmaze.com`
- API runtime: Netlify Functions
- Database: hosted Supabase Postgres
- Backup metadata/state: hosted Supabase tables
- Local database: not used for active production or active docs

## Admin Routes

All routes require an authenticated enabled admin profile:

- `GET /api/admin/db/backups`
- `POST /api/admin/db/backup`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

The UI calls these routes from Settings -> Data Maintenance. Non-admins should not see or successfully call the destructive controls.

## Backup

Use Backup before any cleanup or restore operation. A backup record is written to hosted Supabase state so the operator can confirm the backup exists before continuing.

Recommended operator evidence:

- timestamp
- admin user
- backup filename/id
- route response
- matching row in the backup list

## Restore

Restore is destructive and should be treated as a maintenance-window operation.

Expected safety behavior:

- admin auth required
- backup record must exist
- tables restore in dependency-safe order
- identity sequences are reseeded after insert
- response reports success/failure clearly

## Clear Test Data

Clear Test Data removes fixture/test records only. It should not be used as a general production wipe.

Expected safety behavior:

- admin auth required
- explicit confirmation text required
- `backupFirst` should be enabled before destructive cleanup
- response includes requested, filtered, cleared, and ignored tables

## Hosted Smoke Checks

Use the UI first for normal validation:

1. Sign in as an enabled admin.
2. Open Settings -> Data Maintenance.
3. Create a backup.
4. Confirm the backup appears in the backup list without refreshing credentials.
5. Do not run restore or clear operations on production unless the maintenance task explicitly calls for it.

Authenticated API checks can be run with a real Supabase access token:

```bash
curl -fsS "https://pstest.morloksmaze.com/api/admin/db/backups" \
  -H "Authorization: Bearer $TOKEN"
```

## Escalation Data

When maintenance fails, collect:

- exact UI action and timestamp
- Netlify Function logs for the timestamp
- Supabase logs for the same window
- the route response payload
- backup filename/id
- admin account used
- whether `backupFirst` was enabled

Do not delete failed backup records during investigation. Move outdated write-ups to `docs/archive/` only if they are no longer active docs.
