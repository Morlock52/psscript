# Repair Test Results - 2026-04-28

## Scope

This report records the validation pass after executing the repair plan in `docs/REPAIR-EXECUTION-PLAN-2026-04-28.md`.

The fixes were aligned to the whole-project direction:

- Netlify remains the production application/runtime target.
- Supabase remains the hosted database target; no local database replacement was introduced.
- Archived local/private material was preserved under `archive/` instead of being deleted.
- Tests no longer require tracked local private keys; Playwright generates short-lived TLS files under `output/playwright/certs/`.

## Executed Fixes

| Issue | Result |
| --- | --- |
| Bearer token in SSE stream URL | Fixed by replacing `EventSource` query-token streaming with `fetch` streaming and `Authorization` headers. |
| Unauthenticated legacy database control route | Fixed by adding JWT and admin middleware to database diagnostics/control routes. |
| Legacy/backend sensitive routes lacking auth | Fixed by adding authentication/admin protection to documentation crawl, bulk documentation, script analysis, generation, explanation, version, and export routes. |
| Hosted Supabase auth tests mocked only axios | Fixed by mocking the project Supabase wrapper and hosted auth behavior directly. |
| CSS import order warning | Fixed by moving CSS imports before Tailwind directives. |
| Token CSS parse issue | Fixed by removing the invalid nested comment pattern in the token stylesheet. |
| Public AI frontend routes | Fixed by wrapping `/chat` and `/ai/assistant` in `ProtectedRoute`. |
| Direct message HTML rendering | Fixed by using the centralized `SafeHtml` sanitizer component in the agentic message list. |
| Frontend API `@ts-nocheck` and upload debug logging | Fixed by typing the axios interceptor path and removing sensitive upload debug logs. |
| Dependency audit issues | Fixed by removing unused root/frontend dependencies, upgrading active frontend tooling, and moving Netlify CLI use to pinned `npx` execution. |
| Active local private material | Fixed by moving old tracked certs and local Netlify state into `archive/local-private-material-2026-04-28/` and adding ignore rules. |
| Superseded Markdown report sprawl | Fixed by moving older active reports into `docs/archive/superseded-reports-2026-04-28/` and updating `docs/index.md`. |

## Validation Commands

| Command | Result |
| --- | --- |
| `npm run build` in `src/backend` | Passed. |
| `npm test -- --run --maxWorkers=1` in `src/frontend` | Passed: 16 files, 109 tests. |
| `npm run build` in `src/frontend` | Passed. |
| `npm audit --json` at repository root | Passed: 0 vulnerabilities. |
| `npm audit --json` in `src/frontend` | Passed: 0 vulnerabilities. |
| `npm run netlify:build` | Passed: Netlify build completed and function bundling completed. |
| `npm run test:e2e:chromium` | Passed: 37 passed, 3 skipped. |
| Targeted security grep for stream token query patterns | Passed: no `EventSource`, query-token helper, or `auth_token=` stream URL pattern found. |
| Targeted HTML rendering grep | Passed: direct `dangerouslySetInnerHTML` remains centralized in `SafeHtml` only. |

## Netlify Lighthouse Plugin Note

The Netlify build completed successfully, but the installed `@netlify/plugin-lighthouse` post-build probe still reported a local `/` 404:

```text
ERRORED_DOCUMENT_REQUEST
Lighthouse was unable to reliably load the page you requested. (Status code: 404)
```

This did not fail the Netlify build. It appears to be a plugin/runtime probe configuration issue rather than a frontend build failure because the frontend production build produced `dist/index.html` and the Netlify build completed function bundling.

## Residual Operational Notes

- If any archived certificate or key under `archive/local-private-material-2026-04-28/` was ever used outside disposable local development, rotate it outside the repository.
- Root-level Sequelize was removed from the root dependency graph to keep the Netlify/Supabase-oriented root audit clean. Active backend packages keep their own database dependencies.
- The Playwright run used the configured hosted Supabase database path; it did not introduce or depend on a local database.
