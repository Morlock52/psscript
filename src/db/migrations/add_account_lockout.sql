-- Migration: Add account lockout support
-- Purpose: Add locked_until column to users table for account lockout functionality
-- Prevents brute-force attacks by locking accounts after too many failed attempts

-- Add locked_until column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_until'
    ) THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE NULL;
        RAISE NOTICE 'Added locked_until column to users table';
    ELSE
        RAISE NOTICE 'locked_until column already exists';
    END IF;
END $$;

-- Add login_attempts column if it doesn't exist (in case it's missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'login_attempts'
    ) THEN
        ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;
        RAISE NOTICE 'Added login_attempts column to users table';
    ELSE
        RAISE NOTICE 'login_attempts column already exists';
    END IF;
END $$;

-- Create index on locked_until for efficient lockout checks
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- Create index on login_attempts for monitoring
CREATE INDEX IF NOT EXISTS idx_users_login_attempts ON users(login_attempts) WHERE login_attempts > 0;

COMMENT ON COLUMN users.locked_until IS 'Timestamp until which the account is locked due to failed login attempts';
COMMENT ON COLUMN users.login_attempts IS 'Number of consecutive failed login attempts';
