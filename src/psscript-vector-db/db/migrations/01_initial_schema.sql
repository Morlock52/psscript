-- Initial schema for PowerShell Script Vector Database

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  author VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  views INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  rating FLOAT NOT NULL DEFAULT 0,
  file_path VARCHAR(255),
  file_size INTEGER,
  file_hash VARCHAR(255),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  version VARCHAR(50),
  embedding vector(1536)
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create script_categories table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS script_categories (
  script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (script_id, category_id)
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create script_tags table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS script_tags (
  script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (script_id, tag_id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(255),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Create script_versions table
CREATE TABLE IF NOT EXISTS script_versions (
  id SERIAL PRIMARY KEY,
  script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  changes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Create script_comments table
CREATE TABLE IF NOT EXISTS script_comments (
  id SERIAL PRIMARY KEY,
  script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create script_ratings table
CREATE TABLE IF NOT EXISTS script_ratings (
  script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (script_id, user_id)
);

-- Create script_analysis table
CREATE TABLE IF NOT EXISTS script_analysis (
  id SERIAL PRIMARY KEY,
  script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) NOT NULL,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create web_pages table for crawled content
CREATE TABLE IF NOT EXISTS web_pages (
  id SERIAL PRIMARY KEY,
  url VARCHAR(2048) NOT NULL UNIQUE,
  title VARCHAR(255),
  content TEXT,
  crawled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  embedding vector(1536)
);

-- Create ms_learn_content table
CREATE TABLE IF NOT EXISTS ms_learn_content (
  id SERIAL PRIMARY KEY,
  url VARCHAR(2048) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  module_path VARCHAR(255),
  crawled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  embedding vector(1536)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scripts_title ON scripts(title);
CREATE INDEX IF NOT EXISTS idx_scripts_is_public ON scripts(is_public);
CREATE INDEX IF NOT EXISTS idx_scripts_is_verified ON scripts(is_verified);
CREATE INDEX IF NOT EXISTS idx_scripts_rating ON scripts(rating);
CREATE INDEX IF NOT EXISTS idx_scripts_downloads ON scripts(downloads);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_script_versions_script_id ON script_versions(script_id);
CREATE INDEX IF NOT EXISTS idx_script_comments_script_id ON script_comments(script_id);
CREATE INDEX IF NOT EXISTS idx_script_ratings_script_id ON script_ratings(script_id);
CREATE INDEX IF NOT EXISTS idx_script_analysis_script_id ON script_analysis(script_id);
CREATE INDEX IF NOT EXISTS idx_web_pages_url ON web_pages(url);
CREATE INDEX IF NOT EXISTS idx_ms_learn_content_url ON ms_learn_content(url);

-- Create vector indexes
CREATE INDEX IF NOT EXISTS idx_scripts_embedding ON scripts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_web_pages_embedding ON web_pages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_ms_learn_content_embedding ON ms_learn_content USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
  ('Administration', 'Scripts for system administration tasks'),
  ('Security', 'Scripts for security-related tasks'),
  ('Networking', 'Scripts for networking tasks'),
  ('File Management', 'Scripts for file management tasks'),
  ('User Management', 'Scripts for user management tasks'),
  ('Active Directory', 'Scripts for Active Directory tasks'),
  ('Azure', 'Scripts for Azure tasks'),
  ('AWS', 'Scripts for AWS tasks'),
  ('Database', 'Scripts for database tasks'),
  ('Automation', 'Scripts for automation tasks'),
  ('Monitoring', 'Scripts for monitoring tasks'),
  ('Reporting', 'Scripts for reporting tasks'),
  ('Utilities', 'Utility scripts'),
  ('Development', 'Scripts for development tasks'),
  ('Testing', 'Scripts for testing tasks')
ON CONFLICT (name) DO NOTHING;

-- Insert default tags
INSERT INTO tags (name) VALUES
  ('PowerShell'),
  ('Windows'),
  ('Linux'),
  ('macOS'),
  ('Azure'),
  ('AWS'),
  ('GCP'),
  ('Active Directory'),
  ('Exchange'),
  ('SharePoint'),
  ('SQL'),
  ('Security'),
  ('Automation'),
  ('Monitoring'),
  ('Reporting'),
  ('Backup'),
  ('Recovery'),
  ('Migration'),
  ('Deployment'),
  ('Configuration')
ON CONFLICT (name) DO NOTHING;
