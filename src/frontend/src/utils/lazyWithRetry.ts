import { lazy, ComponentType } from 'react';

// Key used to track reload attempts in sessionStorage
const RELOAD_KEY = 'chunk_reload_attempt';
const MAX_AUTO_RELOADS = 1; // Only auto-reload once per session

/**
 * Check if an error is a chunk loading error
 */
function isChunkLoadError(error: Error): boolean {
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  return (
    name === 'chunkloaderror' ||
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('module script failed') ||
    // Safari-specific errors
    message.includes('type error') && message.includes('module')
  );
}

/**
 * Force reload the page to get fresh assets
 * Uses sessionStorage to prevent infinite reload loops
 */
function forceReload(): void {
  const reloadCount = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);

  if (reloadCount < MAX_AUTO_RELOADS) {
    sessionStorage.setItem(RELOAD_KEY, String(reloadCount + 1));
    console.log('[lazyWithRetry] Auto-reloading to fetch fresh assets...');
    window.location.reload();
  } else {
    console.warn('[lazyWithRetry] Max auto-reload attempts reached. Please manually refresh.');
    // Clear for next session
    sessionStorage.removeItem(RELOAD_KEY);
  }
}

/**
 * Clear reload counter on successful app load
 * Call this in your app's main component
 */
export function clearReloadCounter(): void {
  sessionStorage.removeItem(RELOAD_KEY);
}

/**
 * Wrapper around React.lazy that retries failed imports
 * Useful for mobile browsers where network conditions can cause import failures
 * Also handles stale chunk errors after deployments by auto-reloading
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add cache-busting on retry attempts
        if (attempt > 0) {
          console.log(`[lazyWithRetry] Retry attempt ${attempt + 1} for module import...`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }

        const module = await importFn();

        // Success! Clear any reload counter
        if (attempt === 0) {
          clearReloadCounter();
        }

        return module;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[lazyWithRetry] Module import failed (attempt ${attempt + 1}/${retries}):`, error);

        // Check if this is a chunk loading error
        if (isChunkLoadError(lastError)) {
          // On final retry, auto-reload to get fresh assets
          if (attempt === retries - 1) {
            console.error('[lazyWithRetry] Chunk loading failed after all retries. Attempting reload...');
            forceReload();
          }
        }
      }
    }

    // If all retries failed, throw the last error
    // The ErrorBoundary will catch this and show a user-friendly message
    throw lastError || new Error('Failed to load module after retries');
  });
}

/**
 * Preload a lazy component to warm the cache
 * Call this on hover or when you anticipate navigation
 */
export function preloadComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>
): void {
  importFn().catch(() => {
    // Silently fail preload - the actual load will retry
  });
}

export default lazyWithRetry;
