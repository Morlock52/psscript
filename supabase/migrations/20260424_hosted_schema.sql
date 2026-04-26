CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS app_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  company TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scripts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_public BOOLEAN NOT NULL DEFAULT false,
  execution_count INTEGER NOT NULL DEFAULT 0,
  average_execution_time DOUBLE PRECISION,
  last_executed_at TIMESTAMPTZ,
  file_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS script_versions (
  id BIGSERIAL PRIMARY KEY,
  script_id BIGINT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  user_id UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
  commit_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(script_id, version)
);

CREATE TABLE IF NOT EXISTS script_tags (
  script_id BIGINT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (script_id, tag_id)
);

CREATE TABLE IF NOT EXISTS script_analysis (
  id BIGSERIAL PRIMARY KEY,
  script_id BIGINT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE UNIQUE,
  purpose TEXT,
  security_score DOUBLE PRECISION,
  quality_score DOUBLE PRECISION,
  risk_score DOUBLE PRECISION,
  parameter_docs JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  command_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  ms_docs_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  security_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  best_practice_violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  performance_insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  potential_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  code_complexity_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  compatibility_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis_version TEXT NOT NULL DEFAULT 'hosted-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS script_embeddings (
  id BIGSERIAL PRIMARY KEY,
  script_id BIGINT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE UNIQUE,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  messages JSONB NOT NULL,
  response TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documentation_items (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  content TEXT NOT NULL,
  source TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hosted_artifacts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_profiles_role ON app_profiles(role);
CREATE INDEX IF NOT EXISTS idx_scripts_user ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category_id);
CREATE INDEX IF NOT EXISTS idx_scripts_file_hash ON scripts(file_hash);
CREATE INDEX IF NOT EXISTS idx_script_analysis_script ON script_analysis(script_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id ON ai_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_created_at ON ai_metrics(created_at);
CREATE INDEX IF NOT EXISTS script_embeddings_idx ON script_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS chat_history_embedding_idx ON chat_history USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS documentation_items_embedding_idx ON documentation_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_profiles_updated_at ON app_profiles;
CREATE TRIGGER update_app_profiles_updated_at BEFORE UPDATE ON app_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scripts_updated_at ON scripts;
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_script_analysis_updated_at ON script_analysis;
CREATE TRIGGER update_script_analysis_updated_at BEFORE UPDATE ON script_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosted_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles are readable by owner" ON app_profiles;
CREATE POLICY "profiles are readable by owner" ON app_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles are updatable by owner" ON app_profiles;
CREATE POLICY "profiles are updatable by owner" ON app_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "scripts readable by owner or public" ON scripts;
CREATE POLICY "scripts readable by owner or public" ON scripts
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "scripts writable by owner" ON scripts;
CREATE POLICY "scripts writable by owner" ON scripts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "script versions readable by script access" ON script_versions;
CREATE POLICY "script versions readable by script access" ON script_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scripts
      WHERE scripts.id = script_versions.script_id
        AND (scripts.user_id = auth.uid() OR scripts.is_public = true)
    )
  );

DROP POLICY IF EXISTS "analysis readable by script access" ON script_analysis;
CREATE POLICY "analysis readable by script access" ON script_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scripts
      WHERE scripts.id = script_analysis.script_id
        AND (scripts.user_id = auth.uid() OR scripts.is_public = true)
    )
  );

DROP POLICY IF EXISTS "chat history owned by user" ON chat_history;
CREATE POLICY "chat history owned by user" ON chat_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO categories (name, description)
VALUES
  ('Administration', 'Administrative PowerShell scripts'),
  ('Security', 'Security review and hardening scripts'),
  ('Automation', 'Automation and workflow scripts')
ON CONFLICT (name) DO NOTHING;
