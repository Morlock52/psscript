-- Migration: Make pgvector search safer and faster without destructive extension drops.
-- Original risk fixed: DROP EXTENSION ... CASCADE can drop vector columns and data.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
SET search_path = public, extensions;
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET search_path = public, extensions', current_database());
END $$;

-- Keep the existing table and data. Add metadata columns used by newer code paths.
ALTER TABLE script_embeddings
    ADD COLUMN IF NOT EXISTS embedding_type VARCHAR(50) NOT NULL DEFAULT 'openai',
    ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small';

UPDATE script_embeddings
SET embedding_type = COALESCE(embedding_type, 'openai'),
    model_version = COALESCE(model_version, 'text-embedding-3-small');

DELETE FROM script_embeddings
WHERE script_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'script_embeddings_script_id_key'
          AND conrelid = 'script_embeddings'::regclass
    ) THEN
        ALTER TABLE script_embeddings
            ADD CONSTRAINT script_embeddings_script_id_key UNIQUE (script_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM script_embeddings WHERE embedding IS NULL) THEN
        ALTER TABLE script_embeddings ALTER COLUMN embedding SET NOT NULL;
    END IF;
END $$;

-- Supabase's current vector guidance recommends HNSW over IVFFlat for most cases.
DROP INDEX IF EXISTS script_embeddings_idx;
CREATE INDEX IF NOT EXISTS idx_script_embeddings_hnsw
ON script_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,
    ef_construction = 64
);

ALTER TABLE script_embeddings SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.01
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        EXECUTE $view$
            CREATE OR REPLACE VIEW vector_search_performance AS
            SELECT
                query,
                calls,
                mean_exec_time,
                max_exec_time,
                stddev_exec_time,
                rows
            FROM pg_stat_statements
            WHERE query LIKE '%<->%' OR query LIKE '%<=>%'
            ORDER BY mean_exec_time DESC
        $view$;
    ELSE
        DROP VIEW IF EXISTS vector_search_performance;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION search_similar_scripts(
    query_embedding vector(1536),
    match_threshold double precision DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    script_id int,
    similarity double precision,
    title text,
    description text
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_catalog
AS $$
    SELECT
        s.id,
        1 - (se.embedding <=> query_embedding) AS similarity,
        s.title::text,
        s.description
    FROM script_embeddings se
    JOIN scripts s ON s.id = se.script_id
    WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION batch_search_similar_scripts(
    query_embeddings vector(1536)[],
    match_threshold double precision DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    query_index int,
    script_id int,
    similarity double precision,
    title text
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_catalog
AS $$
    SELECT
        q.query_index::int,
        matches.script_id,
        matches.similarity,
        matches.title
    FROM unnest(query_embeddings) WITH ORDINALITY AS q(query_embedding, query_index)
    CROSS JOIN LATERAL (
        SELECT
            s.id AS script_id,
            1 - (se.embedding <=> q.query_embedding) AS similarity,
            s.title::text AS title
        FROM script_embeddings se
        JOIN scripts s ON s.id = se.script_id
        WHERE 1 - (se.embedding <=> q.query_embedding) > match_threshold
        ORDER BY se.embedding <=> q.query_embedding
        LIMIT match_count
    ) AS matches;
$$;

CREATE INDEX IF NOT EXISTS idx_scripts_category_user ON scripts(category_id, user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at DESC);

DROP INDEX IF EXISTS idx_script_analysis_script_id;
DROP INDEX IF EXISTS idx_script_analysis_script;

SELECT setval(
    'script_embeddings_id_seq',
    COALESCE((SELECT MAX(id) FROM script_embeddings), 1),
    (SELECT MAX(id) IS NOT NULL FROM script_embeddings)
);

ANALYZE script_embeddings;
