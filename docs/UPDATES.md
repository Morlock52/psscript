# Application Updates

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
