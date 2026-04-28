# Codebase Review and Remediation Plan - 2026-04-28

## Scope

This review covers the current repository state for the PowerShell script management application, with emphasis on the production direction requested in prior work: Netlify-hosted frontend/functions and hosted Supabase/Postgres as the database. No local database path is treated as the desired target architecture.

The review used local code inspection, local build/test/audit commands, and current official guidance available on April 28, 2026.

## Current Research Sources

- Netlify Functions overview: https://docs.netlify.com/build/functions/overview/
- Netlify environment variables: https://docs.netlify.com/build/configure-builds/environment-variables/
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- React `lazy`: https://react.dev/reference/react/lazy
- React `Suspense`: https://react.dev/reference/react/Suspense
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

Key points applied from those sources:

- Netlify Functions are versioned and deployed with the site, can be TypeScript, and are the correct production boundary for this app's current Netlify deployment model.
- Netlify explicitly warns not to commit sensitive environment values and recommends serverless functions for sensitive runtime values that must not be exposed to browser code.
- Supabase service keys bypass Row Level Security and must never be exposed to browsers or customers; RLS policy performance must be considered on row-scanning queries.
- React supports route/component code splitting with top-level `lazy` declarations and `Suspense` fallbacks.
- OWASP logging guidance says access tokens, session identifiers, database connection strings, keys, passwords, sensitive personal data, and source code should not be logged directly.

## Complete Program Assessment

The program is not in a broken state: the frontend and backend build locally, and the deployed Netlify/Supabase production path was smoke-tested in prior deployment work. However, the repository still contains several architectural eras at once:

- A Netlify Functions API that is the apparent production backend.
- A legacy Express backend under `src/backend`.
- An AI service under `src/ai`.
- Frontend code that mixes legacy token handling, hosted Supabase auth, and public/protected route assumptions.
- A large amount of historical documentation and generated state.

The main risk is not one isolated syntax error. The main risk is boundary drift: some routes assume Netlify/Supabase auth, some legacy backend routes are public, tests still mock the old auth path, and tracked local deployment/certificate files make it harder to reason about what is production configuration versus historical/local configuration.

## Verification Performed

| Check | Result | Notes |
| --- | --- | --- |
| `npm run build` in `src/frontend` | Passed | Vite emitted CSS ordering warnings and large chunk warnings. |
| `npm run build` in `src/backend` | Passed | TypeScript backend build completed. |
| `npm test -- --run` in `src/frontend` | Failed | 105 tests passed, 4 AuthContext tests failed. |
| `npm audit --json` in `src/frontend` | Failed | 6 vulnerabilities: 1 low, 5 moderate. |
| `npm audit --json` at repo root | Failed | 14 moderate vulnerabilities. |
| `git status --short --untracked-files=all` | Clean | No local code/doc drift at review time before this report was added. |

## Findings

### P1 - Auth token is appended to an SSE URL

Evidence:

- `src/frontend/src/services/langgraphService.ts:234` reads `auth_token` from localStorage.
- `src/frontend/src/services/langgraphService.ts:237` appends that token to the query string because `EventSource` cannot set custom headers.
- `netlify/functions/api.ts:301` accepts a query-string `token` and turns it into a bearer header.

Impact:

Bearer tokens in URLs can leak through browser history, server logs, observability tools, referrers, screenshots, and support traces. This conflicts with OWASP logging guidance that access tokens should not be recorded directly.

Recommended fix:

Replace query-token streaming with one of these patterns:

1. Use a short-lived, single-use stream ticket minted by an authenticated POST request, stored server-side, then consumed by the SSE endpoint.
2. Replace `EventSource` with `fetch` plus `ReadableStream` so the standard `Authorization` header can be used.
3. Use secure, HTTP-only cookie auth for this specific streaming path if the rest of the auth model can support it.

### P1 - Legacy backend exposes operational and AI routes if deployed

Evidence:

