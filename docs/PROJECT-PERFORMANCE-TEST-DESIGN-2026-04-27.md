# PSScript Performance And Test Design

Research baseline: April 27, 2026. Authored from local review on April 28, 2026.

## Goal

Validate that PSScript works as a Netlify-hosted application using Supabase Postgres as the database, with enough smoke, UI, API, database, and stress coverage to expose deployment blockers before refactoring.

## Current Architecture Under Test

- Frontend: Vite React app built from `src/frontend` and published by Netlify from `src/frontend/dist`.
- Hosted API: Netlify Function router at `netlify/functions/api.ts`, mapped by `netlify.toml` from `/api/*` to `/.netlify/functions/api/:splat`.
- Database: Supabase Postgres via `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Local full-stack e2e path: `scripts/playwright-stack.sh` starts frontend on `https://127.0.0.1:3090`, backend on `https://127.0.0.1:4000`, and AI service on `http://127.0.0.1:8000`, while requiring `DATABASE_URL` to point at Supabase or `DB_PROFILE=supabase`.
- Linked Netlify site: `psscript`, project id `a6cb54b5-b3f7-4f01-a756-70b127f07e19`, primary URL `https://pstest.morloksmaze.com`.

## External Guidance Used

- Netlify Functions documentation: use Functions for server-side code without managing servers, keep routing explicit, and validate build output before deploy.
- Netlify environment variable documentation: production secrets should be configured in Netlify, not committed. Source: <https://docs.netlify.com/build/environment-variables/overview/>
- Supabase connection string documentation: use hosted Supabase direct or pooler connection strings for app/server access. Source: <https://supabase.com/docs/reference/postgres/connection-strings>
- OpenAI Responses API usage documentation: track input tokens, output tokens, token details, and total tokens from the response usage object. Source: <https://platform.openai.com/docs/api-reference/responses/retrieve>
- Anthropic Messages API examples: track usage with input token and output token counters. Source: <https://docs.anthropic.com/en/api/messages-examples>
- Supabase RLS documentation: RLS must be enabled and policies must be explicit for exposed tables.
- Supabase database performance guidance: add indexes for foreign keys and common filters; verify RLS and query plans with realistic queries.
- Playwright best practices: use user-visible locators, isolate tests, collect traces/screenshots on failure, and test critical flows across browser projects.
- Lighthouse CI guidance: track performance/accessibility/best-practice budgets from built production assets, not only dev server behavior.

## Success Criteria

- Netlify build completes from the repo root using the configured `netlify.toml`.
- Built frontend calls same-origin `/api` in production unless an explicit environment override is set.
- Netlify API health reports Supabase database connectivity when required env vars are present.
- Playwright smoke tests pass for frontend, backend health, authentication behavior, script management, categories/settings, AI analytics, and route-level UI load.
- UI routes render without blank pages, fatal console errors, or inaccessible primary controls.
- Database stress and maintenance smoke tests complete without destructive behavior outside their intended test path.
- Any failure is captured with command, observed output, likely cause, and proposed fix before refactoring.

## Test Matrix

| Area | Command Or Method | Primary Risk Covered |
| --- | --- | --- |
| Static config review | inspect `netlify.toml`, env names, API URL logic, Supabase migrations | Wrong host path, missing env, local-only assumptions |
| Netlify project/link check | `netlify status` and Netlify project connector | Wrong project or unlinked deployment target |
| Production build | `netlify build` or equivalent direct build | Type errors, Vite build failure, missing publish output |
| Hosted API smoke | `/api/health` on Netlify and local Netlify path | Netlify Function routing, Supabase connectivity |
| Unit tests | frontend Vitest tests | Component/API utility regressions |
| E2E smoke | Playwright `health-checks`, `authentication`, `script-management`, `categories-settings`, `ai-analytics` | Main workflows and UI rendering |
| UI walkthrough | Browser route sweep and screenshots at desktop/mobile sizes | Blank pages, layout overlap, console errors |
| Supabase review | migrations, indexes, RLS policies, health checks | Unsafe policies, missing indexes, query performance |
| Stress smoke | existing maintenance/stress scripts in smoke mode | Data-maintenance and load behavior |
| Performance audit | production build size and Lighthouse-style route checks when browser target is available | Bundle bloat and slow first load |

## Performance Targets

- Build: completes without TypeScript or Vite errors.
- Frontend bundle: no unexplained large chunk warnings beyond intentionally bundled Monaco/highlight assets.
- API health: reachable and returns structured JSON within the test timeout.
- UI smoke: each critical route reaches `domcontentloaded` and visible body content within Playwright timeouts.
- E2E stability: no test should depend on hidden local-only state unless it declares the skip condition.
- Database: queries used by list/search/detail views should have supporting indexes for joins, ownership filters, and pagination.

## Execution Order

1. Review project structure, Netlify link, env contract, Supabase schema, and test harness.
2. Run build and fast unit/static tests.
3. Run API and UI smoke tests against the local stack backed by Supabase.
4. Run targeted stress/performance smoke tests that already exist in the repo.
5. Record observed results in a separate markdown report.
6. Refactor only confirmed problems, with changes scoped to the failing behavior.
7. Re-run the relevant tests and update final results.

## Open Questions To Resolve From Evidence

- Whether the Netlify production environment has all Supabase and AI provider variables set.
- Whether local `.env` points at the same Supabase project as Netlify production.
- Whether the existing backend path on port `4000` is still required, or whether Netlify Functions are now the intended only hosted API.
- Whether stress tests may mutate shared Supabase data; destructive tests should run only if they isolate fixtures or restore state.
