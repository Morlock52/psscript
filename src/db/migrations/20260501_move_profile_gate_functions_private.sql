-- Move SECURITY DEFINER profile-gate helpers out of the exposed public schema.
-- The functions are used by RLS policies, but should not be callable through
-- PostgREST RPC as public.current_app_profile_is_*.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NOT NULL
     AND to_regclass('public.app_profiles') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION private.current_app_profile_is_enabled()
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
      CREATE OR REPLACE FUNCTION private.current_app_profile_is_admin()
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

    REVOKE ALL ON FUNCTION private.current_app_profile_is_enabled() FROM PUBLIC;
    REVOKE ALL ON FUNCTION private.current_app_profile_is_enabled() FROM anon;
    GRANT EXECUTE ON FUNCTION private.current_app_profile_is_enabled() TO authenticated;

    REVOKE ALL ON FUNCTION private.current_app_profile_is_admin() FROM PUBLIC;
    REVOKE ALL ON FUNCTION private.current_app_profile_is_admin() FROM anon;
    GRANT EXECUTE ON FUNCTION private.current_app_profile_is_admin() TO authenticated;
  END IF;
END $$;

DO $$
DECLARE
  has_auth_uid boolean := to_regprocedure('auth.uid()') IS NOT NULL;
  has_profile_gate boolean := to_regprocedure('private.current_app_profile_is_enabled()') IS NOT NULL;
  has_admin_gate boolean := to_regprocedure('private.current_app_profile_is_admin()') IS NOT NULL;
BEGIN
  IF has_auth_uid AND has_profile_gate AND to_regclass('public.app_profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "profiles are readable by owner" ON public.app_profiles';
    EXECUTE 'CREATE POLICY "profiles are readable by owner" ON public.app_profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id)';

    EXECUTE 'DROP POLICY IF EXISTS "profiles are updatable by owner" ON public.app_profiles';
    EXECUTE 'CREATE POLICY "profiles are updatable by owner" ON public.app_profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id AND (SELECT private.current_app_profile_is_enabled())) WITH CHECK ((SELECT auth.uid()) = id AND (SELECT private.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.scripts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "scripts readable by owner or public" ON public.scripts';
    EXECUTE 'CREATE POLICY "scripts readable by owner or public" ON public.scripts FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_enabled()) AND ((SELECT auth.uid()) = user_id OR is_public = true))';

    EXECUTE 'DROP POLICY IF EXISTS "scripts writable by owner" ON public.scripts';
    EXECUTE 'CREATE POLICY "scripts writable by owner" ON public.scripts FOR ALL TO authenticated USING ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id) WITH CHECK ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.script_versions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "script versions readable by script access" ON public.script_versions';
    EXECUTE $policy$
      CREATE POLICY "script versions readable by script access"
        ON public.script_versions
        FOR SELECT TO authenticated
        USING (
          (SELECT private.current_app_profile_is_enabled())
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
          (SELECT private.current_app_profile_is_enabled())
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
    EXECUTE 'CREATE POLICY "chat history owned by user" ON public.chat_history FOR ALL TO authenticated USING ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id) WITH CHECK ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.script_tags') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "script tags readable by script access" ON public.script_tags';
    EXECUTE $policy$
      CREATE POLICY "script tags readable by script access"
        ON public.script_tags
        FOR SELECT TO authenticated
        USING (
          (SELECT private.current_app_profile_is_enabled())
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
          (SELECT private.current_app_profile_is_enabled())
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
    EXECUTE 'CREATE POLICY "ai metrics readable by owner" ON public.ai_metrics FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "ai metrics writable by owner" ON public.ai_metrics';
    EXECUTE 'CREATE POLICY "ai metrics writable by owner" ON public.ai_metrics FOR INSERT TO authenticated WITH CHECK ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.hosted_artifacts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "hosted artifacts owned by user" ON public.hosted_artifacts';
    EXECUTE 'CREATE POLICY "hosted artifacts owned by user" ON public.hosted_artifacts FOR ALL TO authenticated USING ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id) WITH CHECK ((SELECT private.current_app_profile_is_enabled()) AND (SELECT auth.uid()) = user_id)';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "categories readable by everyone" ON public.categories';
    EXECUTE 'DROP POLICY IF EXISTS "categories readable by authenticated users" ON public.categories';
    EXECUTE 'CREATE POLICY "categories readable by authenticated users" ON public.categories FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.tags') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "tags readable by everyone" ON public.tags';
    EXECUTE 'DROP POLICY IF EXISTS "tags readable by authenticated users" ON public.tags';
    EXECUTE 'CREATE POLICY "tags readable by authenticated users" ON public.tags FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_profile_gate AND to_regclass('public.documentation_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "documentation readable by everyone" ON public.documentation_items';
    EXECUTE 'DROP POLICY IF EXISTS "documentation readable by authenticated users" ON public.documentation_items';
    EXECUTE 'CREATE POLICY "documentation readable by authenticated users" ON public.documentation_items FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_enabled()))';
  END IF;

  IF has_auth_uid AND has_admin_gate AND to_regclass('public.schema_migrations') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "schema migrations readable by admin" ON public.schema_migrations';
    EXECUTE 'CREATE POLICY "schema migrations readable by admin" ON public.schema_migrations FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_admin()))';
  END IF;

  IF has_auth_uid AND has_admin_gate AND to_regclass('public.script_file_hash_duplicate_audit') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "duplicate audit readable by admin" ON public.script_file_hash_duplicate_audit';
    EXECUTE 'CREATE POLICY "duplicate audit readable by admin" ON public.script_file_hash_duplicate_audit FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_admin()))';
  END IF;

  IF has_auth_uid AND has_profile_gate AND has_admin_gate AND to_regclass('public.audit_events') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit events readable by enabled profile" ON public.audit_events';
    EXECUTE 'CREATE POLICY "audit events readable by enabled profile" ON public.audit_events FOR SELECT TO authenticated USING ((SELECT private.current_app_profile_is_enabled()) AND (user_id = (SELECT auth.uid()) OR (SELECT private.current_app_profile_is_admin())))';
  END IF;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.current_app_profile_is_enabled() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.current_app_profile_is_enabled() FROM anon;
  REVOKE ALL ON FUNCTION public.current_app_profile_is_enabled() FROM authenticated;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.current_app_profile_is_admin() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.current_app_profile_is_admin() FROM anon;
  REVOKE ALL ON FUNCTION public.current_app_profile_is_admin() FROM authenticated;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;