- `src/backend/src/routes/health.ts:369` exposes `POST /db/:action`; the `disconnect` branch closes the Sequelize connection at `src/backend/src/routes/health.ts:374`.
- `src/backend/src/routes/health.ts:432` exposes diagnostics with platform/runtime details.
- `src/backend/src/routes/documentation.ts:286` exposes AI crawl; `src/backend/src/routes/documentation.ts:292` to `src/backend/src/routes/documentation.ts:294` expose crawl job control; `src/backend/src/routes/documentation.ts:318` exposes delete even though the Swagger block says authentication is required.
- `src/backend/src/routes/scripts.ts:497`, `src/backend/src/routes/scripts.ts:523`, `src/backend/src/routes/scripts.ts:901`, `src/backend/src/routes/scripts.ts:1310`, `src/backend/src/routes/scripts.ts:1353`, and `src/backend/src/routes/scripts.ts:1397` expose script analysis/export/generation/question/explanation routes without consistent authentication.

Impact:

If the legacy Express backend is deployed or reachable, unauthenticated callers can trigger expensive AI work, view or export analysis, crawl URLs, delete documentation, inspect diagnostics, or disrupt database connectivity.

Recommended fix:

Make a production-boundary decision first. If Netlify Functions are the only production API, mark the Express backend as local/dev-only and block deployment. If the Express backend remains deployable, apply authentication and authorization middleware to all mutating, diagnostic, data export, and AI-cost routes.

### P1 - Private certificate material is tracked

Evidence:

`git ls-files` shows these files are tracked:

- `.netlify/netlify.toml`
- `certs/backend.crt`
- `certs/backend.key`
- `certs/ca.crt`
- `certs/ca.key`
- `certs/frontend.crt`
- `certs/frontend.key`

Impact:

Tracked private keys should be considered compromised unless proven to be throwaway local development fixtures. `.netlify/netlify.toml` is also local deployment state and has already been observed as a file that can be rewritten by deploy tooling.

Recommended fix:

Confirm whether these certs are local-only development fixtures. If they have ever protected anything real, rotate them. Move preserved historical files to an archive path if desired, add generated/local state to `.gitignore`, and remove tracked private key material from future commits after replacement fixtures or setup instructions exist.

### P2 - Frontend auth tests are exercising the wrong auth boundary

Evidence:

- `src/frontend/src/contexts/__tests__/AuthContext.test.tsx:7` to `src/frontend/src/contexts/__tests__/AuthContext.test.tsx:23` mocks axios only.
- `src/frontend/src/contexts/AuthContext.tsx:365` to `src/frontend/src/contexts/AuthContext.tsx:377` uses the Supabase auth client for password sign-in when hosted auth is configured.
- The failed tests attempted DNS lookup for `stub.supabase.co`.

Impact:

The test suite fails because the tests still assume legacy axios auth behavior. This blocks reliable regression testing and hides whether hosted Supabase auth behaves correctly.

Recommended fix:

Mock the local Supabase client module and test hosted-auth behavior explicitly. Keep separate tests for any intentional legacy API auth path, but do not let unit tests reach the network.

### P2 - Dependency audit has unresolved advisories

Evidence:

Frontend audit:

- `@vitejs/plugin-legacy` through `vite`.
- `vite` advisories including development server/path traversal and esbuild.
- `esbuild <=0.24.2`.
- `react-syntax-highlighter` through `refractor` and `prismjs`.

Root audit:

- `netlify-cli`, `@netlify/functions`, `@fastify/static`, `uuid`, and `sequelize` chains.

Impact:

Most findings are moderate and many require major version movement. The app should not blindly auto-force all upgrades, but the current dependency surface is stale enough that this should be handled deliberately.

Recommended fix:

Create a controlled dependency-upgrade branch. Upgrade Vite/plugin-legacy/syntax highlighting and Netlify CLI/functions first, then run build, unit tests, Playwright smoke, and Netlify deploy preview. Treat `sequelize` separately because the current production path should be Netlify Functions plus hosted Supabase/Postgres, not necessarily legacy Sequelize.

### P2 - Frontend build produces CSS ordering and large chunk warnings

Evidence:

- `src/frontend/src/index.css:1` to `src/frontend/src/index.css:6` places `@tailwind` directives before `@import` statements, causing Vite CSS warnings.
- The production build produced chunks including:
  - `editor-*.js`: about 2,305 KB minified.
  - `vendor-highlight-languages-*.js`: about 838 KB minified.
  - `vendor-refractor-*.js`: about 611 KB minified.

Impact:

