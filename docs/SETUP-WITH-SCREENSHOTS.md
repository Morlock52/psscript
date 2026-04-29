# Setup Guide With Screenshots

Last updated: April 29, 2026.

This guide describes the current PSScript setup: Netlify for the app/API edge and hosted Supabase for all production database state.

![Dashboard screenshot](./screenshots/current-2026-04-28/dashboard-desktop.png)

## Current Architecture

| Layer | Current role | Production |
| --- | --- | --- |
| Frontend | React/Vite UI, OAuth callback, responsive shell | Netlify static site |
| API | same-origin app API | Netlify Functions under `/api/*` |
| Database | Auth, profiles, scripts, analyses, vectors, backups | hosted Supabase Postgres |
| AI | chat, script analysis, embeddings, voice | Netlify Functions calling configured providers |
| Local services | developer-only iteration | optional, not production |

There is no active local database path. Use a hosted Supabase `DATABASE_URL`.

## 1. Production URL

- App: `https://pstest.morloksmaze.com`
- Health: `https://pstest.morloksmaze.com/api/health`
- Auth callback: `https://pstest.morloksmaze.com/auth/callback`

## 2. Supabase

Apply migrations in filename order from `supabase/migrations/`.

Required Supabase capabilities:

- Auth
- Postgres
- Row Level Security
- `pgvector`

Recommended checks:

```sql
select extname from pg_extension where extname = 'vector';
select table_name from information_schema.tables where table_schema = 'public';
```

## 3. Google OAuth

1. In Google Cloud, create an OAuth web client.
2. Add the Supabase Auth callback as the Google authorized redirect URI:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. In Supabase Auth, enable Google.
4. In Supabase redirect URLs, include:
   - `https://pstest.morloksmaze.com/auth/callback`
5. Confirm the app calls Supabase with the app callback as `redirectTo`.

![Production login screenshot](./screenshots/current-2026-04-28/login-production.png)

## 4. Approval Gate

- Users sign in through Supabase Auth.
- `/api/auth/me` maps the Auth identity to `app_profiles`.
- New users default to disabled.
- Admins enable users from Settings -> User Management.
- Disabled users remain on pending approval and receive `403 account_pending_approval` from protected APIs.
- RLS policies continue to protect direct table access.

## 5. Netlify Environment

Set these in Netlify:

```text
DATABASE_URL=postgresql://...supabase pooler URL...
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=...
DEFAULT_ADMIN_BOOTSTRAP_TOKEN=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
OPENAI_ANALYSIS_MODEL=gpt-5.4-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_HOSTED_STATIC_ANALYSIS_ONLY=true
```

Server-only secrets must not be prefixed with `VITE_`.

## 6. Local UI Setup

Use local UI mode for layout work and screenshot capture. This mode uses mock data and avoids mutating hosted Supabase.

```bash
cd src/frontend
VITE_DISABLE_AUTH=true VITE_USE_MOCKS=true npm run dev -- --host 127.0.0.1 --port 5173
```

Use hosted-auth local mode only when you need to test Supabase login:

```bash
cd src/frontend
VITE_DISABLE_AUTH=false \
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_ANON_KEY=... \
npm run dev -- --host 127.0.0.1 --port 5173
```

## 7. Main Screens

| Screen | Screenshot |
| --- | --- |
| Dashboard desktop | `docs/screenshots/current-2026-04-28/dashboard-desktop.png` |
| Dashboard mobile | `docs/screenshots/current-2026-04-28/dashboard-mobile.png` |
| Mobile navigation | `docs/screenshots/current-2026-04-28/mobile-navigation.png` |
| Scripts desktop | `docs/screenshots/current-2026-04-28/scripts-desktop.png` |
| Upload desktop | `docs/screenshots/current-2026-04-28/upload-desktop.png` |
| Agentic assistant alias | `docs/screenshots/current-2026-04-28/agentic-ai-desktop.png` |
| Data maintenance | `docs/screenshots/current-2026-04-28/settings-data-desktop.png` |
| Script editor and VS Code export | `docs/screenshots/current-2026-04-29/script-edit-vscode.png` |
| Runtime requirements | `docs/screenshots/current-2026-04-29/analysis-runtime-requirements.png` |
| Appearance settings | `docs/screenshots/current-2026-04-29/settings-appearance.png` |

![Mobile dashboard](./screenshots/current-2026-04-28/dashboard-mobile.png)

![Mobile navigation](./screenshots/current-2026-04-28/mobile-navigation.png)

## 8. Script Workflows

![Scripts screenshot](./screenshots/current-2026-04-28/scripts-desktop.png)

Current behavior:

- upload and list scripts
- edit hosted title, description, and script content
- export the current edit buffer as a `.ps1` file for VS Code
- analyze scripts with the criteria payload
- view runtime requirements for PowerShell version, modules, and assemblies before production execution
- search by text and embeddings
- delete single scripts
- bulk delete selected scripts
- export analysis as PDF from `/api/scripts/:id/export-analysis`

The export route should download a PDF. It should not return a JSON file as the user-facing report.

![Script editor with VS Code export](./screenshots/current-2026-04-29/script-edit-vscode.png)

![Runtime requirements](./screenshots/current-2026-04-29/analysis-runtime-requirements.png)

## 8a. Appearance Settings

![Appearance settings](./screenshots/current-2026-04-29/settings-appearance.png)

Settings -> Appearance owns the current user-facing display controls:

- light and dark mode selection
- muted operator accent color
- font-size slider
- reduce motion and high-contrast accessibility toggles

## 9. Data Maintenance

![Data maintenance screenshot](./screenshots/current-2026-04-28/settings-data-desktop.png)

Settings -> Data Maintenance uses hosted admin routes:

- `GET /api/admin/db/backups`
- `POST /api/admin/db/backup`
- `POST /api/admin/db/restore`
- `POST /api/admin/db/clear-test-data`

Run backup before destructive operations. Do not run restore or clear-test-data on production as a casual smoke test.

## 10. Agentic Route Behavior

![Agentic assistant screenshot](./screenshots/current-2026-04-28/agentic-ai-desktop.png)

The current deploy keeps old agentic URLs alive:

- `/agentic`
- `/agentic-ai`
- `/ai/agentic`

Each route lands on the assistant experience instead of returning 404.

## 11. Validation

```bash
cd src/frontend
npm test -- --run --maxWorkers=1
npm run build
```

```bash
npm run build:netlify
curl -fsS https://pstest.morloksmaze.com/api/health
```

Latest documented validation:

- 31 focused shell/token tests passed after the edit/runtime update.
- 109 frontend tests passed.
- frontend build passed.
- Netlify production deploy succeeded.
- production Lighthouse after edit/runtime redeploy: Performance 37, Accessibility 100, Best Practices 100, SEO 81, PWA 30.

## 12. Screenshot Refresh

Current captures are in `docs/screenshots/current-2026-04-28/` and `docs/screenshots/current-2026-04-29/`. README frames are regenerated with:

```bash
npm run screenshots:readme
```

## References Reviewed April 28-29, 2026

- Netlify Functions: https://docs.netlify.com/build/functions/overview/
- Netlify redirects: https://docs.netlify.com/routing/redirects/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Diataxis documentation framework: https://diataxis.fr/
- Google image documentation guidance: https://developers.google.com/style/images
