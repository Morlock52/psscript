-- Migration: Hosted search, vector similarity, and RLS hardening
-- Date: 2026-04-27
-- Mirrors the hosted Supabase fix for local migration parity.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
SET search_path = public, extensions, pg_catalog;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      ALTER EXTENSION vector SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping vector extension schema move: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    BEGIN
      ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping pg_trgm extension schema move: %', SQLERRM;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.app_profiles') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_app_profiles_approved_by
      ON public.app_profiles(approved_by)
      WHERE approved_by IS NOT NULL;
  END IF;

  IF to_regclass('public.ai_metrics') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_created
      ON public.ai_metrics(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_global_created
      ON public.ai_metrics(created_at DESC)
      WHERE user_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_endpoint_created
      ON public.ai_metrics(endpoint, created_at DESC);
  END IF;

  IF to_regclass('public.scripts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_scripts_user_updated
      ON public.scripts(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scripts_public_updated
      ON public.scripts(updated_at DESC)
      WHERE is_public = true;
    CREATE INDEX IF NOT EXISTS idx_scripts_category_updated
      ON public.scripts(category_id, updated_at DESC)
      WHERE category_id IS NOT NULL;

    ALTER TABLE public.scripts
      ADD COLUMN IF NOT EXISTS search_vector tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title::text, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(description::text, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(content::text, '')), 'C')
      ) STORED;

    CREATE INDEX IF NOT EXISTS idx_scripts_search_vector
      ON public.scripts USING gin(search_vector);
    CREATE INDEX IF NOT EXISTS idx_scripts_title_trgm
      ON public.scripts USING gin(title gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_scripts_description_trgm
      ON public.scripts USING gin(description gin_trgm_ops);
  END IF;

  IF to_regclass('public.documentation_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_documentation_items_updated
      ON public.documentation_items(updated_at DESC);

    ALTER TABLE public.documentation_items
      ADD COLUMN IF NOT EXISTS search_vector tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title::text, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(source::text, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(content::text, '')), 'C')
      ) STORED;

    CREATE INDEX IF NOT EXISTS idx_documentation_items_search_vector
      ON public.documentation_items USING gin(search_vector);
    CREATE INDEX IF NOT EXISTS idx_documentation_items_title_trgm
      ON public.documentation_items USING gin(title gin_trgm_ops);
  END IF;

  IF to_regclass('public.script_embeddings') IS NOT NULL THEN
    ALTER TABLE public.script_embeddings
      ADD COLUMN IF NOT EXISTS embedding_model TEXT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'script_embeddings'
        AND column_name = 'model_version'
    ) THEN
      UPDATE public.script_embeddings
      SET embedding_model = COALESCE(embedding_model, model_version);
    END IF;

    UPDATE public.script_embeddings
    SET embedding_model = COALESCE(embedding_model, 'text-embedding-3-small');

    ALTER TABLE public.script_embeddings
      ALTER COLUMN embedding_model SET DEFAULT 'text-embedding-3-small',
      ALTER COLUMN embedding_model SET NOT NULL;

    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
      CREATE INDEX IF NOT EXISTS idx_script_embeddings_hnsw
        ON public.script_embeddings
        USING hnsw(embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  has_auth_uid boolean := to_regprocedure('auth.uid()') IS NOT NULL;
BEGIN
  IF has_auth_uid AND to_regclass('public.app_profiles') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.current_app_profile_is_enabled()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, auth, pg_catalog
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.app_profiles
          WHERE id = (SELECT auth.uid())
            AND is_enabled = true
        );
      $body$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.current_app_profile_is_admin()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, auth, pg_catalog
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.app_profiles
          WHERE id = (SELECT auth.uid())
            AND is_enabled = true
            AND role = 'admin'
        );
      $body$;
    $fn$;

    REVOKE ALL ON FUNCTION public.current_app_profile_is_enabled() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.current_app_profile_is_enabled() TO authenticated;
    REVOKE ALL ON FUNCTION public.current_app_profile_is_admin() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.current_app_profile_is_admin() TO authenticated;
  END IF;
END $$;

DO $$
DECLARE
  has_auth_uid boolean := to_regprocedure('auth.uid()') IS NOT NULL;
  has_profile_gate boolean := to_regprocedure('public.current_app_profile_is_enabled()') IS NOT NULL;
  has_admin_gate boolean := to_regprocedure('public.current_app_profile_is_admin()') IS NOT NULL;
