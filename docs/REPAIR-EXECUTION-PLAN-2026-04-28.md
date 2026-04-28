# Repair Execution Plan - 2026-04-28

## Purpose

This plan covers every issue listed in `docs/CODEBASE-REVIEW-2026-04-28.md`. It is written before executing the remaining repairs so each fix can be evaluated against the whole project, not just the local symptom.

The target architecture remains:

- Frontend hosted on Netlify.
- API hosted through Netlify Functions.
- Database hosted online in Supabase/Postgres.
- No local database as the intended production path.
- Legacy Express backend either secured for accidental exposure or clearly marked as non-production.

## Current Research Applied

- Netlify environment variables and Secrets Controller:
  - https://docs.netlify.com/build/environment-variables/overview
  - https://docs.netlify.com/environment-variables/secrets-controller/
- Supabase Row Level Security and service role behavior:
  - https://supabase.com/docs/guides/database/postgres/row-level-security
  - https://supabase.com/docs/guides/api/securing-your-api
- React code splitting:
  - https://react.dev/reference/react/lazy
  - https://react.dev/reference/react/Suspense
- OWASP logging guidance:
  - https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

## Whole-Project Repair Strategy

The best repair method is to avoid broad rewrites and instead align each subsystem with one production boundary:

1. Netlify Functions are the production API surface.
2. Supabase/Postgres is the hosted database.
3. The legacy backend must not expose unauthenticated operational or AI-cost routes if it is ever run.
4. Frontend tests must mock hosted Supabase auth rather than old axios-only auth.
5. Performance work should reduce expensive chunks without changing the UI model.
6. Documentation cleanup must archive historical files, not delete them.

This means some fixes should be direct code changes, while credential/certificate rotation remains a documented operator action because code cannot rotate real external secrets safely.

## Issue-by-Issue Plan

### Issue 1 - Bearer token in stream URL

Status:

- Already repaired in the previous pass.

Fix:

- Replace `EventSource` with `fetch` streaming so the bearer token is sent in the `Authorization` header.
- Remove Netlify query-token support.

Whole-project fit:

- Keeps the existing Netlify Function route and hosted auth model.
- Avoids introducing new token-ticket storage tables.

Validation:

- Search for removed query-token code.
- Frontend build.
- Frontend tests.

### Issue 2 - Legacy backend exposes operational and AI routes if deployed

Status:

- DB control route was already protected with admin auth in the previous pass.
- Remaining legacy diagnostics, documentation AI crawl/delete, and script AI/export routes still need protection.

Fix:

- Add `authenticateJWT` and `requireAdmin` to diagnostic/operational routes.
- Add `authenticateJWT` to legacy AI-cost routes.
- Add `authenticateJWT` to documentation delete and crawler job routes. Use `requireAdmin` for bulk import/crawl if the current frontend does not require public write access.

Whole-project fit:

- Does not remove the legacy backend.
- Makes accidental exposure safer while preserving local development behavior through existing auth middleware.

Validation:

- Backend TypeScript build.
- Route grep confirms sensitive legacy routes include auth middleware.

### Issue 3 - Private certificate material and Netlify local state are tracked

Status:

- Not repaired yet.

Fix:

- Preserve files by moving currently tracked development certs and `.netlify/netlify.toml` into a dated archive folder.
- Add ignore rules for local cert/key material and `.netlify/`.
- Add a short README describing how to generate local-only certs if needed.

Whole-project fit:

- Respects the instruction not to delete files.
- Reduces chance of active local secrets being used as normal project inputs.
- Real credential rotation cannot be completed in code; the final notes must call out rotation if any archived key was ever used outside local development.

Validation:

- `git status` shows files moved, not deleted without replacement.
- `git ls-files` no longer lists active `certs/*.key` paths after the move is staged in a future commit.

### Issue 4 - Frontend auth tests exercise the wrong auth boundary

Status:

- Already repaired in the previous pass.

Fix:

- Mock the project Supabase service in `AuthContext` tests.
- Keep axios mocked only for the `/auth/me` profile lookup.

Whole-project fit:

- Matches hosted Supabase auth as the desired path.

Validation:

- Focused AuthContext test.
- Full frontend test suite.

### Issue 5 - Dependency audit advisories

Status:

- Not repaired yet.

Fix:

- Remove stale/unused frontend dependencies first.
- Upgrade `vite`, `@vitejs/plugin-legacy`, and syntax-highlighting packages in the frontend.
- Upgrade root Netlify tooling packages.
- Re-run audits after package changes.
- Treat legacy `sequelize` separately: if production is Netlify/Supabase, keep it only for legacy backend compatibility until that backend is formally archived.

Whole-project fit:

- Reduces advisory surface without forcing a risky legacy-backend rewrite.
- Dependency upgrades are validated by builds/tests rather than `npm audit fix --force`.

Validation:

- `npm audit --json` at root and frontend.
- Frontend build/tests.
- Backend build.

### Issue 6 - CSS ordering and large chunks

Status:

- CSS import order was already repaired in the previous pass.
- A malformed CSS comment in `tokens.css` was repaired after valid import ordering exposed it.
- Large chunks still need performance work.

Fix:

- Keep valid CSS import order.
- Lazy-load heavy page components from `App.tsx` where possible.
- Confirm editor and syntax-highlighting code only loads on routes that need it.

Whole-project fit:

- Uses React's official lazy/Suspense model without changing app navigation.
- Avoids changing UI behavior or redesigning pages.

Validation:

- Frontend build.
- Compare build chunk output.
- Full frontend tests.

### Issue 7 - API client disables TypeScript and logs upload internals

Status:

- Not repaired yet.

Fix:

- Remove `@ts-nocheck` from the API client if TypeScript errors can be resolved locally.
- If a full removal is too large, narrow the types around upload config and response handling first.
- Remove unconditional upload debug logs; keep only development-gated, redacted logs if needed.

Whole-project fit:

- Improves the central API boundary without changing backend contracts.
- Aligns with OWASP guidance to avoid logging sensitive payloads and tokens.

Validation:

- Frontend build.
- Full frontend tests.
- Search for `[UPLOAD DEBUG]`.

### Issue 8 - Public frontend AI routes conflict with authenticated APIs

Status:

- Not repaired yet.

Fix:

- Wrap `/chat` and `/ai/assistant` in `ProtectedRoute`.

Whole-project fit:

- Matches the current Netlify API behavior, which already requires auth for chat endpoints.
- Avoids building separate anonymous demo behavior.

Validation:

- Frontend tests/build.
- Route inspection confirms AI pages are protected.

### Issue 9 - HTML sanitization convention is duplicated

Status:

- Not repaired yet.

Fix:

- Replace direct `dangerouslySetInnerHTML` usage in the agent message list with the existing `SafeHtml` component.
- Keep markdown parsing local unless a broader markdown wrapper already exists.

Whole-project fit:

- Uses the project's existing security component instead of adding another abstraction.

Validation:

- Frontend build/tests.
- Search confirms no duplicate direct usage remains in that component.

### Issue 10 - Frontend dependencies contain server-side and duplicate packages

Status:

- Not repaired yet.

Fix:

- Check imports for `express`, `cors`, `monaco-editor-webpack-plugin`, and `react-query`.
- Remove them from `src/frontend/package.json` if unused.
- Run install/update to refresh the frontend lockfile.

Whole-project fit:

- Reduces bundle/audit/install surface without changing app code if imports are absent.

Validation:

- Import grep.
- Frontend install/build/tests.

### Issue 11 - Historical docs and generated state need ownership rules

Status:

- Not repaired yet.

Fix:

- Create a dated docs archive folder.
- Move superseded review/fix/test Markdown reports into the archive without deleting them.
- Keep current active docs in place:
  - `docs/CODEBASE-REVIEW-2026-04-28.md`
  - `docs/REPAIR-EXECUTION-PLAN-2026-04-28.md`
  - latest AI criteria/test/deployment reports.
- Update `docs/index.md` with active report links.

Whole-project fit:

- Preserves history while making current status findable.

Validation:

- Files are moved, not deleted.
- `docs/index.md` links current reports.

### Issue 12 - Supabase/Postgres hardening

Status:

- Not repaired yet.

Fix:

- Inspect migrations for RLS enablement and common owner/filter columns.
- Add a non-destructive migration for missing RLS indexes and policy support indexes where clear from the schema.
- Do not run destructive database changes locally.

Whole-project fit:

- Supports hosted Supabase as production database.
- Avoids local DB assumptions.

Validation:

- Migration SQL review.
- Search confirms service role keys are server-side only.
- Build/tests unaffected.

## Final Execution Order

1. Secure remaining legacy backend routes.
2. Protect public AI frontend routes.
3. Unify HTML sanitization.
4. Remove API client debug logs and restore TypeScript checking as far as practical.
5. Clean stale frontend dependencies and run controlled package updates.
6. Reduce heavy frontend chunks with route-level lazy loading.
7. Archive active private cert/local Netlify state while preserving files.
8. Add Supabase/Postgres hardening migration if schema inspection supports it.
9. Archive superseded Markdown docs and update `docs/index.md`.
10. Run full validation: frontend tests, frontend build, backend build, audits, and route/security greps.

## Plan Review

This plan is project-aligned because it does not try to collapse the entire repository into one new architecture in a single pass. It preserves the working Netlify/Supabase production path, hardens legacy surfaces that still exist in the repo, and improves tests and performance around the app as it is currently built.

The only item that cannot be fully completed by code alone is real credential rotation for any tracked certificate material that was ever used outside local development. The codebase can move and ignore those files going forward, but external rotation remains an operator action.