The CSS order warning is deterministic and should be fixed. The chunk sizes create slow initial or route-level loads, especially around Monaco and syntax highlighting.

Recommended fix:

Move CSS imports before Tailwind directives or import token/motion CSS from the app entry in a valid order. Split Monaco/editor, syntax highlighter languages, and heavy charting into route-level lazy chunks with React `lazy` and `Suspense`, declared at module top level.

### P2 - API client disables TypeScript and logs upload internals

Evidence:

- `src/frontend/src/services/api.ts:1` to `src/frontend/src/services/api.ts:2` disables TypeScript checks.
- `src/frontend/src/services/api.ts:161` to `src/frontend/src/services/api.ts:205` logs upload configuration and server response data.

Impact:

The API client is a central boundary, so `@ts-nocheck` hides exactly the class of request/response drift this app needs to catch. Upload debug logs can expose endpoint behavior, error payloads, and potentially user data.

Recommended fix:

Type the axios wrapper and upload helper incrementally. Remove unconditional upload logs or guard them behind a development-only logger that redacts payloads and response data.

### P2 - Public frontend routes conflict with authenticated API behavior

Evidence:

- `src/frontend/src/App.tsx:128` exposes `/chat` publicly.
- `src/frontend/src/App.tsx:130` exposes `/ai/assistant` publicly.
- `netlify/functions/api.ts:1409` requires auth for `/chat`; `netlify/functions/api.ts:1429` requires auth for `/chat/stream`.

Impact:

Users can open public AI pages that are backed by authenticated API calls. This is a product and UX inconsistency and can look like a broken app instead of an intentional permission boundary.

Recommended fix:

Either put those routes behind `ProtectedRoute`, or make the page explicitly handle unauthenticated state by sending users through login before any AI interaction.

### P3 - HTML sanitization convention is duplicated

Evidence:

- `src/frontend/src/components/SafeHtml.tsx:7` says to always use `SafeHtml` instead of direct `dangerouslySetInnerHTML`.
- `src/frontend/src/components/Agentic/MessageList.tsx:67` to `src/frontend/src/components/Agentic/MessageList.tsx:72` manually sanitizes markdown.
- `src/frontend/src/components/Agentic/MessageList.tsx:100` to `src/frontend/src/components/Agentic/MessageList.tsx:102` uses `dangerouslySetInnerHTML` directly.

Impact:

The current direct usage is sanitized, so this is not an immediate XSS proof. The issue is consistency: duplicated sanitizer configuration tends to drift.

Recommended fix:

Route markdown HTML rendering through `SafeHtml` or a single markdown-rendering wrapper that owns marked plus DOMPurify configuration.

### P3 - Frontend dependencies contain server-side and duplicate packages

Evidence:

- `src/frontend/package.json:20` includes `cors`.
- `src/frontend/package.json:24` includes `express`.
- `src/frontend/package.json:30` includes `monaco-editor-webpack-plugin` even though the app uses Vite.
- `src/frontend/package.json:15` includes `@tanstack/react-query` while `src/frontend/package.json:37` still includes legacy `react-query`.

Impact:

This increases install time, bundle/audit surface, and ambiguity about which framework patterns are current.

Recommended fix:

Remove server-only packages from the frontend package when confirmed unused. Finish the React Query v5 migration and remove `react-query` v3. Remove webpack-specific Monaco tooling if Vite no longer uses it.

### P3 - Historical docs and generated state need ownership rules

Evidence:

The `docs/` directory contains many dated review, fix, deployment, and test reports. This is useful history, but current entry points are hard to distinguish from archived reports.

Impact:

New reviews become harder to act on because old reports compete with current truth. This has already led to repeated requests to clean up old Markdown files without deleting them.

Recommended fix:

Keep current reports linked from `docs/index.md`. Move superseded reports to an archive folder rather than deleting them, preserving history while making current status easier to find.

## Remediation Plan

### Phase 1 - Establish production boundary

Goal:

Make it unambiguous that production is Netlify Functions plus hosted Supabase/Postgres, unless the legacy backend is intentionally deployed.

Steps:

1. Document production components in one current architecture file.
2. Decide whether `src/backend` is dev-only, archived, or still deployable.
3. If dev-only, make deploy tooling and docs reflect that.
4. If deployable, add auth middleware to every expensive, mutating, diagnostic, export, and data-access route.

