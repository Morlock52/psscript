# Database

PostgreSQL + `pgvector` storage for scripts, analysis artifacts, embeddings, users, categories, tags, analytics, and related metadata.

## Current setup

- engine: hosted Supabase Postgres
- vector extension: `pgvector`
- connection: `DATABASE_URL` with SSL enabled
- profile: `DB_PROFILE=supabase`

## Main schema areas

- `scripts`, `script_versions`, `script_analysis`, `script_embeddings`
- `app_profiles`
- `categories`, `tags`, `script_tags`
- `documentation_items`
- `chat_history`
- `ai_metrics`

## Supabase Postgres notes

This app uses Supabase as hosted Postgres. Runtime database code detects the
Supabase profile and maps user-owned records to `app_profiles(id uuid)`.

For Supabase, prefer the connection pooler URL and require SSL:

```bash
DATABASE_URL='postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require'
DB_POOL_MAX=5
DB_POOL_MIN=0
DB_SSL=true
```

RLS is enabled on public tables. Public lookup tables have read policies, and
user/script-owned tables use ownership policies keyed by `auth.uid()`.

Database changes should stay in SQL migrations under `src/db/migrations`. Apply
targeted migrations through the repo migration runner with the Supabase
`DATABASE_URL`:

```bash
DB_MIGRATION_FILES=20260426_supabase_advisor_fixes.sql node scripts/migrations/run-migration.js
```

## Related docs

- `../../docs/DATA-MAINTENANCE.md`
- `../../src/backend/README.md`
