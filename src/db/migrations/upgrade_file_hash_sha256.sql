-- Upgrade file hashes from MD5 (32 hex chars) to SHA-256 (64 hex chars).
-- Recompute in-place to avoid a dedup gap where uploads could bypass duplicate detection.
-- The application now uses SHA-256 for all new uploads.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE scripts
  SET file_hash = encode(digest(content::text, 'sha256'), 'hex')
  WHERE file_hash IS NOT NULL AND length(file_hash) = 32;
