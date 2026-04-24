export function getEnv(name: string, fallback = ''): string {
  const netlifyEnv = (globalThis as any).Netlify?.env?.get(name);
  return netlifyEnv || process.env[name] || fallback;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
