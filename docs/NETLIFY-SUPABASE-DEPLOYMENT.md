# Netlify + Supabase Deployment

Last reviewed: April 28, 2026.

This is the active hosted production path for PSScript.

## Current Production

| Item | Value |
| --- | --- |
| Production app | `https://pstest.morloksmaze.com` |
| Hosting | Netlify static site plus Netlify Functions |
| API base | Same-origin `/api/*` |
| Database | Hosted Supabase Postgres |
| Auth | Supabase Auth, Google OAuth, admin approval through `app_profiles` |
| Storage of backups | Hosted Supabase tables, including admin backup metadata |

## Architecture

1. Netlify builds `src/frontend` and publishes `src/frontend/dist`.
2. Netlify Functions serve same-origin API routes from `netlify/functions`.
3. Supabase Auth owns browser sessions.
4. Supabase Postgres stores scripts, analysis results, profiles, metrics, vectors, backups, and operational state.
5. Supabase RLS protects direct table access; Netlify Functions enforce the API authorization gate before application work.

This project does not use a local database in the active deployment. `DATABASE_URL` must point to hosted Supabase or another hosted Supabase-compatible Postgres endpoint.

## Netlify Routing

The current app relies on Netlify redirects for two behaviors:

- API routes are handled by Netlify Functions under `/api/*`.
- SPA routes such as `/scripts`, `/settings/data`, and `/agentic` fall back to `index.html`.

The `/agentic`, `/agentic-ai`, and `/ai/agentic` aliases intentionally resolve to `/ai/assistant` so bookmarked agentic paths do not 404.

## Supabase Setup

1. Create or use the hosted Supabase project.
2. Apply every migration in `supabase/migrations/` in filename order.
3. Confirm `vector` is enabled for `pgvector(1536)` embeddings.
4. Configure Supabase Auth providers.
5. Add `https://pstest.morloksmaze.com/auth/callback` to the Supabase redirect allow-list.
6. For Google OAuth, set the Google authorized redirect URI to the Supabase callback:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
7. Set `DEFAULT_ADMIN_EMAIL` so the first intended admin profile can be enabled.

Google redirects to Supabase Auth first. Supabase then redirects back to the app callback supplied by `signInWithOAuth({ options: { redirectTo } })`.

## Approval Gate

- Password login and Google OAuth both use Supabase Auth.
- `/api/auth/me` creates or updates the matching `app_profiles` row.
- New users default to `is_enabled = false`.
- Disabled users can only reach pending approval behavior; protected APIs return `403 account_pending_approval`.
- Admins enable users from Settings -> User Management.
- The API prevents self-disable and last-enabled-admin removal.
- RLS policies continue to enforce enabled-profile checks at the database layer.

## Netlify Environment Variables

Set these in Netlify. Server-side secrets must stay in the Functions environment and must never be exposed as `VITE_*` values.

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
VOICE_TTS_MODEL=gpt-4o-mini-tts
VOICE_TTS_VOICE=marin
VOICE_STT_MODEL=gpt-4o-mini-transcribe
VOICE_STT_DIARIZE_MODEL=gpt-4o-transcribe-diarize
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_HOSTED_STATIC_ANALYSIS_ONLY=true
```

Use `DB_SSL_CA` or `DB_SSL_CA_PATH` if the runtime needs a Supabase pooler CA bundle. Use `DB_SSL_REJECT_UNAUTHORIZED=false` only for local diagnostics.

## Build And Deploy

```bash
npm run build:netlify
netlify deploy --prod
```

Production verification:

```bash
curl -fsS https://pstest.morloksmaze.com/api/health
```

The expected hosted health payload should identify the Netlify Functions runtime and report database connectivity when Supabase environment variables are present.

## AI And Export Behavior

- Hosted text/chat uses OpenAI first with Anthropic fallback where configured.
- Script analysis returns the current criteria payload and deterministic fallback shape if provider JSON is unavailable.
- Embeddings use `text-embedding-3-small` at 1536 dimensions.
- Script analysis export is a PDF download from `/api/scripts/:id/export-analysis`.
- Arbitrary PowerShell execution is disabled in hosted production.

## References Reviewed April 28, 2026

- Netlify Functions: https://docs.netlify.com/build/functions/overview/
- Netlify redirects and rewrites: https://docs.netlify.com/routing/redirects/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
