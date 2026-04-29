# Documentation Refresh - April 28, 2026

## Scope

Updated active project documentation and training material to match the current hosted state:

- Netlify production app at `https://pstest.morloksmaze.com`
- Netlify Functions for `/api/*`
- hosted Supabase Auth/Postgres as the database
- admin approval gate
- working agentic route aliases
- analysis PDF export
- script delete and bulk delete behavior
- admin Data Maintenance workflow
- mobile responsive shell

Archive folders were preserved and not rewritten.

## Screenshots Refreshed

New dated screenshots live in `docs/screenshots/current-2026-04-28/`:

- `login-production.png`
- `login-production-mobile.png`
- `dashboard-desktop.png`
- `dashboard-mobile.png`
- `mobile-navigation.png`
- `scripts-desktop.png`
- `scripts-mobile.png`
- `upload-desktop.png`
- `agentic-ai-desktop.png`
- `settings-data-desktop.png`
- `settings-profile-desktop.png`

README frames in `docs/screenshots/readme/` were regenerated with `npm run screenshots:readme`.

## Files Updated

- `README.md`
- `docs/index.md`
- `docs/CURRENT-STATUS-2026-04-24.md`
- `docs/GETTING-STARTED.md`
- `docs/SETUP-WITH-SCREENSHOTS.md`
- `docs/NETLIFY-SUPABASE-DEPLOYMENT.md`
- `docs/DATA-MAINTENANCE.md`
- `docs/SUPPORT.md`
- `docs/AUTHENTICATION-IMPROVEMENTS.md`
- `docs/DATABASE_DOCUMENTATION.md`
- `docs/LOGIN-CREDENTIALS.md`
- `docs/VOICE-TESTS-1-8-LATEST.md`
- `docs/training-suite/README.md`
- `docs/training-suite/TRAINING-GUIDE.md`
- all active training modules and labs under `docs/training-suite/`

## Research References Reviewed

- Netlify Functions: https://docs.netlify.com/build/functions/overview/
- Netlify redirects and rewrites: https://docs.netlify.com/routing/redirects/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

## Validation

- Markdown links in active docs were checked.
- Stale local-service terms were searched across active docs.
- Current screenshots were captured from the local mock UI and production login.
- README screenshot frames were regenerated.
- During local screenshot capture, Vite logged expected `502` proxy errors for API calls because no local backend was running; the screenshots were used only for non-mutating UI state and the production login capture came from the live site.

## Remaining Follow-Up

- Re-run hosted voice Tests 1-8 after adapting the script to the Netlify production base URL.
- Improve Lighthouse performance; the latest production score is still low even though accessibility and best practices are strong.
