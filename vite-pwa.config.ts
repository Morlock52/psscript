/**
 * PWA Configuration for PSScript
 * Enables offline support, install prompt, and service worker
 * Based on 2026 best practices
 */

import { VitePWA } from 'vite-plugin-pwa';

export const pwaConfig = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],

  manifest: {
    name: 'PSScript Analyzer',
    short_name: 'PSScript',
    description: 'AI-powered PowerShell script analysis and management',
    theme_color: '#4F46E5',
    background_color: '#ffffff',
    display: 'standalone',
    scope: '/',
    start_url: '/',
    orientation: 'portrait-primary',

    icons: [
      {
        src: '/icon-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],

    categories: ['productivity', 'developer tools', 'utilities'],

    screenshots: [
      {
        src: '/screenshot-1.png',
        sizes: '540x720',
        type: 'image/png',
        label: 'Script Analysis Dashboard'
      },
      {
        src: '/screenshot-2.png',
        sizes: '540x720',
        type: 'image/png',
        label: 'AI-Powered Code Review'
      }
    ]
  },

  workbox: {
    // Runtime caching strategies
    runtimeCaching: [
      {
        // API calls - Network first, fallback to cache
        urlPattern: /^https:\/\/api\.psscript\.com\/.*$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60 // 5 minutes
          },
          networkTimeoutSeconds: 10
        }
      },
      {
        // Static assets - Cache first
        urlPattern: /\.(?:js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|svg|gif)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
          }
        }
      },
      {
        // CDN assets (MUI, etc)
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
          }
        }
      },
      {
        // Monaco editor assets
        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'cdn-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
          }
        }
      },
      {
        // Scripts data - StaleWhileRevalidate for fresh content
        urlPattern: /^https:\/\/api\.psscript\.com\/api\/scripts$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'scripts-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60 // 1 day
          }
        }
      }
    ],

    // Clean up old caches on activation
    cleanupOutdatedCaches: true,

    // Skip waiting and claim clients immediately
    skipWaiting: true,
    clientsClaim: true,

    // Ignore URL parameters for caching (except auth tokens)
    ignoreURLParametersMatching: [/^(?!token$).*/],

    // Navigation fallback for offline SPA
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [
      // Don't use fallback for API calls
      /^\/api\//,
      // Don't use fallback for files with extensions
      /\.[^/]+$/
    ]
  },

  devOptions: {
    enabled: false, // Enable in dev if you want to test PWA
    type: 'module',
    navigateFallback: 'index.html'
  }
});

export default pwaConfig;
