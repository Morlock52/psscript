-- Migration: set explicit search_path on shared trigger functions.
-- Supabase warns on mutable function search paths because unqualified names can
-- resolve differently based on caller/session settings.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog;
