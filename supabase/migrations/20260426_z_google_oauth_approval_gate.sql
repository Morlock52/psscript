-- Migration: Google OAuth approval gate for hosted Supabase auth
-- Date: 2026-04-26
-- Adds local profile enablement metadata and tightens direct table access so
-- disabled OAuth users cannot bypass the Netlify API.

ALTER TABLE public.app_profiles
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.app_profiles(id) ON DELETE SET NULL;

UPDATE public.app_profiles
SET is_enabled = true
WHERE is_enabled IS NULL;

UPDATE public.app_profiles
SET auth_provider = 'password'
WHERE auth_provider IS NULL OR auth_provider = '';

UPDATE public.app_profiles
SET approved_at = COALESCE(approved_at, created_at)
WHERE is_enabled = true;

ALTER TABLE public.app_profiles
  ALTER COLUMN is_enabled SET DEFAULT false,
  ALTER COLUMN is_enabled SET NOT NULL,
  ALTER COLUMN auth_provider SET DEFAULT 'password',
  ALTER COLUMN auth_provider SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_profiles_auth_provider_check'
      AND conrelid = 'public.app_profiles'::regclass
  ) THEN
    ALTER TABLE public.app_profiles
      ADD CONSTRAINT app_profiles_auth_provider_check
      CHECK (auth_provider IN ('password', 'google'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_profiles_enabled_role
  ON public.app_profiles(role, is_enabled);

CREATE INDEX IF NOT EXISTS idx_app_profiles_auth_provider
  ON public.app_profiles(auth_provider);

CREATE OR REPLACE FUNCTION public.current_app_profile_is_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_profiles
    WHERE id = (SELECT auth.uid())
      AND is_enabled = true
  );
$$;

REVOKE ALL ON FUNCTION public.current_app_profile_is_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_profile_is_enabled() TO authenticated;

DROP POLICY IF EXISTS "profiles are readable by owner" ON public.app_profiles;
CREATE POLICY "profiles are readable by owner" ON public.app_profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles are updatable by owner" ON public.app_profiles;
CREATE POLICY "profiles are updatable by owner" ON public.app_profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id AND public.current_app_profile_is_enabled())
  WITH CHECK ((SELECT auth.uid()) = id AND public.current_app_profile_is_enabled());

DROP POLICY IF EXISTS "scripts readable by owner or public" ON public.scripts;
CREATE POLICY "scripts readable by owner or public" ON public.scripts
  FOR SELECT USING (
    public.current_app_profile_is_enabled()
    AND ((SELECT auth.uid()) = user_id OR is_public = true)
  );

DROP POLICY IF EXISTS "scripts writable by owner" ON public.scripts;
CREATE POLICY "scripts writable by owner" ON public.scripts
  FOR ALL
  USING (public.current_app_profile_is_enabled() AND (SELECT auth.uid()) = user_id)
  WITH CHECK (public.current_app_profile_is_enabled() AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "script versions readable by script access" ON public.script_versions;
CREATE POLICY "script versions readable by script access" ON public.script_versions
  FOR SELECT USING (
    public.current_app_profile_is_enabled()
    AND EXISTS (
      SELECT 1 FROM public.scripts
      WHERE scripts.id = script_versions.script_id
        AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
    )
  );

DROP POLICY IF EXISTS "analysis readable by script access" ON public.script_analysis;
CREATE POLICY "analysis readable by script access" ON public.script_analysis
  FOR SELECT USING (
    public.current_app_profile_is_enabled()
    AND EXISTS (
      SELECT 1 FROM public.scripts
      WHERE scripts.id = script_analysis.script_id
        AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
    )
  );

DROP POLICY IF EXISTS "chat history owned by user" ON public.chat_history;
CREATE POLICY "chat history owned by user" ON public.chat_history
  FOR ALL
  USING (public.current_app_profile_is_enabled() AND (SELECT auth.uid()) = user_id)
  WITH CHECK (public.current_app_profile_is_enabled() AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "script tags readable by script access" ON public.script_tags;
CREATE POLICY "script tags readable by script access" ON public.script_tags
  FOR SELECT USING (
    public.current_app_profile_is_enabled()
    AND EXISTS (
      SELECT 1
      FROM public.scripts
      WHERE scripts.id = script_tags.script_id
        AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
    )
  );

DROP POLICY IF EXISTS "script embeddings readable by script access" ON public.script_embeddings;
CREATE POLICY "script embeddings readable by script access" ON public.script_embeddings
  FOR SELECT USING (
    public.current_app_profile_is_enabled()
    AND EXISTS (
      SELECT 1
      FROM public.scripts
      WHERE scripts.id = script_embeddings.script_id
        AND (scripts.user_id = (SELECT auth.uid()) OR scripts.is_public = true)
    )
  );

DROP POLICY IF EXISTS "ai metrics readable by owner" ON public.ai_metrics;
CREATE POLICY "ai metrics readable by owner" ON public.ai_metrics
  FOR SELECT USING (
    public.current_app_profile_is_enabled()
    AND (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "ai metrics writable by owner" ON public.ai_metrics;
CREATE POLICY "ai metrics writable by owner" ON public.ai_metrics
  FOR INSERT WITH CHECK (
    public.current_app_profile_is_enabled()
    AND (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "hosted artifacts owned by user" ON public.hosted_artifacts;
CREATE POLICY "hosted artifacts owned by user" ON public.hosted_artifacts
  FOR ALL
  USING (public.current_app_profile_is_enabled() AND (SELECT auth.uid()) = user_id)
  WITH CHECK (public.current_app_profile_is_enabled() AND (SELECT auth.uid()) = user_id);
