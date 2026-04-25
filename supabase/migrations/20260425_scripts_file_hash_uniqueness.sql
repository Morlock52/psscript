CREATE TABLE IF NOT EXISTS script_file_hash_duplicate_audit (
  removed_id BIGINT PRIMARY KEY,
  kept_id BIGINT NOT NULL,
  file_hash TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO script_file_hash_duplicate_audit (removed_id, kept_id, file_hash, title, created_at)
SELECT duplicate.id, keeper.id, duplicate.file_hash, duplicate.title, duplicate.created_at
FROM scripts AS duplicate
JOIN scripts AS keeper
  ON duplicate.file_hash = keeper.file_hash
 AND duplicate.id > keeper.id
WHERE duplicate.file_hash IS NOT NULL
ON CONFLICT (removed_id) DO NOTHING;

UPDATE script_versions AS sv
SET script_id = audit.kept_id
FROM script_file_hash_duplicate_audit AS audit
WHERE sv.script_id = audit.removed_id
  AND NOT EXISTS (
    SELECT 1
    FROM script_versions AS existing
    WHERE existing.script_id = audit.kept_id
      AND existing.version = sv.version
  );

DELETE FROM script_versions AS sv
USING script_file_hash_duplicate_audit AS audit
WHERE sv.script_id = audit.removed_id;

UPDATE script_tags AS st
SET script_id = audit.kept_id
FROM script_file_hash_duplicate_audit AS audit
WHERE st.script_id = audit.removed_id
  AND NOT EXISTS (
    SELECT 1
    FROM script_tags AS existing
    WHERE existing.script_id = audit.kept_id
      AND existing.tag_id = st.tag_id
  );

DELETE FROM script_tags AS st
USING script_file_hash_duplicate_audit AS audit
WHERE st.script_id = audit.removed_id;

UPDATE script_analysis AS sa
SET script_id = audit.kept_id
FROM script_file_hash_duplicate_audit AS audit
WHERE sa.script_id = audit.removed_id
  AND NOT EXISTS (
    SELECT 1
    FROM script_analysis AS existing
    WHERE existing.script_id = audit.kept_id
  );

DELETE FROM script_analysis AS sa
USING script_file_hash_duplicate_audit AS audit
WHERE sa.script_id = audit.removed_id;

UPDATE script_embeddings AS se
SET script_id = audit.kept_id
FROM script_file_hash_duplicate_audit AS audit
WHERE se.script_id = audit.removed_id
  AND NOT EXISTS (
    SELECT 1
    FROM script_embeddings AS existing
    WHERE existing.script_id = audit.kept_id
  );

DELETE FROM script_embeddings AS se
USING script_file_hash_duplicate_audit AS audit
WHERE se.script_id = audit.removed_id;

DELETE FROM scripts AS s
USING script_file_hash_duplicate_audit AS audit
WHERE s.id = audit.removed_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scripts_file_hash_unique
ON scripts (file_hash)
WHERE file_hash IS NOT NULL;
