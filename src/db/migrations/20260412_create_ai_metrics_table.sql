DO $$
BEGIN
  IF to_regclass('public.ai_metrics') IS NULL THEN
    IF to_regclass('public.app_profiles') IS NOT NULL THEN
      CREATE TABLE public.ai_metrics (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID REFERENCES public.app_profiles(id) ON DELETE SET NULL,
          endpoint TEXT NOT NULL,
          model TEXT NOT NULL,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          total_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
          latency INTEGER NOT NULL DEFAULT 0,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          request_payload JSONB,
          response_payload JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    ELSIF to_regclass('public.users') IS NOT NULL THEN
      CREATE TABLE public.ai_metrics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
          endpoint VARCHAR(255) NOT NULL,
          model VARCHAR(255) NOT NULL,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
          latency INTEGER NOT NULL DEFAULT 0,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          request_payload JSONB,
          response_payload JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    END IF;
  END IF;

  IF to_regclass('public.ai_metrics') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id ON public.ai_metrics(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_endpoint ON public.ai_metrics(endpoint);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_model ON public.ai_metrics(model);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_created_at ON public.ai_metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_success ON public.ai_metrics(success);
  END IF;
END $$;
