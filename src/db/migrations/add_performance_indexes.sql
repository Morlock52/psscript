-- Migration: Add performance indexes and remove duplicate indexes flagged by
-- Supabase/Postgres advisors.

-- Unique constraints already provide indexes for these lookups.
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email_password;
DROP INDEX IF EXISTS idx_script_analysis_script;
DROP INDEX IF EXISTS idx_script_analysis_script_id;
DROP INDEX IF EXISTS idx_documentation_url;

DO $$
BEGIN
  -- Indexes for common filters and security/account monitoring.
  IF to_regclass('public.users') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON public.users(locked_until)
      WHERE locked_until IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_login_attempts ON public.users(login_attempts)
      WHERE login_attempts > 0;
    CREATE INDEX IF NOT EXISTS idx_users_last_login ON public.users(last_login_at)
      WHERE last_login_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
    EXECUTE 'ANALYZE public.users';
  END IF;

  -- Foreign key and common relationship indexes.
  IF to_regclass('public.scripts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_scripts_category ON public.scripts(category_id);
    CREATE INDEX IF NOT EXISTS idx_scripts_user ON public.scripts(user_id);
    CREATE INDEX IF NOT EXISTS idx_scripts_visibility ON public.scripts(is_public, user_id);
    EXECUTE 'ANALYZE public.scripts';
  END IF;

  IF to_regclass('public.script_versions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_script_versions_script ON public.script_versions(script_id);
    CREATE INDEX IF NOT EXISTS idx_script_versions_user ON public.script_versions(user_id);
    EXECUTE 'ANALYZE public.script_versions';
  END IF;

  IF to_regclass('public.hosted_artifacts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_hosted_artifacts_user ON public.hosted_artifacts(user_id);
  END IF;

  IF to_regclass('public.script_tags') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON public.script_tags(tag_id);
  END IF;

  IF to_regclass('public.comments') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_comments_script ON public.comments(script_id);
    CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
    EXECUTE 'ANALYZE public.comments';
  END IF;

  IF to_regclass('public.execution_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_execution_logs_script ON public.execution_logs(script_id);
    CREATE INDEX IF NOT EXISTS idx_execution_logs_user ON public.execution_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON public.execution_logs(created_at);
  END IF;

  IF to_regclass('public.ai_metrics') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id ON public.ai_metrics(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_endpoint ON public.ai_metrics(endpoint);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_model ON public.ai_metrics(model);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_created_at ON public.ai_metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_success ON public.ai_metrics(success);
  END IF;
END $$;
