-- Enforce one script per SHA-256 content hash.
-- This migration is intentionally data-preserving for dependent records before
-- removing duplicate script rows.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;
SET search_path = public, extensions;

ALTER TABLE scripts ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
ALTER TABLE scripts ALTER COLUMN file_hash TYPE VARCHAR(64);

UPDATE scripts
SET file_hash = encode(digest(content::text, 'sha256'), 'hex')
WHERE content IS NOT NULL
  AND (file_hash IS NULL OR length(file_hash) = 32);

DROP TABLE IF EXISTS _duplicate_hash_audit;
CREATE TABLE _duplicate_hash_audit AS
SELECT
    duplicate.id AS removed_id,
    keeper.id AS kept_id,
    duplicate.file_hash,
    duplicate.title,
    duplicate.created_at
FROM scripts duplicate
JOIN scripts keeper
  ON keeper.file_hash = duplicate.file_hash
 AND keeper.id = (
     SELECT MIN(id)
     FROM scripts first_script
     WHERE first_script.file_hash = duplicate.file_hash
 )
WHERE duplicate.file_hash IS NOT NULL
  AND duplicate.id <> keeper.id;

INSERT INTO script_tags (script_id, tag_id)
SELECT DISTINCT d.kept_id, st.tag_id
FROM script_tags st
JOIN _duplicate_hash_audit d ON d.removed_id = st.script_id
ON CONFLICT DO NOTHING;

DELETE FROM script_tags st
USING _duplicate_hash_audit d
WHERE st.script_id = d.removed_id;

INSERT INTO user_favorites (user_id, script_id, created_at)
SELECT DISTINCT uf.user_id, d.kept_id, MIN(uf.created_at)
FROM user_favorites uf
JOIN _duplicate_hash_audit d ON d.removed_id = uf.script_id
GROUP BY uf.user_id, d.kept_id
ON CONFLICT DO NOTHING;

DELETE FROM user_favorites uf
USING _duplicate_hash_audit d
WHERE uf.script_id = d.removed_id;

WITH mapped_dependencies AS (
    SELECT DISTINCT
        CASE WHEN sd.parent_script_id = d.removed_id THEN d.kept_id ELSE sd.parent_script_id END AS parent_script_id,
        CASE WHEN sd.child_script_id = d.removed_id THEN d.kept_id ELSE sd.child_script_id END AS child_script_id,
        sd.created_at
    FROM script_dependencies sd
    JOIN _duplicate_hash_audit d
      ON d.removed_id IN (sd.parent_script_id, sd.child_script_id)
)
INSERT INTO script_dependencies (parent_script_id, child_script_id, created_at)
SELECT parent_script_id, child_script_id, MIN(created_at)
FROM mapped_dependencies
WHERE parent_script_id <> child_script_id
GROUP BY parent_script_id, child_script_id
ON CONFLICT DO NOTHING;

DELETE FROM script_dependencies sd
USING _duplicate_hash_audit d
WHERE d.removed_id IN (sd.parent_script_id, sd.child_script_id);

UPDATE comments c
SET script_id = d.kept_id
FROM _duplicate_hash_audit d
WHERE c.script_id = d.removed_id;

UPDATE execution_logs el
SET script_id = d.kept_id
FROM _duplicate_hash_audit d
WHERE el.script_id = d.removed_id;

UPDATE script_analysis sa
SET script_id = d.kept_id
FROM _duplicate_hash_audit d
WHERE sa.script_id = d.removed_id
  AND NOT EXISTS (
      SELECT 1
      FROM script_analysis kept
      WHERE kept.script_id = d.kept_id
  );

DELETE FROM script_analysis sa
USING _duplicate_hash_audit d
WHERE sa.script_id = d.removed_id;

UPDATE script_embeddings se
SET script_id = d.kept_id
FROM _duplicate_hash_audit d
WHERE se.script_id = d.removed_id
  AND NOT EXISTS (
      SELECT 1
      FROM script_embeddings kept
      WHERE kept.script_id = d.kept_id
  );

DELETE FROM script_embeddings se
USING _duplicate_hash_audit d
WHERE se.script_id = d.removed_id;

WITH moved_versions AS (
    SELECT
        d.kept_id,
        sv.content,
        sv.user_id,
        sv.commit_message,
        sv.created_at,
        COALESCE((
            SELECT MAX(version)
            FROM script_versions kept
            WHERE kept.script_id = d.kept_id
        ), 0) AS base_version,
        ROW_NUMBER() OVER (
            PARTITION BY d.kept_id
            ORDER BY sv.created_at, sv.id
        ) AS version_offset
    FROM script_versions sv
    JOIN _duplicate_hash_audit d ON d.removed_id = sv.script_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM script_versions kept
        WHERE kept.script_id = d.kept_id
          AND kept.content = sv.content
    )
)
INSERT INTO script_versions (script_id, content, version, user_id, commit_message, created_at)
SELECT kept_id, content, base_version + version_offset, user_id, commit_message, created_at
FROM moved_versions;

DELETE FROM scripts
WHERE id IN (SELECT removed_id FROM _duplicate_hash_audit);

DROP INDEX IF EXISTS idx_scripts_file_hash;
ALTER TABLE scripts DROP CONSTRAINT IF EXISTS uq_scripts_file_hash;
DROP INDEX IF EXISTS uq_scripts_file_hash;
CREATE UNIQUE INDEX uq_scripts_file_hash ON scripts(file_hash)
WHERE file_hash IS NOT NULL;

COMMENT ON COLUMN scripts.file_hash IS 'SHA-256 hash of the script content for integrity verification and deduplication';

ANALYZE scripts;
