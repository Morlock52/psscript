CREATE TABLE IF NOT EXISTS public.provider_api_keys (
  provider TEXT PRIMARY KEY,
  encrypted_api_key TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  updated_by UUID REFERENCES public.app_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_api_keys FROM anon, authenticated;

