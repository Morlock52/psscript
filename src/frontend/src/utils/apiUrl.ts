/**
 * Centralized Runtime API URL Detection
 *
 * This module provides runtime URL detection that works correctly in production
 * when accessed via tunnels/proxies like Cloudflare Tunnel.
 *
 * IMPORTANT: These functions must be called at RUNTIME (inside React components
 * or event handlers), NOT at module load time during Vite build.
 *
 * References:
 * - https://vite.dev/guide/env-and-mode
 * - https://medium.com/quadcode-life/vite-nginx-and-environment-variables-for-a-static-website-at-runtime-f3d0b2995fc7
 */

// Cache the computed URLs to avoid repeated computation
let _cachedApiUrl: string | null = null;
let _cachedAiServiceUrl: string | null = null;

/**
 * Get the backend API URL at runtime
 *
 * Logic:
 * - If VITE_API_URL env var is set, use it
 * - If running on localhost, use localhost:4000
 * - If running on remote (tunnel/proxy), use same hostname without port (tunnel routes /api)
 */
export function getApiUrl(): string {
  // Return cached value if available
  if (_cachedApiUrl !== null) {
    return _cachedApiUrl;
  }

  const hasWindow = typeof window !== 'undefined';
  const pageProtocol = hasWindow && window.location.protocol === 'https:' ? 'https' : 'http';

  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    const configuredRaw = String(import.meta.env.VITE_API_URL).trim();

    // If the URL is configured, normalize it for common local-dev setups so the browser can reach it.
    //
    // 1) Mixed-content guard: https UI + http API => blocked by browser, often surfaces as Axios "Network Error".
    // 2) Docker-service hostname guard: VITE_API_URL=http://backend:4000/api works *inside containers*,
    //    but the browser cannot resolve "backend" and will fail with "Network Error".
    //
    // We only apply these rewrites when running in a browser context.
    let normalized = configuredRaw;
    if (hasWindow) {
      try {
        const url = new URL(configuredRaw);
        const pageHost = window.location.hostname;
        const pageIsLocalhost = pageHost === 'localhost' || pageHost === '127.0.0.1';

        // Rewrite container-only hostname to browser-reachable localhost/127.0.0.1.
        if (pageIsLocalhost && url.hostname === 'backend' && url.port === '4000') {
          url.hostname = pageHost;
          url.protocol = window.location.protocol;
          normalized = url.toString();
        }

        // Upgrade localhost API to https when the page is https to avoid mixed-content blocks.
        if (pageProtocol === 'https' && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.port === '4000') {
          url.protocol = 'https:';
          normalized = url.toString();
        }
      } catch {
        // If it's not a valid absolute URL, leave it unchanged.
      }
    }

    _cachedApiUrl = normalized.replace(/\/+$/, '');
    console.log('[apiUrl] Using VITE_API_URL:', _cachedApiUrl);
    return _cachedApiUrl;
  }

  // Must be in browser to detect hostname
  if (typeof window === 'undefined') {
    console.log('[apiUrl] SSR context, using localhost fallback');
    return 'http://localhost:4000/api';
  }

  // Runtime detection in browser
  const protocol = pageProtocol;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // When accessed via tunnel/proxy (non-localhost), don't include port
  // The tunnel/proxy routes /api to the backend
  // When local, prefer same-origin `/api` so Vite can proxy to the backend even if the
  // backend's TLS cert isn't trusted by the browser (ERR_CERT_AUTHORITY_INVALID).
  //
  // IMPORTANT: In local dev, frontend often runs on https://localhost:3090 with mTLS,
  // and backend runs on https://localhost:4000 (TLS enabled). We must keep protocol
  // aligned to avoid mixed-content/CORS/auth failures.
  _cachedApiUrl = isLocalhost
    ? `${window.location.origin}/api`
    : `${protocol}://${hostname}/api`;

  console.log('[apiUrl] Runtime API URL:', _cachedApiUrl, '(hostname:', hostname, ', isLocalhost:', isLocalhost, ')');
  return _cachedApiUrl;
}

/**
 * Get the AI service URL at runtime
 *
 * Logic:
 * - If VITE_AI_SERVICE_URL env var is set, use it
 * - If running on localhost, use localhost:8000
 * - If running on remote (tunnel/proxy), use same hostname without port
 */
export function getAiServiceUrl(): string {
  // Return cached value if available
  if (_cachedAiServiceUrl !== null) {
    return _cachedAiServiceUrl;
  }

  // Check for environment variable first
  if (import.meta.env.VITE_AI_SERVICE_URL) {
    _cachedAiServiceUrl = import.meta.env.VITE_AI_SERVICE_URL;
    console.log('[apiUrl] Using VITE_AI_SERVICE_URL:', _cachedAiServiceUrl);
    return _cachedAiServiceUrl;
  }

  // Must be in browser to detect hostname
  if (typeof window === 'undefined') {
    console.log('[apiUrl] SSR context, using localhost AI service fallback');
    return 'http://localhost:8000';
  }

  // Runtime detection in browser
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // When accessed via tunnel/proxy, use /ai path (tunnel routes it)
  // When local, use port 8000
  _cachedAiServiceUrl = isLocalhost
    ? `${protocol}://${hostname}:8000`
    : `${protocol}://${hostname}/ai`;

  console.log('[apiUrl] Runtime AI Service URL:', _cachedAiServiceUrl, '(hostname:', hostname, ')');
  return _cachedAiServiceUrl;
}

/**
 * Get the Assistants API URL at runtime (port 4001 locally)
 */
export function getAssistantsApiUrl(): string {
  // Must be in browser to detect hostname
  if (typeof window === 'undefined') {
    return 'http://localhost:4001/api';
  }

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // When accessed via tunnel/proxy, use /assistants-api path
  // When local, use port 4001
  return isLocalhost
    ? `${protocol}://${hostname}:4001/api`
    : `${protocol}://${hostname}/assistants-api`;
}

/**
 * Clear the cached URLs (useful for testing or if hostname changes)
 */
export function clearUrlCache(): void {
  _cachedApiUrl = null;
  _cachedAiServiceUrl = null;
}

/**
 * Check if we're running on localhost
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') {
    return true; // Assume localhost during SSR
  }
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Get the current protocol (http or https)
 */
export function getProtocol(): 'http' | 'https' {
  if (typeof window === 'undefined') {
    return 'http';
  }
  return window.location.protocol === 'https:' ? 'https' : 'http';
}
