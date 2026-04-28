# Supabase DB Fix Implementation - 2026-04-27

## Scope

This implements the fix package from `docs/SUPABASE-DB-REVIEW-2026-04-27.md` as local repo changes. It does not apply the migration to hosted Supabase by itself.

Target production stack:

- Netlify project: `psscript`
- Netlify site ID: `a6cb54b5-b3f7-4f01-a756-70b127f07e19`
- Production URL: `https://pstest.morloksmaze.com`
- Supabase project: `picxiqcekyfgjlrknfds`

## Changes Made

- Added `supabase/migrations/20260427_hosted_search_similarity_rls_fixes.sql`.
- Added matching local parity migration at `src/db/migrations/20260427_hosted_search_similarity_rls_fixes.sql`.
- Reworked hosted script search to use `websearch_to_tsquery`, generated `search_vector`, rank ordering, and an `ILIKE` fallback.
- Reworked hosted documentation search to use the same indexed full-text path.
- Replaced the hosted `/api/scripts/:id/similar` placeholder with pgvector cosine similarity over `script_embeddings`.
- Changed script embedding writes to `ON CONFLICT (script_id) DO UPDATE`, so re-analysis refreshes embeddings instead of failing on duplicates.
- Added static regression coverage in `src/frontend/src/api/__tests__/hostedAiClient.test.ts`.

## Migration Contents

The new migration:

- Enables `pg_trgm` and keeps `vector` in the `extensions` schema.
- Adds generated full-text `search_vector` columns and GIN indexes for `scripts` and `documentation_items`.
- Adds trigram indexes for script/document titles and script descriptions.
- Adds dashboard/search indexes for `ai_metrics`, scripts by owner/update time, public scripts, category/update time, and `app_profiles.approved_by`.
- Standardizes `script_embeddings.embedding_model` while preserving legacy `model_version` data if present.
- Adds an HNSW vector index for `script_embeddings.embedding`.
- Adds `current_app_profile_is_admin()`.
- Rewrites direct Supabase RLS policies to use `TO authenticated` and `(SELECT public.current_app_profile_is_enabled())` so Supabase can init-plan the stable helper once per statement.
- Limits direct reads of `schema_migrations` and `script_file_hash_duplicate_audit` to enabled admins.
- Changes categories, tags, and documentation direct reads from anonymous public access to authenticated enabled users.

## Deployment Order

1. Apply the Supabase migration to project `picxiqcekyfgjlrknfds`.
2. Confirm the migration created:
   - `idx_scripts_search_vector`
   - `idx_documentation_items_search_vector`
   - `idx_script_embeddings_hnsw`
   - `current_app_profile_is_admin()`
3. Deploy Netlify site `a6cb54b5-b3f7-4f01-a756-70b127f07e19`.
4. Verify hosted API and UI.

The code has a fallback for missing `search_vector`, but the intended production path is migration first, deploy second.

## Verification Checklist

- `curl https://pstest.morloksmaze.com/api/health` returns healthy.
- Authenticated `GET /api/scripts/search?q=service` returns 200.
- Authenticated `GET /api/documentation/search?q=powershell` returns 200.
- Authenticated `GET /api/scripts/:id/similar` returns 200 with `similar_scripts` and no placeholder.
- `GET /api/analytics/ai/summary` returns 200 for an authenticated user.
- Dashboard, Chat Assistant, Agentic Assistant, AI Agents template chat, voice settings, script analysis, script generation, and explanation still load through Netlify Functions.

## Sources Used

- Supabase RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase query optimization guidance: https://supabase.com/docs/guides/database/query-optimization
- Supabase pgvector/HNSW guidance: https://supabase.com/docs/guides/troubleshooting/increase-vector-lookup-speeds-by-applying-an-hsnw-index-ohLHUM
- PostgreSQL full-text search controls: https://www.postgresql.org/docs/current/textsearch-controls.html
- PostgreSQL `pg_trgm`: https://www.postgresql.org/docs/current/pgtrgm.html
- Netlify Functions guidance: https://docs.netlify.com/build/functions/overview/
