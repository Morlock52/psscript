-- Enable RLS on maintenance tables exposed through the public schema.
-- No public policies are added for admin_db_backups; server-side admin
-- maintenance uses the hosted database connection rather than PostgREST.

DO $$
BEGIN
  IF to_regclass('public.admin_db_backups') IS NOT NULL THEN
    ALTER TABLE public.admin_db_backups ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.audit_events') IS NOT NULL THEN
    ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
