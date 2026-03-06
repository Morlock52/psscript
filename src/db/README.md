# Database

PostgreSQL + `pgvector` storage for scripts, analysis artifacts, embeddings, users, categories, tags, analytics, and related metadata.

## Current setup

- engine: PostgreSQL 15+
- vector extension: `pgvector`
- default local port: `5432`
- default database: `psscript`

## Main schema areas

- `scripts`, `script_versions`, `script_analysis`, `script_embeddings`
- `users`, `user_favorites`
- `categories`, `tags`, `script_tags`
- `documentation`
- `chat_history`
- `execution_logs`
- `ai_metrics`

## Bootstrap paths

Docker bootstrap mounts:
- `src/db/00-init-pgvector.sh`
- `src/db/schema.sql`
- `src/db/seeds/01-initial-data.sql`

## Local development

The easiest path is the repo-level Docker stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d postgres redis
```

Default connection values:

```text
host=127.0.0.1
port=5432
dbname=psscript
user=postgres
password=postgres
```

## Related docs

- `../../docs/DATA-MAINTENANCE.md`
- `../../src/backend/README.md`
