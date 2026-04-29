# Current Project Status - refreshed April 29, 2026

This file keeps the historical filename because active docs already link to it. The contents now describe the current production state.

## Runtime Status

| Area | Current state |
| --- | --- |
| Production app | `https://pstest.morloksmaze.com` on Netlify |
| Production API | Same-origin Netlify Functions under `/api/*` |
| Database | Hosted Supabase Postgres with Auth, RLS, and `pgvector` |
| Local database | Not part of the active path. Local development must point `DATABASE_URL` at hosted Supabase or a Supabase-compatible hosted Postgres instance. |
| Auth | Supabase Auth plus `app_profiles.is_enabled`; new users remain disabled until an admin enables them |
| Scripts | Upload, catalog, analysis, delete, bulk delete, versioning, and PDF analysis export are active |
| Script editor | Edit pages load real hosted scripts, save title/description/content, and export the current buffer as `.ps1` for VS Code |
| Analysis runtime notes | Analysis pages show PowerShell version guidance and detected modules/assemblies even when full AI scoring has not been generated |
| Agentic routes | `/agentic`, `/agentic-ai`, and `/ai/agentic` route to `/ai/assistant` instead of 404ing |
| Data maintenance | Admin-only Settings -> Data Maintenance uses hosted `/api/admin/db/*` routes and Supabase-backed backup records |
| Mobile UI | Topbar, drawer navigation, dashboard cards, scripts, and settings pages are responsive at phone widths |

## Latest Verification

| Check | Result |
| --- | --- |
| Edit/runtime focused tests | 31 tests passed |
| Frontend unit tests | Previous full suite: 16 files, 109 tests passed |
| Frontend production build | Passed |
| Netlify deploy | Live at `https://pstest.morloksmaze.com`; latest deploy `69f209d8b588750a558017be` |
| Lighthouse after redeploy | Performance 37, Accessibility 100, Best Practices 100, SEO 81, PWA 30 |
| Screenshot refresh | `docs/screenshots/current-2026-04-29/` plus README feature captures updated |

## Current Production Contract

- Netlify serves the Vite SPA and routes unknown client paths back to the app shell.
- Netlify Functions own same-origin API behavior.
- Supabase owns hosted Auth and Postgres persistence.
- RLS remains the database safety layer; API auth remains the first gate.
- Analysis exports download as PDF, not JSON.
- Script edit export downloads a `.ps1` file for local VS Code review.
- Runtime requirements are visible before full analysis is available; full scoring still requires running analysis.
- Destructive database maintenance stays admin-only and should only be run with an explicit backup/restore plan.

## Known Caveats

- Lighthouse performance remains low on the latest production run and should be addressed with bundle, image, and render-path profiling.
- Local Express and FastAPI services still exist for development-only workflows, but production documentation should treat Netlify Functions and hosted Supabase as authoritative.
- Archived reports under `docs/archive/` and `archive/` are preserved for history and are not the active runbook.

## Authoritative Docs

- [`../README.md`](../README.md)
- [`index.md`](./index.md)
- [`GETTING-STARTED.md`](./GETTING-STARTED.md)
- [`NETLIFY-SUPABASE-DEPLOYMENT.md`](./NETLIFY-SUPABASE-DEPLOYMENT.md)
- [`DATA-MAINTENANCE.md`](./DATA-MAINTENANCE.md)
- [`PROJECT-TEST-RESULTS-2026-04-28.md`](./PROJECT-TEST-RESULTS-2026-04-28.md)
