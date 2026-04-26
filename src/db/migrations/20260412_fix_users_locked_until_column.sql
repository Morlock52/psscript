DO $$
BEGIN
    IF to_regclass('public.users') IS NULL THEN
        RETURN;
    END IF;

    ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'lockout_until'
    ) THEN
        EXECUTE '
            UPDATE public.users
            SET locked_until = COALESCE(locked_until, lockout_until)
        ';
    END IF;

    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON public.users(locked_until)
    WHERE locked_until IS NOT NULL;
END $$;
