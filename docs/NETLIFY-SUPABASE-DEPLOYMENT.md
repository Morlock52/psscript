# Netlify + Supabase Deployment

This is the hosted production path for PSScript.

Last reviewed: 2026-04-26.

## Architecture

- Netlify serves the Vite app from `src/frontend/dist`.
- Netlify Functions serve same-origin `/api/*` routes from `netlify/functions`.
- Supabase Auth owns login/session identity, including Google OAuth.
- Supabase Postgres stores application data using `supabase/migrations/20260424_hosted_schema.sql`.
- `app_profiles` stores the local PSScript account mapped to `auth.users.id`; Google-created profiles are disabled until an admin enables them.
- Hosted production is static-analysis-only; arbitrary PowerShell execution is disabled.

## Current Status

- Repo wiring exists for Netlify Functions and Supabase migrations.
- Local Browser Use QA on 2026-04-24 validated the running app shell, AI chat, Voice Copilot dock, documentation routes, settings, and UI components.
- Hosted preview smoke is blocked until Netlify has the Supabase URL/keys, service-role key, pooler `DATABASE_URL`, and AI provider keys configured.
- `/api/health` may report `degraded` on preview when Supabase/DB env is missing; that is expected until the environment variables below are set.

## Supabase Setup

1. Create a Supabase project.
2. Apply all migrations in `supabase/migrations/` in filename order.
3. Confirm the `vector` extension is enabled.
4. Create users through Supabase Auth or the app's admin User Management page.
5. Set `DEFAULT_ADMIN_EMAIL` in Netlify for the first admin profile bootstrap.
6. Enable Google in Supabase Auth Providers using the Google OAuth client credentials from Google Cloud.
7. Add these redirect URLs to Supabase Auth URL configuration and the Google OAuth client:
   - `https://YOUR_NETLIFY_SITE/auth/callback`
   - `http://localhost:3090/auth/callback` for local hosted-mode testing when needed.

## Google OAuth Approval Flow

- The frontend calls Supabase `signInWithOAuth({ provider: 'google' })`.
- Supabase creates the Auth user; the Netlify `/api/auth/me` call creates or updates the matching `app_profiles` row.
- New Google profiles default to `is_enabled = false` unless the email matches `DEFAULT_ADMIN_EMAIL`.
- Disabled users can only complete sign-in far enough to see `/pending-approval`; protected API routes return `403 account_pending_approval`.
- Admins enable accounts from Settings > User Management by checking the Enabled box.
- The backend prevents disabling the current admin and prevents removing the last enabled admin.

## Netlify Environment Variables

Set these in Netlify:

```text
DATABASE_URL=postgresql://...supabase pooler URL...
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DEFAULT_ADMIN_EMAIL=admin@example.com
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
OPENAI_ANALYSIS_MODEL=gpt-5.4-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_MAX_OUTPUT_TOKENS=1600
OPENAI_ANALYSIS_MAX_OUTPUT_TOKENS=1800
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MAX_TOKENS=1600
VOICE_TTS_MODEL=gpt-4o-mini-tts
VOICE_TTS_VOICE=marin
VOICE_STT_MODEL=gpt-4o-mini-transcribe
VOICE_STT_DIARIZE_MODEL=gpt-4o-transcribe-diarize
VOICE_MAX_BASE64_CHARS=16000000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_HOSTED_STATIC_ANALYSIS_ONLY=true
```

`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and model provider keys must stay server-side only.
If a local developer machine or CI image cannot validate the Supabase pooler certificate chain, provide `DB_SSL_CA` / `DB_SSL_CA_PATH`. Use `DB_SSL_REJECT_UNAUTHORIZED=false` only for local diagnostics.

## AI and Voice Integration

- Text and chat use OpenAI's Responses API first, with `store: false` and the `output_text` helper.
- PowerShell analysis uses OpenAI Structured Outputs with a strict JSON schema so the UI receives stable fields.
- Anthropic is configured as the fallback text provider through the official Messages API SDK.
- Voice synthesis and recognition use OpenAI Audio endpoints. The default hosted voice is `marin`; `cedar` is also available for higher-quality speech. Speech speed accepts OpenAI's documented `0.25` to `4.0` range.
- Diarized speech recognition uses `gpt-4o-transcribe-diarize` with `response_format: diarized_json` and automatic chunking so speaker segments are returned when available.
- Embeddings use `text-embedding-3-small` at 1536 dimensions to match the Supabase `vector(1536)` schema.

Reference docs reviewed:

- OpenAI text generation: https://developers.openai.com/api/docs/guides/text
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI audio and speech: https://developers.openai.com/api/docs/guides/audio
- Anthropic Messages API: https://platform.claude.com/docs/en/build-with-claude/working-with-messages
- Supabase Google Auth: https://supabase.com/docs/guides/auth/social-login/auth-google

## Netlify Build

The root `netlify.toml` runs:

```bash
npm run build:netlify
```

That command installs frontend dependencies and builds `src/frontend`.

## Local Hosted-Mode Smoke

```bash
cd src/frontend
VITE_SUPABASE_URL=... \
VITE_SUPABASE_ANON_KEY=... \
VITE_HOSTED_STATIC_ANALYSIS_ONLY=true \
npm run dev -- --host 0.0.0.0 --port 3191
```

Then verify:

- `/login` renders.
- login/register use Supabase Auth.
- `/api/health` returns `runtime: netlify-functions` on Netlify.
- script upload, script detail, AI analysis, chat, analytics, and documentation routes respond.
- execution controls show hosted static-analysis-only behavior.
