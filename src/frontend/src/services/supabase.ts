import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function isRemoteHostedApp(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

export function isAuthDisabledForCurrentHost(): boolean {
  if (import.meta.env.MODE === 'test' || import.meta.env.VITE_DISABLE_AUTH !== 'true') {
    return false;
  }

  return !isRemoteHostedApp();
}

export function isHostedAuthConfigurationMissing(): boolean {
  return isRemoteHostedApp() && !isSupabaseAuthEnabled();
}

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseAuthEnabled()) {
    throw new Error('Supabase auth is not configured');
  }

  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }

  return client;
}

export function isHostedStaticAnalysisOnly(): boolean {
  return import.meta.env.VITE_HOSTED_STATIC_ANALYSIS_ONLY === 'true';
}
