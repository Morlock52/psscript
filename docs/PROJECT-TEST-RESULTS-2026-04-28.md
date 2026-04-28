# PSScript Test Results

Run date: April 28, 2026. Environment: local checkout backed by hosted Supabase, plus Netlify production smoke at `https://pstest.morloksmaze.com`.

## Summary

- Overall local smoke/e2e status: passed for the runnable non-destructive suite.
- Production Netlify status: frontend and `/api/health` are reachable after the final deploy; Supabase database reports connected.
- Critical issue found: production `POST /api/auth/default-user` accepted unauthenticated requests and reset/created the default admin user. This was patched and deployed to production.
- AI analysis tracking was refactored to report prompt tokens, completion tokens, total tokens, estimated cost, failures, success/error rates, p95 latency, and provider/model/endpoint rollups.
- Database tooling now fails closed unless `DATABASE_URL` points at hosted Supabase Postgres.
- Performance issue found and partially fixed: the main app chunk was about 4.0 MB minified and 1.09 MB gzip; route-level code splitting reduced the initial app chunk to about 117 KB minified and 36 KB gzip. Heavy editor/highlight chunks remain lazy-loaded.
- Destructive stress test status: not run because the existing maintenance stress script clears/restores database data and needs explicit action-time approval before touching Supabase data.

## Commands Run

| Area | Command | Result |
| --- | --- | --- |
| Frontend unit tests | `npm run test:run` in `src/frontend` | Passed: 6 files, 46 tests |
| Frontend production build | `npm run build` in `src/frontend` | Passed, with large chunk warning |
| Netlify build | `netlify build` | Build passed; Lighthouse plugin reported `/` 404 but exited successfully |
| Smoke e2e | `playwright test tests/e2e/health-checks.spec.ts tests/e2e/authentication.spec.ts --project=chromium` | Passed: 10 passed, 3 skipped |
| Workflow e2e | `playwright test tests/e2e/script-management.spec.ts tests/e2e/categories-settings.spec.ts tests/e2e/ai-analytics.spec.ts --project=chromium` | Passed: 17 passed |
| Full Chromium e2e | `npm run test:e2e:chromium` | Passed: 37 passed, 3 skipped |
| Focused AI analytics e2e after tracking refactor | `playwright test tests/e2e/ai-analytics.spec.ts --project=chromium` | Passed: 10 passed |
| Backend TypeScript build | `npm run build` in `src/backend` | Passed |
| Root audit fix | `npm audit fix` | Reduced root audit to 14 moderate vulnerabilities; remaining fixes require `--force` breaking changes |
| Frontend audit fix | `npm audit fix` in `src/frontend` | Reduced frontend audit to 1 low and 5 moderate vulnerabilities; remaining fixes require `--force` breaking changes |
| Visual UI check | Computer Use + Chrome at `https://127.0.0.1:3090/dashboard` and `/scripts` | Dashboard and script table rendered correctly |
| Route sweep | Playwright route load across dashboard, scripts, chat, docs, settings | All returned 200; documentation routes logged backend 500 errors |
| Non-destructive API load | 25 concurrent requests per endpoint against local backend | 0 failures across health, scripts, categories, analytics summary |
| Netlify production smoke before fix | `GET /`, `GET /api/health`, `GET /api/scripts`, `POST /api/auth/default-user` | Frontend 200, health 200 connected, scripts 401 as expected, default-user 200 vulnerable |
| Netlify production smoke after deploy | `GET /`, `GET /api/health`, `GET /api/scripts`, `POST /api/auth/default-user` | Frontend 200, health 200 connected, scripts 401 as expected, default-user 401 fixed |
| Final Netlify production deploy | `netlify deploy --prod --site a6cb54b5-b3f7-4f01-a756-70b127f07e19` | Passed; deploy live at `69f0817deb552c25511786d4` |
| Final production smoke | `GET /`, `GET /api/health`, `GET /api/scripts`, `POST /api/auth/default-user` | Frontend 200, health 200 connected, scripts 401 as expected, default-user 401 fixed |
| Route code-splitting build | `npm run build` in `src/frontend` | Passed; initial app chunk reduced from ~4,011 KB to ~117 KB minified |
| AI analytics e2e after lazy-route wait fix | `playwright test tests/e2e/ai-analytics.spec.ts --project=chromium` | Passed: 10 passed |
| Production browser smoke after route splitting | Playwright Chromium on `/login` and `/documentation` | Passed; lazy route chunks loaded with no asset errors |
| Full Chromium e2e after backend cold-start wait fix | `npm run test:e2e:chromium` | Passed cleanly: 37 passed, 3 skipped |
| AI analysis criteria update | Research-backed review as of 2026-04-26; updated Netlify API, backend fallback, Python analyzer, frontend criteria UI, and Markdown export | Passed local validation |
| Frontend build after criteria UI | `npm run build` in `src/frontend` | Passed |
| Frontend unit tests after criteria UI | `npm test -- --run` in `src/frontend` | Passed: 46 passed |
| Backend TypeScript build after criteria prompt update | `npm run build` in `src/backend` | Passed |
| Netlify build after hosted analysis schema update | `npm run netlify:build` | Passed build and function bundling; local Lighthouse plugin reported 404 for `/` |
| Production deploy after criteria update | `./node_modules/.bin/netlify deploy --prod` | Passed; deploy live at `69f0a2ac3170e28b6fc70d44` |
| Production smoke after criteria deploy | `GET /`, `GET /api/health`, `GET /api/scripts`, `POST /api/auth/default-user` | Frontend 200, health 200 connected, scripts 401 as expected, default-user 401 fixed |

