-- Script lifecycle, audit, and production data hygiene support.
-- Mirrors the hosted Netlify self-healing schema guard so Supabase remains explicit.

ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE public.script_analysis
  ADD COLUMN IF NOT EXISTS script_version INTEGER,
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS analysis_source TEXT NOT NULL DEFAULT 'ai';

CREATE TABLE IF NOT EXISTS public.audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  script_id BIGINT,
  script_title TEXT,
  user_id UUID,
  username TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_visible_updated
  ON public.scripts (user_id, is_public, deleted_at, archived_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_scripts_archive_state
  ON public.scripts (archived_at, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_scripts_test_data
  ON public.scripts (is_test_data, updated_at DESC)
  WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_script_analysis_version
  ON public.script_analysis (script_id, script_version);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON public.audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_script_id
  ON public.audit_events (script_id, created_at DESC)
  WHERE script_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id
  ON public.audit_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit events readable by enabled profile" ON public.audit_events;
CREATE POLICY "audit events readable by enabled profile"
  ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.current_app_profile_is_enabled())
    AND (
      user_id = auth.uid()
      OR (SELECT public.current_app_profile_is_admin())
    )
  );
