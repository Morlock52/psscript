-- Keep hosted admin database backups service-role only.
-- The Netlify admin maintenance API uses the server-side Postgres connection;
-- browser clients should not receive direct table privileges for this payload.

DO $$
BEGIN
  IF to_regclass('public.admin_db_backups') IS NOT NULL THEN
    ALTER TABLE public.admin_db_backups ENABLE ROW LEVEL SECURITY;
    IF to_regrole('anon') IS NOT NULL THEN
      REVOKE ALL ON TABLE public.admin_db_backups FROM anon;
    END IF;
    IF to_regrole('authenticated') IS NOT NULL THEN
      REVOKE ALL ON TABLE public.admin_db_backups FROM authenticated;
    END IF;
  END IF;
END $$;
