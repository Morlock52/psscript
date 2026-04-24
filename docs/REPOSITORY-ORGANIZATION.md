# Repository Organization

This repository contains the local full-stack PSScript application, hosted Netlify/Supabase deployment work, documentation, and historical recovery artifacts.

## Active Top-Level Areas

| Path | Purpose |
| --- | --- |
| `README.md` | Main product overview, architecture, screenshots, quick start, and validation summary. |
| `BROWSER_USE_QA.md` | Latest Browser Use QA matrix, results, findings, and safety skips. |
| `QA_AI_APP_ISSUES.md` | AI/auth/hosted issue log from the Netlify/Supabase recovery pass. |
| `docs/` | Active documentation, historical reports, screenshots, deployment notes, and support guides. |
| `src/frontend/` | React + TypeScript + Vite application. |
| `src/backend/` | Express + TypeScript backend API. |
| `src/ai/` | Python AI service and LangGraph/analysis code. |
| `src/db/` | PostgreSQL schema, migrations, seeds, and database docs. |
| `netlify/` | Netlify Functions for the hosted same-origin API path. |
| `supabase/` | Supabase hosted schema migrations. |
| `tests/` | Playwright and support test assets. |
| `scripts/` | Operational scripts, screenshot capture, validation helpers, and maintenance tools. |

## Documentation Rules

- Treat `docs/index.md`, `README.md`, `docs/CURRENT-STATUS-2026-04-24.md`, `docs/NETLIFY-SUPABASE-DEPLOYMENT.md`, and `BROWSER_USE_QA.md` as the current source of truth.
- Treat `docs/archive/**` and dated January/March recovery reports as historical evidence unless a current doc links to them for context.
- Treat zero-byte duplicate files named `* (1).md` as workspace artifacts, not active documentation.
- Prefer adding current status to active docs instead of rewriting historical reports.

## Current Deployment Tracks

| Track | Use |
| --- | --- |
| Local Docker/full stack | Best for full backend, database, Redis, AI service, and browser QA. |
| Auth-enabled local frontend on `3191` | Used for Browser Use login/app validation and current QA evidence. |
| Netlify + Supabase hosted path | Target production path for SPA, same-origin functions, Supabase Auth/Postgres, and hosted static analysis. |

## Cleanup Backlog

- Archive or remove zero-byte duplicate `* (1).md` files after explicit approval.
- Fold obsolete January/March reports into a smaller historical archive index.
- Keep one current status file per major recovery cycle instead of many overlapping reports.
