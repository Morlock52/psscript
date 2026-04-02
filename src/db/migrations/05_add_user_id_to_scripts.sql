-- Migration: 05_add_user_id_to_scripts.sql
-- Description: Adds user_id column to scripts table (safe for existing data)

-- Step 1: Add column as nullable (safe for existing rows)
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Step 2: Backfill existing rows with the first admin user (if any rows exist)
UPDATE scripts SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
WHERE user_id IS NULL;

-- Step 3: Now that all rows have a value, add the NOT NULL constraint
-- Only if backfill succeeded (all rows have user_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM scripts WHERE user_id IS NULL) THEN
    ALTER TABLE scripts ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;
