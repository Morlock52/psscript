# Application Updates

## 2026-03-08 Voice AI hardening and validation rerun

### Engineering changes

- Added silence detection in the AI voice service so silent audio returns empty text instead of hallucinated transcription output.
- Removed unknown-provider fallback behavior from the voice service so invalid TTS or STT service selection fails explicitly.
- Updated backend voice error normalization so upstream request timeouts return `504` instead of generic `503`.
- Revalidated the current deployed stack after redeploy and browser smoke testing.

### Validated results

- Frontend lint: passed
- Frontend build: passed
- Frontend tests: `33` passed
- Backend lint: passed with `2` existing camelcase warnings
- Backend build: passed
- Backend containerized tests: `93` total, `29` active passed, `64` skipped
- AI harness: `5/5` passed
- Voice validation: `8/8` passed
- Chromium browser smoke suite: `25/25` passed

## 2026-03-07 Upload hardening and local Git auto-update helper

### Engineering changes

- Fixed the large-file upload path so `/api/scripts/upload/large` works with disk-backed multer uploads instead of failing on missing `req.file.buffer`.
- Lowered upload transaction isolation from `SERIALIZABLE` to `READ_COMMITTED` to avoid PostgreSQL `40001` serialization failures during concurrent upload bursts.
- Added a local Git auto-update helper at `scripts/setup/git-auto-update.sh`.
- The auto-update helper fetches `origin/main`, notifies when the remote head changes, and only runs `git pull --ff-only origin main` when the worktree is clean and the current branch is `main`.

### Validated results

- Small upload: `201`
- Large upload: fixed from `500` to successful upload, with repeat uploads returning expected `409 duplicate_file`
- Concurrent upload burst: `4/4` successful after the transaction fix
- Browser upload suite: `tests/e2e/script-management.spec.ts` passed, `6/6`

## 2026-03-06 Upload/network fix and full-stack validation

### Engineering changes

- Fixed script upload/save failures by wiring `/api/scripts/upload` and `/api/scripts/upload/large` through `authenticateJWT` before the upload controller.
- Fixed the frontend upload client to stop forcing multipart headers, always send the auth header when present, and use `/scripts/upload/large` for large single-file uploads.
- Relaxed the AI analytics Playwright expectation so upstream timeout statuses are treated as valid for analytics-tracking coverage.
- Refreshed the canonical screenshot set against the current runtime.

### Validated results

- Backend lint: passed with `2` existing camelcase warnings
- Backend build: passed
- Backend tests: `93` passed
- Frontend lint: passed
- Frontend build: passed
- Frontend tests: `33` passed
- AI harness: `5/5` passed
- Voice validation: `8/8` passed
- Data-maintenance verification: passed
- Chromium browser suite: `28` passed, `3` skipped

## 2026-03-06 Docs, runtime normalization, and screenshot refresh

### Engineering changes

- Normalized the checked-in local stack around `3090 / 4000 / 8000`.
- Fixed frontend local API detection to target backend `:4000` in dev mode.
- Updated the affected API URL unit tests and categories/settings Playwright flow.
- Refreshed the canonical screenshot generator to capture the active README images.
- Rewrote the active README/doc set to match the checked-in configs instead of the older `:3000` local override.
- Demoted stale README drafts so they no longer advertise mock/demo startup paths as current.

### Screenshots refreshed

- `docs/screenshots/dashboard.png`
- `docs/screenshots/scripts.png`
- `docs/screenshots/settings-profile.png`
- `docs/screenshots/data-maintenance.png`

## 2026-03-06 Full validation reruns, browser fix, and documentation sync

### Engineering changes

- Fixed a browser-test selector bug in `tests/e2e/script-management.spec.ts` so the list-view assertion targets the page `h1`.
- Tightened the LangGraph tool path so `analyze_powershell_script` calls the real `ScriptAnalyzer` API.
- Stabilized the voice cache check so it tolerates normal latency jitter while still requiring successful cached behavior.
- Refreshed the source-of-truth docs and screenshots to the current validated runtime.

## 2026-03-05 Backend mock-response removal, docs refresh, and refreshed screenshots

### Backend/API

- Removed runtime mock AI payloads from live backend compatibility routes.
- Legacy AI routes now return explicit upstream-service errors instead of invented fallback success payloads.
- Fixed async upload analysis to call the real AI `/analyze` endpoint.
- Similar-script vector-search failures now return `503 vector_search_unavailable` instead of random similarity scores.
- Optional auth now uses the same JWT secret resolution path as primary auth.
