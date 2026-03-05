# API Issue Review

_Updated: March 5, 2026_

## Scope

This review now reflects the backend and frontend state after the March 2026 API hardening pass.

## Resolved issues

### Auth stack mismatch

Resolved.

- Admin DB maintenance routes no longer use a separate legacy JWT verifier.
- Protected API routes now rely on the shared backend auth middleware path.
- This removes the risk of admin endpoints rejecting tokens issued by the normal login flow because of diverging secret sources or request-user shapes.

### DB restore sequence collisions

Resolved.

- Backup restore now reseeds serial and identity sequences after bulk row restore.
- New inserts after restore no longer reuse an existing primary key from restored rows.

### Fake script-analysis success payloads

Resolved.

The analysis controllers now return explicit failure states:

- `404 analysis_not_found`
- `502 analysis_service_error`
- `503 analysis_unavailable`
- `504 analysis_timeout`

### Separate raw analytics DB pool

Resolved.

- Analytics no longer depends on the legacy raw `pg` helper.
- Queries run through the same shared Sequelize connection configuration as the rest of the backend.

### Auth uniqueness races

Resolved.

- Registration and profile update paths now map DB uniqueness conflicts to `409` responses instead of leaking through as generic `500`s.

## Validation completed

Backend validation passed after the hardening changes:

```bash
cd src/backend && npm run build
cd src/backend && npm test -- --runInBand
```

Latest local result from the follow-up pass:

- `3` suites passed
- `1` suite skipped
- `29` tests passed

Analysis controller coverage now includes:

- missing analysis -> `404`
- upstream analysis error -> `502`
- analysis timeout -> `504`

## Frontend runtime note discovered during screenshot capture

The missing `/settings/data` route was traced to a stale Docker frontend runtime, not the current source tree.

Observed state on March 5, 2026:

- the long-running container on `https://127.0.0.1:3090` was serving an older `App.tsx`
- the workspace source contains `/settings/data` and `DataMaintenanceSettings`
- a temporary Vite session started from the current workspace rendered `/settings/data` correctly and produced the current screenshot asset

That means the backend admin maintenance API is healthy, and the remaining issue is runtime/frontend refresh hygiene for the Docker dev container.