Verification:

- Netlify deploy still serves frontend and functions.
- Legacy backend cannot be accidentally deployed as an unauthenticated production API.

### Phase 2 - Remove token leakage paths

Goal:

No bearer token should be placed in a URL or logged.

Steps:

1. Replace SSE query-token auth with a short-lived stream ticket, cookie auth, or fetch streaming with `Authorization`.
2. Remove `requireUserWithQueryToken` after callers are migrated.
3. Redact or remove upload debug logs.
4. Add regression tests that fail if `auth_token` is appended to URLs.

Verification:

- Stream analysis still works for authenticated users.
- Network traces show no bearer token in request URLs.
- Unit tests cover the streaming auth path.

### Phase 3 - Repair the hosted Supabase auth test harness

Goal:

Unit tests should test hosted auth deterministically without external network calls.

Steps:

1. Mock the project Supabase client wrapper in `AuthContext` tests.
2. Add explicit cases for success, rejected credentials, pending approval, logout, and token restoration.
3. Keep legacy axios auth tests only if that path remains supported.

Verification:

- `npm test -- --run` in `src/frontend` passes without DNS or internet access.

### Phase 4 - Dependency and package cleanup

Goal:

Reduce known advisories and remove stale frontend dependencies without uncontrolled rewrites.

Steps:

1. Upgrade Vite, `@vitejs/plugin-legacy`, `react-syntax-highlighter`, and transitive highlight packages in a focused branch.
2. Upgrade `@netlify/functions` and `netlify-cli` in the root toolchain.
3. Remove unused frontend `express`, `cors`, webpack Monaco tooling, and legacy `react-query` after import checks.
4. Reassess `sequelize` and `uuid` after production boundary is settled.

Verification:

- Frontend build passes.
- Backend build passes if backend remains active.
- `npm audit` output is reduced and any remaining items are documented.

### Phase 5 - Performance work

Goal:

Reduce heavy route cost while preserving the existing UI.

Steps:

1. Fix CSS import order.
2. Lazy-load Monaco/editor routes with top-level `React.lazy`.
3. Lazy-load syntax highlighting by language or by analysis/detail route.
4. Confirm charting libraries are only loaded on analytics routes.
5. Add a repeatable build-size check to the test/performance report.

Verification:

- Build warnings for CSS ordering are gone.
- Large chunks are reduced or isolated to the routes that require them.
- Browser smoke tests verify script analysis/editor pages still render.

### Phase 6 - Supabase/Postgres hardening

Goal:

Hosted database behavior should be explicit, indexed, and protected.

Steps:

1. Inventory tables and policies in `supabase/migrations`.
2. Verify Row Level Security is enabled where direct client access is possible.
3. Confirm service-role usage stays server-side only.
4. Add indexes that support common RLS predicates and application filters.
5. Keep the Netlify function pool small unless production traffic proves it needs adjustment.

Verification:

- Supabase advisory output is reviewed.
- Key user-owned queries have indexes and policy tests.
- No service key is exposed to browser bundles.

### Phase 7 - Documentation and archive cleanup

Goal:

Make current status easy to find without deleting history.

Steps:

1. Create or use a dated archive folder for superseded Markdown reports.
2. Keep this review, the latest test results, AI criteria, and deployment status linked from `docs/index.md`.
3. Move old reports into the archive only after confirming which are superseded.

Verification:

- `docs/index.md` points to the active report set.
- Archived files remain available and are not deleted.

## Suggested Execution Order

1. Fix the auth test harness first, because it restores feedback for later changes.
2. Remove token-in-URL streaming auth, because it is the highest production-path security issue.
3. Decide and enforce the legacy backend boundary.
4. Clean tracked certificate/local deployment state and rotate anything real.
5. Fix CSS order and heavy chunk loading.
6. Run controlled dependency upgrades.
7. Archive old Markdown reports and update the docs index.

## Questions Before Code Changes

1. Is `src/backend` still deployed anywhere, or is Netlify Functions the only production backend?
2. Are the tracked files under `certs/` only disposable local development certificates, or have they ever been used for a real environment?
3. Should `/chat` and `/ai/assistant` be public landing/demo pages, or should all AI features require login?

