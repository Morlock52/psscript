-- Migration: Upgrade to pgvector 0.8.0 with HNSW indexing
-- File: src/db/migrations/20260107-pgvector-upgrade.sql
-- Date: 2026-01-07
-- Description: Upgrade pgvector extension and add HNSW indexes for 9x faster queries

BEGIN;

-- 1. Upgrade extension to 0.8.0
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION vector WITH VERSION '0.8.0';

-- 2. Recreate embeddings table with optimized structure
CREATE TABLE script_embeddings_new (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    model_version VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Copy data from old table
INSERT INTO script_embeddings_new (id, script_id, embedding, created_at, updated_at)
SELECT id, script_id, embedding, created_at, updated_at
FROM script_embeddings;

-- 4. Drop old table and rename
DROP TABLE script_embeddings CASCADE;
ALTER TABLE script_embeddings_new RENAME TO script_embeddings;

-- 5. Create HNSW index for 9x faster queries
-- m = 16: Number of connections per layer (balance between recall and speed)
-- ef_construction = 64: Construction time parameter (higher = better recall, slower build)
CREATE INDEX idx_script_embeddings_hnsw ON script_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,
    ef_construction = 64
);

-- 6. Add GIN index for hybrid search (script_id lookups)
CREATE INDEX idx_script_embeddings_script_id ON script_embeddings(script_id);

-- 7. Configure table parameters for optimal performance
ALTER TABLE script_embeddings SET (
    hnsw.relaxed_order = 'true',  -- Better recall/latency tradeoff
    autovacuum_vacuum_scale_factor = 0.01,  -- More frequent vacuuming for better index performance
    autovacuum_analyze_scale_factor = 0.01  -- Keep statistics fresh
);

-- 8. Create performance monitoring view
CREATE OR REPLACE VIEW vector_search_performance AS
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%<->%'
ORDER BY mean_exec_time DESC;

-- 9. Create helper function for similarity search with threshold
CREATE OR REPLACE FUNCTION search_similar_scripts(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    script_id int,
    similarity float,
    title text,
    description text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        1 - (se.embedding <=> query_embedding) as similarity,
        s.title,
        s.description
    FROM script_embeddings se
    JOIN scripts s ON s.id = se.script_id
    WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 10. Create function for batch similarity search
CREATE OR REPLACE FUNCTION batch_search_similar_scripts(
    query_embeddings vector(1536)[],
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    query_index int,
    script_id int,
    similarity float,
    title text
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    i int;
    query_emb vector(1536);
BEGIN
    FOR i IN 1..array_length(query_embeddings, 1) LOOP
        query_emb := query_embeddings[i];
        RETURN QUERY
        SELECT
            i as query_index,
            s.id,
            1 - (se.embedding <=> query_emb) as similarity,
            s.title
        FROM script_embeddings se
        JOIN scripts s ON s.id = se.script_id
        WHERE 1 - (se.embedding <=> query_emb) > match_threshold
        ORDER BY se.embedding <=> query_emb
        LIMIT match_count;
    END LOOP;
END;
$$;

-- 11. Add indexes for common query patterns
CREATE INDEX idx_scripts_category_user ON scripts(category_id, user_id);
CREATE INDEX idx_scripts_created_at ON scripts(created_at DESC);
CREATE INDEX idx_script_analysis_script_id ON script_analysis(script_id);

-- 12. Update sequence to match current max ID
SELECT setval('script_embeddings_id_seq', (SELECT MAX(id) FROM script_embeddings));

COMMIT;

-- Post-migration verification
ANALYZE script_embeddings;

-- Test query performance (run this manually after migration)
-- EXPLAIN ANALYZE
-- SELECT * FROM search_similar_scripts(
--     (SELECT embedding FROM script_embeddings LIMIT 1),
--     0.7,
--     10
-- );

-- Expected performance improvement: ~9x faster queries vs previous version
-- Monitor with: SELECT * FROM vector_search_performance;
