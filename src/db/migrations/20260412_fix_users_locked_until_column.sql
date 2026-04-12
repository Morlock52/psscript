ALTER TABLE users
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

UPDATE users
SET locked_until = COALESCE(locked_until, lockout_until)
WHERE EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'lockout_until'
);

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until)
WHERE locked_until IS NOT NULL;
