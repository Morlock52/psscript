-- Migration: Supabase advisor fixes for hosted Postgres
-- Date: 2026-04-26
-- Applies non-destructive indexes, extension placement, RLS hardening, and
-- function search_path fixes for the Supabase schema.

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      ALTER EXTENSION vector SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping vector extension schema move: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    BEGIN
      ALTER EXTENSION pgcrypto SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping pgcrypto extension schema move: %', SQLERRM;
    END;
  END IF;

  BEGIN
    EXECUTE format('ALTER DATABASE %I SET search_path = public, extensions', current_database());
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping database search_path update: %', SQLERRM;
  END;
END $$;

DO $$
BEGIN
  IF to_regclass('public.script_versions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_script_versions_user ON public.script_versions(user_id);
  END IF;

  IF to_regclass('public.hosted_artifacts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_hosted_artifacts_user ON public.hosted_artifacts(user_id);
  END IF;

  IF to_regclass('public.script_tags') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON public.script_tags(tag_id);
  END IF;

  IF to_regclass('public.script_analysis_script_id_key') IS NOT NULL
     AND to_regclass('public.idx_script_analysis_script') IS NOT NULL THEN
    DROP INDEX public.idx_script_analysis_script;
  END IF;

  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    ALTER FUNCTION public.update_updated_at_column()
      SET search_path = public, extensions, pg_catalog;
  END IF;

  IF to_regprocedure('public.update_chat_history_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_chat_history_updated_at()
      SET search_path = public, extensions, pg_catalog;
  END IF;
END $$;

DO $$
DECLARE
  has_auth_uid boolean := to_regprocedure('auth.uid()') IS NOT NULL;
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'categories'
        AND policyname = 'categories readable by everyone'
    ) THEN
      CREATE POLICY "categories readable by everyone"
        ON public.categories FOR SELECT USING (true);
    END IF;
  END IF;

  IF to_regclass('public.tags') IS NOT NULL THEN
    ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'tags'
        AND policyname = 'tags readable by everyone'
    ) THEN
      CREATE POLICY "tags readable by everyone"
        ON public.tags FOR SELECT USING (true);
    END IF;
  END IF;

  IF to_regclass('public.documentation_items') IS NOT NULL THEN
    ALTER TABLE public.documentation_items ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'documentation_items'
        AND policyname = 'documentation readable by everyone'
    ) THEN
      CREATE POLICY "documentation readable by everyone"
        ON public.documentation_items FOR SELECT USING (true);
    END IF;
  END IF;

  IF has_auth_uid AND to_regclass('public.script_tags') IS NOT NULL THEN
    ALTER TABLE public.script_tags ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'script_tags'
        AND policyname = 'script tags readable by script access'
    ) THEN
      CREATE POLICY "script tags readable by script access"
        ON public.script_tags FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM public.scripts
            WHERE scripts.id = script_tags.script_id
              AND (scripts.user_id = auth.uid() OR scripts.is_public = true)
          )
        );
    END IF;
  END IF;

  IF has_auth_uid AND to_regclass('public.script_embeddings') IS NOT NULL THEN
    ALTER TABLE public.script_embeddings ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'script_embeddings'
        AND policyname = 'script embeddings readable by script access'
    ) THEN
      CREATE POLICY "script embeddings readable by script access"
        ON public.script_embeddings FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM public.scripts
            WHERE scripts.id = script_embeddings.script_id
              AND (scripts.user_id = auth.uid() OR scripts.is_public = true)
          )
        );
    END IF;
  END IF;

  IF has_auth_uid AND to_regclass('public.ai_metrics') IS NOT NULL THEN
    ALTER TABLE public.ai_metrics ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'ai_metrics'
        AND policyname = 'ai metrics readable by owner'
    ) THEN
      CREATE POLICY "ai metrics readable by owner"
        ON public.ai_metrics FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'ai_metrics'
        AND policyname = 'ai metrics writable by owner'
    ) THEN
      CREATE POLICY "ai metrics writable by owner"
        ON public.ai_metrics FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF has_auth_uid AND to_regclass('public.hosted_artifacts') IS NOT NULL THEN
    ALTER TABLE public.hosted_artifacts ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'hosted_artifacts'
        AND policyname = 'hosted artifacts owned by user'
    ) THEN
      CREATE POLICY "hosted artifacts owned by user"
        ON public.hosted_artifacts FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.script_file_hash_duplicate_audit') IS NOT NULL THEN
    ALTER TABLE public.script_file_hash_duplicate_audit ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
