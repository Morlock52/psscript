import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({
    jsxRuntime: 'classic' // Use classic JSX runtime to fix react-toastify issue
  })],
  server: {
    port: 3002, // Changed from 3001 to 3002 to match project configuration
    host: '0.0.0.0',
    watch: {
      usePolling: true
    },
    hmr: {
      overlay: false // Disable error overlay
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
  }
})
