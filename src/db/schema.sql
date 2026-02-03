-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Reset the public schema if exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') THEN
        -- Keep this commented unless you want to reset the database
        -- DROP SCHEMA public CASCADE;
        -- CREATE SCHEMA public;
    END IF;
END $$;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User security indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email_password ON users(email, password_hash);
CREATE INDEX idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX idx_users_login_attempts ON users(login_attempts) WHERE login_attempts > 0;
CREATE INDEX idx_users_last_login ON users(last_login_at) WHERE last_login_at IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at);

COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN users.login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Account lockout expiry timestamp';

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scripts table
CREATE TABLE scripts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    is_public BOOLEAN NOT NULL DEFAULT false,
    -- Used by the UI for "popular scripts" sorting.
    -- Incremented when a script is viewed (optional feature).
    views INTEGER NOT NULL DEFAULT 0,
    execution_count INTEGER NOT NULL DEFAULT 0,
    average_execution_time FLOAT,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    file_hash VARCHAR(255)
);

-- File hash index for deduplication
CREATE INDEX idx_scripts_file_hash ON scripts(file_hash);
COMMENT ON COLUMN scripts.file_hash IS 'MD5 hash of script content for deduplication';

-- Script versions table
CREATE TABLE script_versions (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    commit_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(script_id, version)
);

-- Script tags relation
CREATE TABLE script_tags (
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (script_id, tag_id)
);

-- AI Analysis table
CREATE TABLE script_analysis (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE UNIQUE,
    purpose TEXT,
    security_score FLOAT,
    quality_score FLOAT,
    risk_score FLOAT,
    parameter_docs JSONB DEFAULT '{}'::jsonb,
    suggestions JSONB DEFAULT '[]'::jsonb,
    command_details JSONB DEFAULT '[]'::jsonb,
    ms_docs_references JSONB DEFAULT '[]'::jsonb,
    security_issues JSONB DEFAULT '[]'::jsonb,
    best_practice_violations JSONB DEFAULT '[]'::jsonb,
    performance_insights JSONB DEFAULT '[]'::jsonb,
    potential_risks JSONB DEFAULT '[]'::jsonb,
    code_complexity_metrics JSONB DEFAULT '{}'::jsonb,
    compatibility_notes JSONB DEFAULT '[]'::jsonb,
    execution_summary JSONB DEFAULT '{}'::jsonb,
    analysis_version VARCHAR(50) DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comments for script_analysis columns
COMMENT ON COLUMN script_analysis.command_details IS 'Detailed analysis of PowerShell commands used in the script';
COMMENT ON COLUMN script_analysis.ms_docs_references IS 'References to Microsoft documentation for commands used in the script';
COMMENT ON COLUMN script_analysis.security_issues IS 'Security vulnerabilities and issues found';
COMMENT ON COLUMN script_analysis.best_practice_violations IS 'PSScriptAnalyzer rule violations';
COMMENT ON COLUMN script_analysis.performance_insights IS 'Performance optimization recommendations';
COMMENT ON COLUMN script_analysis.potential_risks IS 'Execution and implementation risks';
COMMENT ON COLUMN script_analysis.code_complexity_metrics IS 'Cyclomatic complexity, nesting levels, etc.';
COMMENT ON COLUMN script_analysis.compatibility_notes IS 'PowerShell version compatibility notes';
COMMENT ON COLUMN script_analysis.execution_summary IS 'Summary of resources accessed/modified';

-- Vector embeddings table
CREATE TABLE script_embeddings (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) UNIQUE,
    embedding vector(1536),  -- OpenAI embedding size
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Script dependencies
CREATE TABLE script_dependencies (
    parent_script_id INTEGER REFERENCES scripts(id),
    child_script_id INTEGER REFERENCES scripts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parent_script_id, child_script_id)
);

-- Script execution logs
CREATE TABLE execution_logs (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL,
    execution_time FLOAT,
    parameters JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN execution_logs.ip_address IS 'IPv4 or IPv6 address of executor (max 45 chars for IPv6)';

-- User favorites
CREATE TABLE user_favorites (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, script_id)
);

-- Comments
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat history table for AI conversations
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL,
    response TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE chat_history IS 'Stores chat conversations between users and AI';
COMMENT ON COLUMN chat_history.messages IS 'JSON array of chat messages with role and content';
COMMENT ON COLUMN chat_history.embedding IS 'Vector embedding of the response for semantic search';

-- Chat history indexes
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at);

-- Create indexes
CREATE INDEX idx_scripts_category ON scripts(category_id);
CREATE INDEX idx_scripts_user ON scripts(user_id);
CREATE INDEX idx_script_versions_script ON script_versions(script_id);
CREATE INDEX idx_script_analysis_script ON script_analysis(script_id);
CREATE INDEX idx_execution_logs_script ON execution_logs(script_id);
CREATE INDEX idx_execution_logs_user ON execution_logs(user_id);
CREATE INDEX idx_execution_logs_created_at ON execution_logs(created_at);

-- Create vector indexes for similarity search
CREATE INDEX script_embeddings_idx ON script_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX chat_history_embedding_idx ON chat_history USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_script_analysis_updated_at BEFORE UPDATE ON script_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_history_updated_at BEFORE UPDATE ON chat_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
