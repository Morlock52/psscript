-- Migration: add missing indexes on foreign-key columns
-- Date: 2026-04-26
-- Rationale: PostgreSQL does not automatically index referencing columns.

DO $$
BEGIN
  IF to_regclass('public.script_versions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_script_versions_user
      ON public.script_versions(user_id);
  END IF;

  IF to_regclass('public.hosted_artifacts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_hosted_artifacts_user
      ON public.hosted_artifacts(user_id);
  END IF;

  IF to_regclass('public.comments') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_comments_script
      ON public.comments(script_id);
    CREATE INDEX IF NOT EXISTS idx_comments_user
      ON public.comments(user_id);
  END IF;

  IF to_regclass('public.script_dependencies') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_script_dependencies_child
      ON public.script_dependencies(child_script_id);
  END IF;

  IF to_regclass('public.script_tags') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_script_tags_tag
      ON public.script_tags(tag_id);
  END IF;

  IF to_regclass('public.user_favorites') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_user_favorites_script
      ON public.user_favorites(script_id);
  END IF;
END $$;