## Non-Destructive Load Results

| Endpoint | Requests | Failures | Status | p50 | p95 | Max |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| `/api/health` | 25 | 0 | 200 | 373 ms | 389 ms | 435 ms |
| `/api/scripts?limit=20&page=1` | 25 | 0 | 200 | 197 ms | 216 ms | 221 ms |
| `/api/categories` | 25 | 0 | 200 | 30 ms | 33 ms | 33 ms |
| `/api/analytics/summary` | 25 | 0 | 200 | 225 ms | 242 ms | 244 ms |

## Production Netlify/Supabase Findings

- `GET https://pstest.morloksmaze.com/` returned 200.
- `GET https://pstest.morloksmaze.com/api/health` returned 200 with `runtime: netlify-functions`, `database: connected`, and all checked Supabase/OpenAI/Anthropic env flags present.
- `GET https://pstest.morloksmaze.com/api/scripts?limit=5&page=1` returned 401, which is expected without an auth token.
- `POST https://pstest.morloksmaze.com/api/auth/default-user` returned 200 without auth. This confirmed the public admin bootstrap vulnerability.

## Fixes Executed

- `netlify/functions/api.ts`: `POST /api/auth/default-user` now requires `DEFAULT_ADMIN_BOOTSTRAP_TOKEN` via `x-bootstrap-token`, and `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` no longer have unsafe fallbacks.
- `src/frontend/src/contexts/AuthContext.tsx`: removed the browser-side call that invoked `/auth/default-user` during demo login.
- `.env.example`: documented `DEFAULT_ADMIN_PASSWORD` and `DEFAULT_ADMIN_BOOTSTRAP_TOKEN`.
- `package.json`: added canonical root scripts: `test`, `test:frontend`, `test:e2e`, and `test:e2e:chromium`.
- `docs/PROJECT-PERFORMANCE-TEST-DESIGN-2026-04-27.md`: added the requested test/performance design document.
- `netlify/functions/api.ts`, `src/backend/src/middleware/aiAnalytics.ts`, `src/frontend/src/pages/Analytics.tsx`, and `src/frontend/src/services/api.ts`: aligned AI usage tracking with current provider usage objects by separating prompt/input tokens, completion/output tokens, total tokens, failures, cost, success rate, and p95 latency.
- `scripts/lib/hosted-supabase-db.js`, backend database connection code, AI service DB connection code, and DB maintenance scripts: require hosted Supabase `DATABASE_URL` instead of local Postgres defaults.
- `src/frontend/src/App.tsx`: converted route page imports to retrying lazy imports under the existing `Suspense` boundary, reducing initial JavaScript substantially while preserving route behavior.
- `scripts/playwright-stack.sh`: increased the backend health wait for cold ts-node + hosted Supabase startup so the full Playwright suite does not time out before tests begin.
- Older previous-run Markdown reports were moved into `docs/archive/previous-run-reports-2026-04-28/`; nothing was deleted.
- Generated Playwright output logs/screenshots were moved into `docs/archive/generated-test-artifacts-2026-04-28/`; nothing was deleted.

