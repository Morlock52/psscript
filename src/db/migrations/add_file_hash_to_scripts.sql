-- Add file_hash column to scripts table for file integrity verification
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
ALTER TABLE scripts ALTER COLUMN file_hash TYPE VARCHAR(64);

-- Comment explaining the migration
COMMENT ON COLUMN scripts.file_hash IS 'SHA-256 hash of the script content for integrity verification and deduplication';

-- Note: Vector embedding functionality is disabled because pgvector extension is not installed
-- To enable vector search, install pgvector extension and run the following SQL:
-- 
-- ALTER TABLE scripts ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- CREATE INDEX IF NOT EXISTS idx_scripts_embedding ON scripts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- COMMENT ON COLUMN scripts.embedding IS 'Vector embedding of script content for semantic search';
