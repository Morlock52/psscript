/**
 * Centralized Runtime API URL Detection
 *
 * This module provides runtime URL detection that works correctly in production
 * when accessed via tunnels/proxies like Cloudflare Tunnel.
 *
 * IMPORTANT: These functions must be called at RUNTIME (inside React components
 * or event handlers), NOT at module load time during Vite build.
 */

let _cachedApiUrl: string | null = null;
let _cachedAiServiceUrl: string | null = null;

export function getApiUrl(): string {
  if (_cachedApiUrl !== null) {
    return _cachedApiUrl;
  }

  // If explicitly configured, use that (e.g. for testing against a remote backend)
  if (import.meta.env.VITE_API_URL) {
    _cachedApiUrl = String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '');
    console.log('[apiUrl] Using VITE_API_URL:', _cachedApiUrl);
    return _cachedApiUrl;
  }

  if (typeof window === 'undefined') {
    console.log('[apiUrl] SSR context, using localhost fallback');
    return 'http://localhost:4000/api';
  }

  // Always use same-origin /api path for local dev proxying.
  // Netlify production should set VITE_API_URL to the hosted backend API.
  _cachedApiUrl = '/api';

  console.log('[apiUrl] Runtime API URL:', _cachedApiUrl, '(same-origin proxy)');
  return _cachedApiUrl;
}

export function getAiServiceUrl(): string {
  if (_cachedAiServiceUrl !== null) {
    return _cachedAiServiceUrl;
  }

  if (import.meta.env.VITE_AI_SERVICE_URL) {
    _cachedAiServiceUrl = import.meta.env.VITE_AI_SERVICE_URL;
    console.log('[apiUrl] Using VITE_AI_SERVICE_URL:', _cachedAiServiceUrl);
    return _cachedAiServiceUrl;
  }

  if (typeof window === 'undefined') {
    console.log('[apiUrl] SSR context, using localhost AI service fallback');
    return 'http://localhost:8000';
  }

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  _cachedAiServiceUrl = isLocalhost
    ? `${protocol}://${hostname}:8000`
    : `${protocol}://${hostname}/ai`;

  console.log('[apiUrl] Runtime AI Service URL:', _cachedAiServiceUrl, '(hostname:', hostname, ')');
  return _cachedAiServiceUrl;
}

export function getAssistantsApiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:4001/api';
  }

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  return isLocalhost
    ? `${protocol}://${hostname}:4001/api`
    : `${protocol}://${hostname}/assistants-api`;
}

export function clearUrlCache(): void {
  _cachedApiUrl = null;
  _cachedAiServiceUrl = null;
}

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function getProtocol(): 'http' | 'https' {
  if (typeof window === 'undefined') {
    return 'http';
  }
  return window.location.protocol === 'https:' ? 'https' : 'http';
}
