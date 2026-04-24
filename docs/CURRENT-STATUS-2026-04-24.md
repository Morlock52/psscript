# Current Project Status - 2026-04-24

This is the current status snapshot for the active PSScript worktree. Older dated reports and duplicate ` (1).md` files are historical unless linked from `docs/index.md` or the root `README.md`.

## Runtime Status

| Area | Current State |
| --- | --- |
| Local frontend | Running and tested at `http://127.0.0.1:3191` for the auth-enabled Browser Use pass. The main Docker/local app shell remains documented around `3090`. |
| Backend API | Local API health passed through the app origin. Documentation API routes now work after adding the missing `documentation` table. |
| Database | PostgreSQL schema includes `documentation` plus scripts, analysis, chat history, embeddings, users, categories, tags, execution logs, and AI metrics. |
| AI chat | Browser Use focused retest submitted a `Get-Date` prompt and confirmed an assistant response. |
| Voice | Voice Copilot dock opens with Dictate/Speak controls. Microphone permission and dictation were not accepted during automated QA because they require explicit confirmation. |
| Hosted path | Netlify + Supabase is the target hosted architecture: Vite SPA, Netlify Functions for same-origin `/api/*`, Supabase Auth/Postgres, and hosted static-analysis-only execution behavior. |
| UI | Current UI baseline is the muted dark PSScript shell with branded logo/mark, muted chat controls, muted Voice Copilot, and muted navbar/account treatments. |

## Latest QA Evidence

Primary artifact: [`../BROWSER_USE_QA.md`](../BROWSER_USE_QA.md)

Browser Use RUN2 on 2026-04-24 passed:

- health and auth/session rendering
- dashboard/global shell
- navbar and sidebar controls
- analytics
- scripts list, upload, detail, and analysis routes
- AI chat send/response
- chat controls and muted UI
- Voice Copilot dock
- agent pages
- documentation explorer, crawl, and data pages
- UI components
- settings pages
- 404 handling
- current console health

Skipped by safety rule:

- destructive Clear/Delete/Reset actions
- save-settings mutations
- password/session mutations
- maintenance mutations
- browser notification permission
- microphone permission

## Concrete Fixes From This QA Cycle

- Added `src/db/migrations/20260424_create_documentation_table.sql`.
- Updated `src/db/schema.sql` so fresh local databases include the `documentation` table.
- Applied the migration to the running local Docker Postgres instance.
- Muted bright global/chat/voice/navbar color treatments in the frontend.
- Recorded Browser Use and Computer Use validation in `BROWSER_USE_QA.md`.

## Known Caveats

- A prior full frontend build attempt was blocked by a local `@swc/core` native binding load failure in `node_modules`. TypeScript `--noEmit` passed after the muted UI changes, and Browser Use validated the running app. Reinstalling frontend dependencies should be the first step if this build issue appears again.
- Hosted Netlify previews require Supabase env vars before real hosted auth and auth-gated AI flows can be tested end-to-end.
- Hosted production intentionally does not execute arbitrary PowerShell. It should support upload, catalog, search, AI/static analysis, recommendations, chat, voice, documentation, analytics, and exports.

## Authoritative Docs

- [`../README.md`](../README.md) - product overview and quick start
- [`index.md`](./index.md) - documentation hub
- [`NETLIFY-SUPABASE-DEPLOYMENT.md`](./NETLIFY-SUPABASE-DEPLOYMENT.md) - hosted deployment path
- [`UPDATES.md`](./UPDATES.md) - chronological engineering updates
- [`../BROWSER_USE_QA.md`](../BROWSER_USE_QA.md) - latest browser QA matrix and results
