# Application Updates

## 2026-03-05 Backend hardening, docs refresh, and screenshots

### Backend/API

- Unified admin DB maintenance endpoints onto the shared backend auth middleware.
- Removed the legacy raw analytics DB access path and moved analytics onto the shared Sequelize connection layer.
- Fixed DB restore so serial and identity sequences are reseeded after restore.
- Changed script-analysis endpoints to return explicit failure responses instead of fabricated success payloads.
- Added analysis controller tests for:
  - `404 analysis_not_found`
  - `502 analysis_service_error`
  - `504 analysis_timeout`
- Updated registration and profile update flows to return `409` on email/username uniqueness conflicts.

### Frontend/build

- Removed the snake game.
- Added route-level lazy loading to reduce initial bundle cost.
- Refined Vite manual chunking and chunk warning thresholds for the current Monaco-heavy frontend build.
- Identified that the long-running Docker frontend can serve stale source until restarted or rebuilt.

### Documentation

- Refreshed the root, backend, and frontend READMEs to match current ports and local auth behavior.
- Updated canonical docs for authentication, API behavior, and data maintenance.
- Added current screenshots:
  - `docs/screenshots/dashboard.png`
  - `docs/screenshots/settings-profile.png`
  - `docs/screenshots/data-maintenance.png`

### Validation status

Latest completed local validation:

```bash
cd src/frontend && npm run build
cd src/frontend && npm run test:run
cd src/backend && npm run build
cd src/backend && npm test -- --runInBand
```

Results recorded during the recent passes:

- frontend: `4` test files, `33` tests passed
- backend: `3` suites passed, `1` suite skipped, `29` tests passed

## 2026-02-14 Voice platform and documentation sync

- Canonicalized voice API docs and test runners.
- Standardized voice validation around `scripts/voice-tests-1-8.mjs`.
- Added CI coverage for the voice test flow.
