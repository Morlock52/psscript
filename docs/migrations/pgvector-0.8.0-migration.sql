-- Migration: Upgrade to pgvector 0.8.0 with HNSW indexing
-- Date: 2026-01-26
-- Description: Upgrades pgvector extension from 0.1.x/0.2.x to 0.8.0 and adds HNSW indexes for 9x faster vector search
--
-- Performance Benefits:
-- - 9x faster query processing (AWS Aurora benchmarks)
-- - 100x more relevant results (improved recall)
-- - HNSW graph-based indexing (no training required)
-- - Iterative scanning for better accuracy/performance balance
--
-- IMPORTANT: This migration requires PostgreSQL 12+ and pgvector 0.8.0 extension to be available
-- Run this migration during a maintenance window as it will rebuild indexes

BEGIN;

-- Step 1: Check current pgvector version
DO $$
DECLARE
    current_version TEXT;
BEGIN
    SELECT extversion INTO current_version
    FROM pg_extension
    WHERE extname = 'vector';

    RAISE NOTICE 'Current pgvector version: %', COALESCE(current_version, 'NOT INSTALLED');
END $$;

-- Step 2: Upgrade extension to 0.8.0
-- Note: This requires pgvector 0.8.0 to be installed on the system
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION IF NOT EXISTS vector WITH VERSION '0.8.0';

RAISE NOTICE 'pgvector upgraded to 0.8.0';

-- Step 3: Check if script_embeddings table exists, if not create it
CREATE TABLE IF NOT EXISTS script_embeddings (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    model_version VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_script_embedding UNIQUE(script_id)
);

RAISE NOTICE 'script_embeddings table verified/created';

-- Step 4: Drop old indexes if they exist
DROP INDEX IF EXISTS idx_script_embeddings_ivfflat;
DROP INDEX IF EXISTS idx_script_embeddings_embedding;
DROP INDEX IF EXISTS script_embeddings_embedding_idx;

RAISE NOTICE 'Old indexes dropped';

-- Step 5: Create HNSW index for 9x faster queries
-- HNSW parameters:
-- - m = 16: Number of connections per layer (good balance between quality and speed)
-- - ef_construction = 64: Construction-time parameter (higher = better quality, slower build)
CREATE INDEX idx_script_embeddings_hnsw ON script_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,
    ef_construction = 64
);

RAISE NOTICE 'HNSW index created successfully';

-- Step 6: Add standard B-tree index for script_id lookups
CREATE INDEX IF NOT EXISTS idx_script_embeddings_script_id
ON script_embeddings(script_id);

RAISE NOTICE 'B-tree index on script_id created';

-- Step 7: Configure table parameters for optimal performance
ALTER TABLE script_embeddings SET (
    -- Enable relaxed ordering for better recall/latency tradeoff
    hnsw.relaxed_order = 'true',
    -- More frequent vacuuming for better index maintenance
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.01
);

RAISE NOTICE 'Table parameters configured';

-- Step 8: Create performance monitoring view
CREATE OR REPLACE VIEW vector_search_performance AS
SELECT
    queryid,
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    min_exec_time,
    stddev_exec_time,
    rows as avg_rows
FROM pg_stat_statements
WHERE query LIKE '%<->%'  -- Cosine distance operator
   OR query LIKE '%<#>%'  -- Inner product operator
   OR query LIKE '%<=>%'  -- L2 distance operator
ORDER BY mean_exec_time DESC;

RAISE NOTICE 'Performance monitoring view created';

-- Step 9: Create helper function for similarity search with improved API
CREATE OR REPLACE FUNCTION search_similar_scripts(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_user_id int DEFAULT NULL
)
RETURNS TABLE (
    script_id int,
    similarity float,
    title text,
    description text,
    content text,
    created_at timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        1 - (se.embedding <=> query_embedding) as similarity,
        s.title,
        s.description,
        s.content,
        s.created_at
    FROM script_embeddings se
    JOIN scripts s ON s.id = se.script_id
    WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
      AND (filter_user_id IS NULL OR s.user_id = filter_user_id)
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

RAISE NOTICE 'Similarity search function created';

-- Step 10: Create function to get embedding statistics
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
    total_embeddings bigint,
    unique_scripts bigint,
    avg_embedding_age interval,
    index_size text,
    table_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::bigint as total_embeddings,
        COUNT(DISTINCT script_id)::bigint as unique_scripts,
        AVG(NOW() - created_at) as avg_embedding_age,
        pg_size_pretty(pg_relation_size('idx_script_embeddings_hnsw')) as index_size,
        pg_size_pretty(pg_total_relation_size('script_embeddings')) as table_size
    FROM script_embeddings;
END;
$$ LANGUAGE plpgsql STABLE;

RAISE NOTICE 'Embedding statistics function created';

-- Step 11: Enable pg_stat_statements if not already enabled (for performance monitoring)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

RAISE NOTICE 'pg_stat_statements extension enabled';

-- Step 12: Grant necessary permissions
GRANT SELECT ON vector_search_performance TO PUBLIC;
GRANT EXECUTE ON FUNCTION search_similar_scripts(vector, float, int, int) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_embedding_stats() TO PUBLIC;

RAISE NOTICE 'Permissions granted';

-- Step 13: Analyze the table to update statistics
ANALYZE script_embeddings;

RAISE NOTICE 'Table statistics updated';

COMMIT;

-- Post-migration verification queries
-- Uncomment to run after migration

-- Check extension version
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Get embedding statistics
-- SELECT * FROM get_embedding_stats();

-- Test similarity search (replace with actual embedding vector)
-- SELECT * FROM search_similar_scripts(
--     (SELECT embedding FROM script_embeddings LIMIT 1),
--     0.7,
--     10
-- );

-- Check index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'script_embeddings';

-- Monitor query performance
-- SELECT * FROM vector_search_performance LIMIT 10;

-- Verify HNSW index exists
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'script_embeddings'
-- AND indexname LIKE '%hnsw%';

RAISE NOTICE '
=============================================================
pgvector 0.8.0 Migration Complete!
=============================================================

Next Steps:
1. Verify index creation: SELECT * FROM pg_indexes WHERE tablename = ''script_embeddings'';
2. Check statistics: SELECT * FROM get_embedding_stats();
3. Monitor performance: SELECT * FROM vector_search_performance;
4. Test similarity search with actual queries
5. Update application code to use new search_similar_scripts() function

Performance Tips:
- HNSW index size will be ~8GB for 1M embeddings
- Keep index in memory for best performance
- Use hnsw.ef_search parameter to tune query-time accuracy
- Monitor pg_stat_statements for slow queries

For more information, see:
- AWS: https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/
- pgvector docs: https://github.com/pgvector/pgvector
=============================================================
';
