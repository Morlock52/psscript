-- Migration: 04_create_chat_history_table.sql
-- Description: Creates the chat_history table for storing chat conversations
-- with vector support for semantic search

-- Enable pgvector extension if not already enabled
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
SET search_path = public, extensions;
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET search_path = public, extensions', current_database());
END $$;

-- Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL,
    response TEXT NOT NULL,
    embedding vector(1536) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);

-- Add vector index for embedding search
-- This will enable fast similarity search
DROP INDEX IF EXISTS chat_history_embedding_idx;
CREATE INDEX chat_history_embedding_idx ON chat_history USING hnsw (embedding vector_cosine_ops);

-- Comment on table and columns
COMMENT ON TABLE chat_history IS 'Stores chat conversations between users and AI';
COMMENT ON COLUMN chat_history.user_id IS 'Reference to the user who initiated the chat';
COMMENT ON COLUMN chat_history.messages IS 'JSON array of chat messages with role and content';
COMMENT ON COLUMN chat_history.response IS 'The AI response text';
COMMENT ON COLUMN chat_history.embedding IS 'Vector embedding of the response for semantic search';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_chat_history_updated_at ON chat_history;
DROP TRIGGER IF EXISTS trigger_update_chat_history_updated_at ON chat_history;
CREATE TRIGGER update_chat_history_updated_at
    BEFORE UPDATE ON chat_history
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_history_updated_at();
