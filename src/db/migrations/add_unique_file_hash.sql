-- PREREQUISITE: Task 5 migration (upgrade_file_hash_sha256.sql) must have run first
-- to rehash all MD5 values to SHA-256.
--
-- Step 1: Audit any remaining duplicate hashes into a temp table for review.
CREATE TABLE IF NOT EXISTS _duplicate_hash_audit AS
  SELECT a.id AS removed_id, b.id AS kept_id, a.file_hash, a.title, a.created_at
  FROM scripts a
  JOIN scripts b ON a.file_hash = b.file_hash AND a.id < b.id
  WHERE a.file_hash IS NOT NULL;

-- Step 2: Reassign dependent records from duplicates to the kept script.
UPDATE script_versions SET script_id = d.kept_id
  FROM _duplicate_hash_audit d WHERE script_versions.script_id = d.removed_id;

UPDATE script_tags SET script_id = d.kept_id
  FROM _duplicate_hash_audit d WHERE script_tags.script_id = d.removed_id
  ON CONFLICT DO NOTHING;

UPDATE analysis_results SET script_id = d.kept_id
  FROM _duplicate_hash_audit d WHERE analysis_results.script_id = d.removed_id;

-- Step 3: Remove duplicate rows.
DELETE FROM scripts WHERE id IN (SELECT removed_id FROM _duplicate_hash_audit);

-- Step 4: Add UNIQUE constraint.
ALTER TABLE scripts ADD CONSTRAINT uq_scripts_file_hash UNIQUE (file_hash);