## Production Deploy

- Production URL: `https://pstest.morloksmaze.com`
- Unique deploy URL: `https://69f0817deb552c25511786d4--psscript.netlify.app`
- Deploy logs: `https://app.netlify.com/projects/psscript/deploys/69f0817deb552c25511786d4`
- Post-deploy verification:
  - `GET /`: 200
  - `GET /api/health`: 200, `status: healthy`, `database: connected`
  - `POST /api/auth/default-user`: 401, `bootstrap_token_required`
  - `GET /api/scripts?limit=5&page=1`: 401, `missing_or_invalid_token`
- Netlify Lighthouse after route-splitting deploy: Performance 81, Accessibility 97, Best Practices 100, SEO 81, PWA 30.

## AI Analysis Criteria Update

- Criteria design source: [AI-ANALYSIS-CRITERIA-2026-04-26.md](./AI-ANALYSIS-CRITERIA-2026-04-26.md).
- Updated analysis contract: `criteria_version`, weighted `analysis_criteria`, `prioritized_findings`, `remediation_plan`, `test_recommendations`, and `confidence`.
- Persistence strategy: richer criteria are saved inside `execution_summary` JSONB, so hosted Supabase does not need a local or production database migration.
- Production URL: `https://pstest.morloksmaze.com`
- Unique deploy URL: `https://69f0a2ac3170e28b6fc70d44--psscript.netlify.app`
- Deploy logs: `https://app.netlify.com/projects/psscript/deploys/69f0a2ac3170e28b6fc70d44`
- Post-deploy verification:
  - `GET /`: 200
  - `GET /api/health`: 200, `status: healthy`, `database: connected`
  - `POST /api/auth/default-user`: 401, `bootstrap_token_required`
  - `GET /api/scripts?limit=5&page=1`: 401, `missing_or_invalid_token`
- Netlify Lighthouse after criteria deploy: Performance 75, Accessibility 97, Best Practices 100, SEO 81, PWA 30.

## Remaining Risks

- The current production admin password may have been reset by the previously vulnerable endpoint during verification. Rotate `DEFAULT_ADMIN_PASSWORD` and set a strong `DEFAULT_ADMIN_BOOTSTRAP_TOKEN`.
- Netlify build initially completed while the Lighthouse plugin reported `ERRORED_DOCUMENT_REQUEST` with status 404 for `/`. The production deploy later ran Lighthouse successfully, but performance is poor.
- The frontend initial route bundle is much smaller after lazy route splitting, but Monaco/editor and highlight-language chunks are still large when those routes are opened.
- Dependency audit is improved but not clean. Root has 14 moderate transitive vulnerabilities, mostly Netlify CLI / `uuid` chains requiring forced breaking changes. Frontend has 1 low and 5 moderate issues in Vite/esbuild and syntax highlighting chains, also requiring forced breaking changes.
- Documentation routes render but make API calls that return 500 locally. Those routes need backend/API follow-up.
- Several existing Playwright tests are weak because they allow missing UI via conditional assertions. Passing e2e results should be read as smoke coverage, not full workflow proof.
- Active database execution paths now require `DATABASE_URL` pointed at hosted Supabase. Legacy local schema material remains in the repository for reference, but the tested Netlify/local dev path does not use a local Postgres database.

## Gated Tests Not Run

`scripts/db-maintenance-stress-test.mjs --smoke-only --restore-after-clear` was not run. It performs backup, restore, and `clear-test-data` operations. Because that can delete or mutate Supabase data, it requires explicit confirmation immediately before execution.

## Recommended Next Fix Plan

1. Rotate the production default admin password and add `DEFAULT_ADMIN_BOOTSTRAP_TOKEN` in Netlify environment variables.
2. Reintroduce safe route-level code splitting for heavy pages while preserving the Cloudflare Access asset-cookie constraint.
3. Convert weak conditional Playwright assertions into required user-visible assertions for upload, analysis, analytics, and public route coverage.
4. Keep hosted Supabase migrations as the authoritative database path and retire or archive remaining legacy local-only setup scripts when no longer needed for reference.
5. Plan a controlled major-upgrade pass for Vite/react-syntax-highlighter/Netlify CLI/UUID transitive chains instead of using blind `npm audit fix --force`.
