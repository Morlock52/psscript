import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    host: '0.0.0.0',
    watch: {
      usePolling: true
    }
  },
  optimizeDeps: {
    exclude: ['jszip']
  }
})