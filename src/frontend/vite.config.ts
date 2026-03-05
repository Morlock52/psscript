/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'fs'

// Check if TLS certificates are available
const tlsEnabled = process.env.TLS_CERT && process.env.TLS_KEY &&
  fs.existsSync(process.env.TLS_CERT) && fs.existsSync(process.env.TLS_KEY);

// HTTPS options for mTLS tunnel-to-origin communication
const httpsConfig = tlsEnabled ? {
  key: fs.readFileSync(process.env.TLS_KEY!),
  cert: fs.readFileSync(process.env.TLS_CERT!),
} : undefined;

if (tlsEnabled) {
  console.log('🔒 TLS enabled for frontend server (mTLS origin protection active)');
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()], // SWC is 20-70x faster than Babel
  server: {
    port: 3090,
    host: '0.0.0.0',
    https: httpsConfig,
    // Proxy API + docs downloads through the frontend origin.
    //
    // Why: the backend uses a locally-generated TLS cert (mTLS origin protection) that
    // is not trusted by the browser by default, which causes ERR_CERT_AUTHORITY_INVALID
    // and surfaces as Axios "Network Error". Proxying keeps the browser on
    // https://localhost:3090 and Vite can talk to https://backend:4000 with `secure:false`.
    proxy: {
      '/api': {
        target: (process.env.DOCKER_ENV === 'true' || process.env.VITE_DOCKER === 'true')
          ? 'https://backend:4000'
          : 'https://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/docs': {
        target: (process.env.DOCKER_ENV === 'true' || process.env.VITE_DOCKER === 'true')
          ? 'https://backend:4000'
          : 'https://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'psscript.morloksmaze.com',
      '.morloksmaze.com'
    ],
    watch: {
      usePolling: true
    },
    hmr: {
      overlay: false // Disable error overlay
    }
  },
  preview: {
    port: 3090,
    host: '0.0.0.0',
    https: httpsConfig,
    headers: {
      // Prevent caching of HTML to ensure fresh assets on deployment
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  },
  optimizeDeps: {
    exclude: ['jszip']
  },
  define: {
    // Polyfill for process.env
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    }
  },
  build: {
    // Target browsers that support ES2020 for broad compatibility
    // ES2020 supports: optional chaining, nullish coalescing, dynamic imports
    // Safari 14+, Chrome 87+, Firefox 78+, Edge 88+, iOS Safari 14+
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    // Generate sourcemaps for production debugging
    sourcemap: true,
    cssMinify: 'lightningcss',
    // Rollup options for manual chunk splitting
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return null
          }

          // Core React runtime
          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor'
          }

          // Router
          if (id.includes('/react-router-dom/')) {
            return 'router-vendor'
          }

          // UI framework + emotion
          if (id.includes('/@mui/') || id.includes('/@emotion/')) {
            return 'mui-vendor'
          }

          // Data fetch + HTTP
          if (id.includes('/@tanstack/react-query/') || id.includes('/axios/')) {
            return 'query-vendor'
          }

          // Monaco editor stack (large)
          if (id.includes('/react-monaco-editor')) {
            return 'editor-react-monaco'
          }
          if (id.includes('/monaco-editor/')) {
            const monacoParts = id.split('/monaco-editor/')[1]?.split(/[\\/]/).filter(Boolean) || []
            let monacoBucket = monacoParts[0] || 'core'

            if (monacoParts[0] === 'min' && monacoParts[1] === 'vs' && monacoParts[2]) {
              const monacoSubpath = monacoParts[3] ? `${monacoParts[2]}-${monacoParts[3]}` : monacoParts[2]
              monacoBucket = monacoSubpath
            } else if (monacoParts[0] === 'esm' && monacoParts[1] === 'vs' && monacoParts[2]) {
              const monacoSubpath = monacoParts[3] ? `${monacoParts[2]}-${monacoParts[3]}` : monacoParts[2]
              monacoBucket = monacoSubpath
            } else if (monacoParts[1]) {
              monacoBucket = `${monacoParts[0]}-${monacoParts[1]}`
            }

            return `editor-monaco-${monacoBucket}`
          }

          // Markdown + syntax highlighting stack (split by package)
          if (id.includes('/react-markdown/')) {
            return 'markdown-react'
          }
          if (id.includes('/marked/')) {
            return 'markdown-marked'
          }
          if (id.includes('/react-syntax-highlighter/')) {
            return 'markdown-syntax'
          }

          // Charts
          if (id.includes('/chart.js/') || id.includes('/d3/')) {
            return 'chart-vendor'
          }

          // Utilities
          if (id.includes('/date-fns/') || id.includes('/dompurify/') || id.includes('/jszip/')) {
            return 'utils-vendor'
          }
          if (id.includes('/highlight.js/')) {
            const highlightParts = id.split('/highlight.js/')[1]?.split(/[\\/]/).filter(Boolean) || []
            const highlightBucket = (highlightParts[0] && highlightParts[1])
              ? `${highlightParts[0]}-${highlightParts[1]}`
              : highlightParts[0] || 'core'
            return `vendor-highlight-${highlightBucket}`
          }
          if (id.includes('/refractor/')) {
            return 'vendor-refractor'
          }

          // Split remaining third-party packages into package-level chunks.
          const packageMatch = id.match(/node_modules[\\/](@[^/\\]+[\\/][^/\\]+|[^/\\]+)/)
          if (packageMatch?.[1]) {
            const packageName = packageMatch[1].replace('/', '-')
            return `vendor-${packageName}`
          }

          return 'vendor'
        },
      },
    },
    // Allow larger Monaco/highlight chunks with intentional bundling.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
