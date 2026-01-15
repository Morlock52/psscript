-- Seed script: Create default admin user
-- Default credentials: admin@psscript.local / Admin123!
--
-- SECURITY NOTICE:
-- 1. These default credentials are ONLY for initial setup
-- 2. CHANGE passwords immediately after first login
-- 3. In production, use the seed-default-user.js script instead
--    to generate bcrypt hashes with proper rounds (12)
--
-- For production deployment, run:
--   docker-compose exec backend node /app/scripts/seed-default-user.js

-- Insert default admin user if not exists
-- Password is bcrypt hash of 'Admin123!' with 12 salt rounds
-- Hash generated via: bcrypt.hashSync('Admin123!', 12)
INSERT INTO users (username, email, password_hash, role, login_attempts, created_at, updated_at)
SELECT 'admin', 'admin@psscript.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.Iq0gHvoLf4JyWq', 'admin', 0, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'admin' OR email = 'admin@psscript.local'
);

-- Create demo user for testing (non-admin role)
INSERT INTO users (username, email, password_hash, role, login_attempts, created_at, updated_at)
SELECT 'demo', 'demo@psscript.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.Iq0gHvoLf4JyWq', 'user', 0, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'demo' OR email = 'demo@psscript.local'
);
