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
        target: 'https://backend:4000',
        changeOrigin: true,
        secure: false,
      },
      '/docs': {
        target: 'https://backend:4000',
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
    // Rollup options for manual chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - loaded on every page
          'react-vendor': ['react', 'react-dom'],
          // Router - loaded on every page
          'router-vendor': ['react-router-dom'],
          // UI framework - Material UI is large
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // Data fetching
          'query-vendor': ['@tanstack/react-query', 'axios'],
          // Monaco editor - only loaded on script edit pages
          'editor-vendor': ['monaco-editor'],
          // Charting libraries
          'chart-vendor': ['chart.js', 'd3'],
          // Markdown and syntax highlighting
          'markdown-vendor': ['react-markdown', 'react-syntax-highlighter', 'marked'],
          // Utilities
          'utils-vendor': ['date-fns', 'dompurify', 'jszip'],
        },
      },
    },
    // Increase chunk size warning limit (we're optimizing with manual chunks)
    chunkSizeWarningLimit: 600,
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
