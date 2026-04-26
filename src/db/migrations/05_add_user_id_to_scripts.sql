-- Migration: 05_add_user_id_to_scripts.sql
-- Description: Adds user_id column to scripts table (safe for existing data)

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    -- Local legacy schema: integer users table.
    ALTER TABLE public.scripts
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE;

    UPDATE public.scripts SET user_id = (SELECT id FROM public.users ORDER BY id LIMIT 1)
    WHERE user_id IS NULL;

    IF NOT EXISTS (SELECT 1 FROM public.scripts WHERE user_id IS NULL) THEN
      ALTER TABLE public.scripts ALTER COLUMN user_id SET NOT NULL;
    END IF;
  ELSIF to_regclass('public.app_profiles') IS NOT NULL THEN
    -- Supabase schema: UUID app_profiles table.
    ALTER TABLE public.scripts
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.app_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
