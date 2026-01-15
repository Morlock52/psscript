-- Migration: Add performance indexes
-- Purpose: Optimize database queries for authentication and common lookups
-- These indexes improve query performance without changing data structure

-- Index for user email lookups (login, registration duplicate check)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for user username lookups (profile pages, mentions)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Index for user role (admin queries, permission checks)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Composite index for login: email + password_hash (covers common query pattern)
CREATE INDEX IF NOT EXISTS idx_users_email_password ON users(email, password_hash);

-- Index for finding locked accounts (security monitoring)
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- Index for login attempts (security monitoring)
CREATE INDEX IF NOT EXISTS idx_users_login_attempts ON users(login_attempts) WHERE login_attempts > 0;

-- Index for last login (user activity reports)
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at) WHERE last_login_at IS NOT NULL;

-- Index for created_at (user registration reports, sorting)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Analyze tables to update statistics for query planner
ANALYZE users;

-- Comments for documentation
COMMENT ON INDEX idx_users_email IS 'Primary lookup index for email-based authentication';
COMMENT ON INDEX idx_users_username IS 'Lookup index for username-based searches';
COMMENT ON INDEX idx_users_role IS 'Filter index for role-based access queries';
COMMENT ON INDEX idx_users_email_password IS 'Composite index for login query optimization';
COMMENT ON INDEX idx_users_locked_until IS 'Partial index for locked account monitoring';
COMMENT ON INDEX idx_users_login_attempts IS 'Partial index for failed login attempt monitoring';
COMMENT ON INDEX idx_users_last_login IS 'Index for user activity tracking';
COMMENT ON INDEX idx_users_created_at IS 'Index for user registration timeline queries';
