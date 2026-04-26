-- Upgrade file hashes from MD5 (32 hex chars) to SHA-256 (64 hex chars).
-- Recompute in-place to avoid a dedup gap where uploads could bypass duplicate detection.
-- The application now uses SHA-256 for all new uploads.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;
SET search_path = public, extensions;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
ALTER TABLE scripts ALTER COLUMN file_hash TYPE VARCHAR(64);
UPDATE scripts
  SET file_hash = encode(digest(content::text, 'sha256'), 'hex')
  WHERE file_hash IS NOT NULL AND length(file_hash) = 32;
COMMENT ON COLUMN scripts.file_hash IS 'SHA-256 hash of the script content for integrity verification and deduplication';