BEGIN
  IF has_auth_uid AND has_profile_gate AND to_regclass('public.app_profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "profiles are readable by owner" ON public.app_profiles';
    EXECUTE 'CREATE POLICY "profiles are readable by owner" ON public.app_profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id)';

    EXECUTE 'DROP POLICY IF EXISTS "profiles are updatable by owner" ON public.app_profiles';
    EXECUTE 'CREATE POLICY "profiles are updatable by owner" ON public.app_profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id AND (SELECT public.current_app_profile_is_enabled())) WITH CHECK ((SELECT auth.uid()) = id AND (SELECT public.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.scripts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "scripts readable by owner or public" ON public.scripts';
    EXECUTE 'CREATE POLICY "scripts readable by owner or public" ON public.scripts FOR SELECT TO authenticated USING ((SELECT public.current_app_profile_is_enabled()) AND ((SELECT auth.uid()) = user_id OR is_public = true))';

    EXECUTE 'DROP POLICY IF EXISTS "scripts writable by owner" ON public.scripts';
    EXECUTE 'CREATE POLICY "scripts writable by owner" ON public.scripts FOR ALL TO authenticated USING ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id) WITH CHECK ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.script_versions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "script versions readable by script access" ON public.script_versions';
    EXECUTE $policy$
      CREATE POLICY "script versions readable by script access"
        ON public.script_versions
        FOR SELECT TO authenticated
        USING (
          (SELECT public.current_app_profile_is_enabled())
          AND EXISTS (
            SELECT 1
            FROM public.scripts
            WHERE scripts.id = script_versions.script_id
              AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
          )
        )
    $policy$;
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.script_analysis') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "analysis readable by script access" ON public.script_analysis';
    EXECUTE $policy$
      CREATE POLICY "analysis readable by script access"
        ON public.script_analysis
        FOR SELECT TO authenticated
        USING (
          (SELECT public.current_app_profile_is_enabled())
          AND EXISTS (
            SELECT 1
            FROM public.scripts
            WHERE scripts.id = script_analysis.script_id
              AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
          )
        )
    $policy$;
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.chat_history') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "chat history owned by user" ON public.chat_history';
    EXECUTE 'CREATE POLICY "chat history owned by user" ON public.chat_history FOR ALL TO authenticated USING ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id) WITH CHECK ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.script_tags') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "script tags readable by script access" ON public.script_tags';
    EXECUTE $policy$
      CREATE POLICY "script tags readable by script access"
        ON public.script_tags
        FOR SELECT TO authenticated
        USING (
          (SELECT public.current_app_profile_is_enabled())
          AND EXISTS (
            SELECT 1
            FROM public.scripts
            WHERE scripts.id = script_tags.script_id
              AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
          )
        )
    $policy$;
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.script_embeddings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "script embeddings readable by script access" ON public.script_embeddings';
    EXECUTE $policy$
      CREATE POLICY "script embeddings readable by script access"
        ON public.script_embeddings
        FOR SELECT TO authenticated
        USING (
          (SELECT public.current_app_profile_is_enabled())
          AND EXISTS (
            SELECT 1
            FROM public.scripts
            WHERE scripts.id = script_embeddings.script_id
              AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
          )
        )
    $policy$;
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.ai_metrics') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "ai metrics readable by owner" ON public.ai_metrics';
    EXECUTE 'CREATE POLICY "ai metrics readable by owner" ON public.ai_metrics FOR SELECT TO authenticated USING ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "ai metrics writable by owner" ON public.ai_metrics';
    EXECUTE 'CREATE POLICY "ai metrics writable by owner" ON public.ai_metrics FOR INSERT TO authenticated WITH CHECK ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.hosted_artifacts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "hosted artifacts owned by user" ON public.hosted_artifacts';
    EXECUTE 'CREATE POLICY "hosted artifacts owned by user" ON public.hosted_artifacts FOR ALL TO authenticated USING ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id) WITH CHECK ((SELECT public.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.categories') IS NOT NULL THEN
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "categories readable by everyone" ON public.categories';
    EXECUTE 'DROP POLICY IF EXISTS "categories readable by authenticated users" ON public.categories';
    EXECUTE 'CREATE POLICY "categories readable by authenticated users" ON public.categories FOR SELECT TO authenticated USING ((SELECT public.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.tags') IS NOT NULL THEN
    ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "tags readable by everyone" ON public.tags';
    EXECUTE 'DROP POLICY IF EXISTS "tags readable by authenticated users" ON public.tags';
    EXECUTE 'CREATE POLICY "tags readable by authenticated users" ON public.tags FOR SELECT TO authenticated USING ((SELECT public.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.documentation_items') IS NOT NULL THEN
    ALTER TABLE public.documentation_items ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "documentation readable by everyone" ON public.documentation_items';
    EXECUTE 'DROP POLICY IF EXISTS "documentation readable by authenticated users" ON public.documentation_items';
    EXECUTE 'CREATE POLICY "documentation readable by authenticated users" ON public.documentation_items FOR SELECT TO authenticated USING ((SELECT public.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_admin_gate AND to_regclass('public.schema_migrations') IS NOT NULL THEN
    ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
    COMMENT ON TABLE public.schema_migrations IS 'Server-owned migration ledger. Direct client reads are limited to enabled admins.';
    EXECUTE 'DROP POLICY IF EXISTS "schema migrations readable by admin" ON public.schema_migrations';
    EXECUTE 'CREATE POLICY "schema migrations readable by admin" ON public.schema_migrations FOR SELECT TO authenticated USING ((SELECT public.current_app_profile_is_admin()))';
  END IF;

  IF has_auth_uid AND has_admin_gate AND to_regclass('public.script_file_hash_duplicate_audit') IS NOT NULL THEN
    ALTER TABLE public.script_file_hash_duplicate_audit ENABLE ROW LEVEL SECURITY;
    COMMENT ON TABLE public.script_file_hash_duplicate_audit IS 'Server-owned duplicate-remediation audit table. Direct client reads are limited to enabled admins.';
    EXECUTE 'DROP POLICY IF EXISTS "duplicate audit readable by admin" ON public.script_file_hash_duplicate_audit';
    EXECUTE 'CREATE POLICY "duplicate audit readable by admin" ON public.script_file_hash_duplicate_audit FOR SELECT TO authenticated USING ((SELECT public.current_app_profile_is_admin()))';
  END IF;
END $$;
