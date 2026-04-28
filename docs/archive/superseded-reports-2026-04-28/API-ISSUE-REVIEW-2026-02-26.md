# API Issue Review

_Updated: March 5, 2026_

## Scope

This review reflects the backend and frontend state after the March 2026 API hardening pass and the follow-up removal of runtime mock backend responses.

## Resolved issues

### Auth stack mismatch

Resolved.

- Admin DB maintenance routes no longer use a separate legacy JWT verifier.
- Protected API routes now rely on the shared backend auth middleware path.
- Optional auth now resolves JWT secrets through the same auth configuration path as primary auth.

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

### Legacy AI compatibility routes fabricated success payloads

Resolved.

Live backend compatibility routes no longer invent successful fallback answers, scripts, explanations, examples, or analysis payloads when the AI service is unavailable.
Current failure behavior is explicit:

- `502 ai_service_error`
- `503 ai_service_unavailable`
- `504 ai_service_timeout`

### Async upload analysis used the wrong AI endpoint and hid failure behind defaults

Resolved.

- Async upload analysis now calls the real AI `/analyze` endpoint.
- Upload processing no longer substitutes invented analysis data when the AI call fails.

### Similar-script search returned random similarity scores

Resolved.

- Vector-search failures now return `503 vector_search_unavailable`.
- The API no longer reports random fallback similarity values as if they were real search results.

### Separate raw analytics DB pool

Resolved.

- Analytics no longer depends on the legacy raw `pg` helper.
- Queries run through the same shared Sequelize connection configuration as the rest of the backend.

### Auth uniqueness races

Resolved.

- Registration and profile update paths now map DB uniqueness conflicts to `409` responses instead of leaking through as generic `500`s.

## Validation completed

The latest previously completed backend validation still stands:

```bash
cd src/backend && npm run build
cd src/backend && npm test -- --runInBand
```

Latest recorded local result from the follow-up pass:

- `3` suites passed
- `1` suite skipped
- `29` tests passed

Analysis controller coverage includes:

- missing analysis -> `404`
- upstream analysis error -> `502`
- analysis timeout -> `504`

## Frontend runtime note discovered during screenshot capture

The long-running Docker frontend can still serve stale source while the workspace-backed Vite session reflects current routes.
The refreshed screenshot set was generated from the current workspace-backed frontend session so the docs match the source tree.
