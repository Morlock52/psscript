ALTER TABLE script_embeddings
  ADD COLUMN IF NOT EXISTS embedding_model TEXT;

CREATE INDEX IF NOT EXISTS idx_app_profiles_email ON app_profiles (email);
