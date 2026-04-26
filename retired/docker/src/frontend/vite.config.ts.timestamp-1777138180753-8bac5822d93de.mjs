// vite.config.ts
import { defineConfig } from "file:///app/node_modules/vite/dist/node/index.js";
import react from "file:///app/node_modules/@vitejs/plugin-react-swc/index.js";
import fs from "fs";
var tlsEnabled = process.env.TLS_CERT && process.env.TLS_KEY && fs.existsSync(process.env.TLS_CERT) && fs.existsSync(process.env.TLS_KEY);
var httpsConfig = tlsEnabled ? {
  key: fs.readFileSync(process.env.TLS_KEY),
  cert: fs.readFileSync(process.env.TLS_CERT)
} : void 0;
if (tlsEnabled) {
  console.log("\u{1F512} TLS enabled for frontend server (mTLS origin protection active)");
}
var vite_config_default = defineConfig({
  plugins: [react()],
  // SWC is 20-70x faster than Babel
  server: {
    port: 3090,
    host: "0.0.0.0",
    https: httpsConfig,
    // Proxy API + docs downloads through the frontend origin.
    //
    // Why: the backend uses a locally-generated TLS cert (mTLS origin protection) that
    // is not trusted by the browser by default, which causes ERR_CERT_AUTHORITY_INVALID
    // and surfaces as Axios "Network Error". Proxying keeps the browser on
    // https://localhost:3090 and Vite can talk to https://backend:4000 with `secure:false`.
    proxy: {
      "/api": {
        target: process.env.DOCKER_ENV === "true" || process.env.VITE_DOCKER === "true" ? "https://backend:4000" : "https://localhost:4000",
        changeOrigin: true,
        secure: false
      },
      "/docs": {
        target: process.env.DOCKER_ENV === "true" || process.env.VITE_DOCKER === "true" ? "https://backend:4000" : "https://localhost:4000",
        changeOrigin: true,
        secure: false
      }
    },
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "psscript.morloksmaze.com",
      ".morloksmaze.com"
    ],
    watch: {
      usePolling: true
    },
    hmr: {
      overlay: false
      // Disable error overlay
    }
  },
  preview: {
    port: 3090,
    host: "0.0.0.0",
    https: httpsConfig,
    headers: {
      // Prevent caching of HTML to ensure fresh assets on deployment
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  },
  optimizeDeps: {
    exclude: ["jszip"]
  },
  define: {
    // Polyfill for process.env
    "process.env": {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || "development")
    }
  },
  build: {
    // Target browsers that support ES2020 for broad compatibility
    // ES2020 supports: optional chaining, nullish coalescing, dynamic imports
    // Safari 14+, Chrome 87+, Firefox 78+, Edge 88+, iOS Safari 14+
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    // Generate sourcemaps for production debugging
    sourcemap: true,
    cssMinify: "lightningcss",
    // Rollup options for chunk splitting
    // IMPORTANT: Only split truly self-contained, large packages.
    // Per-package splitting causes "Cannot access 'X' before initialization"
    // errors at runtime due to circular imports across the npm ecosystem.
    // Rollup's default chunking handles circular deps correctly.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return void 0;
          }
          if (id.includes("/highlight.js/lib/languages/")) {
            return "vendor-highlight-languages";
          }
          if (id.includes("/refractor/")) {
            return "vendor-refractor";
          }
          return void 0;
        }
      }
    },
    // Allow larger Monaco/highlight chunks with intentional bundling.
    chunkSizeWarningLimit: 1e3
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvdml0ZS5jb25maWcudHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0LXN3YydcbmltcG9ydCBmcyBmcm9tICdmcydcblxuLy8gQ2hlY2sgaWYgVExTIGNlcnRpZmljYXRlcyBhcmUgYXZhaWxhYmxlXG5jb25zdCB0bHNFbmFibGVkID0gcHJvY2Vzcy5lbnYuVExTX0NFUlQgJiYgcHJvY2Vzcy5lbnYuVExTX0tFWSAmJlxuICBmcy5leGlzdHNTeW5jKHByb2Nlc3MuZW52LlRMU19DRVJUKSAmJiBmcy5leGlzdHNTeW5jKHByb2Nlc3MuZW52LlRMU19LRVkpO1xuXG4vLyBIVFRQUyBvcHRpb25zIGZvciBtVExTIHR1bm5lbC10by1vcmlnaW4gY29tbXVuaWNhdGlvblxuY29uc3QgaHR0cHNDb25maWcgPSB0bHNFbmFibGVkID8ge1xuICBrZXk6IGZzLnJlYWRGaWxlU3luYyhwcm9jZXNzLmVudi5UTFNfS0VZISksXG4gIGNlcnQ6IGZzLnJlYWRGaWxlU3luYyhwcm9jZXNzLmVudi5UTFNfQ0VSVCEpLFxufSA6IHVuZGVmaW5lZDtcblxuaWYgKHRsc0VuYWJsZWQpIHtcbiAgY29uc29sZS5sb2coJ1x1RDgzRFx1REQxMiBUTFMgZW5hYmxlZCBmb3IgZnJvbnRlbmQgc2VydmVyIChtVExTIG9yaWdpbiBwcm90ZWN0aW9uIGFjdGl2ZSknKTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSwgLy8gU1dDIGlzIDIwLTcweCBmYXN0ZXIgdGhhbiBCYWJlbFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAzMDkwLFxuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBodHRwczogaHR0cHNDb25maWcsXG4gICAgLy8gUHJveHkgQVBJICsgZG9jcyBkb3dubG9hZHMgdGhyb3VnaCB0aGUgZnJvbnRlbmQgb3JpZ2luLlxuICAgIC8vXG4gICAgLy8gV2h5OiB0aGUgYmFja2VuZCB1c2VzIGEgbG9jYWxseS1nZW5lcmF0ZWQgVExTIGNlcnQgKG1UTFMgb3JpZ2luIHByb3RlY3Rpb24pIHRoYXRcbiAgICAvLyBpcyBub3QgdHJ1c3RlZCBieSB0aGUgYnJvd3NlciBieSBkZWZhdWx0LCB3aGljaCBjYXVzZXMgRVJSX0NFUlRfQVVUSE9SSVRZX0lOVkFMSURcbiAgICAvLyBhbmQgc3VyZmFjZXMgYXMgQXhpb3MgXCJOZXR3b3JrIEVycm9yXCIuIFByb3h5aW5nIGtlZXBzIHRoZSBicm93c2VyIG9uXG4gICAgLy8gaHR0cHM6Ly9sb2NhbGhvc3Q6MzA5MCBhbmQgVml0ZSBjYW4gdGFsayB0byBodHRwczovL2JhY2tlbmQ6NDAwMCB3aXRoIGBzZWN1cmU6ZmFsc2VgLlxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAocHJvY2Vzcy5lbnYuRE9DS0VSX0VOViA9PT0gJ3RydWUnIHx8IHByb2Nlc3MuZW52LlZJVEVfRE9DS0VSID09PSAndHJ1ZScpXG4gICAgICAgICAgPyAnaHR0cHM6Ly9iYWNrZW5kOjQwMDAnXG4gICAgICAgICAgOiAnaHR0cHM6Ly9sb2NhbGhvc3Q6NDAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICAnL2RvY3MnOiB7XG4gICAgICAgIHRhcmdldDogKHByb2Nlc3MuZW52LkRPQ0tFUl9FTlYgPT09ICd0cnVlJyB8fCBwcm9jZXNzLmVudi5WSVRFX0RPQ0tFUiA9PT0gJ3RydWUnKVxuICAgICAgICAgID8gJ2h0dHBzOi8vYmFja2VuZDo0MDAwJ1xuICAgICAgICAgIDogJ2h0dHBzOi8vbG9jYWxob3N0OjQwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gICAgYWxsb3dlZEhvc3RzOiBbXG4gICAgICAnbG9jYWxob3N0JyxcbiAgICAgICcxMjcuMC4wLjEnLFxuICAgICAgJ3Bzc2NyaXB0Lm1vcmxva3NtYXplLmNvbScsXG4gICAgICAnLm1vcmxva3NtYXplLmNvbSdcbiAgICBdLFxuICAgIHdhdGNoOiB7XG4gICAgICB1c2VQb2xsaW5nOiB0cnVlXG4gICAgfSxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlIC8vIERpc2FibGUgZXJyb3Igb3ZlcmxheVxuICAgIH1cbiAgfSxcbiAgcHJldmlldzoge1xuICAgIHBvcnQ6IDMwOTAsXG4gICAgaG9zdDogJzAuMC4wLjAnLFxuICAgIGh0dHBzOiBodHRwc0NvbmZpZyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAvLyBQcmV2ZW50IGNhY2hpbmcgb2YgSFRNTCB0byBlbnN1cmUgZnJlc2ggYXNzZXRzIG9uIGRlcGxveW1lbnRcbiAgICAgICdDYWNoZS1Db250cm9sJzogJ25vLWNhY2hlLCBuby1zdG9yZSwgbXVzdC1yZXZhbGlkYXRlJyxcbiAgICB9XG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnanN6aXAnXVxuICB9LFxuICBkZWZpbmU6IHtcbiAgICAvLyBQb2x5ZmlsbCBmb3IgcHJvY2Vzcy5lbnZcbiAgICAncHJvY2Vzcy5lbnYnOiB7XG4gICAgICBOT0RFX0VOVjogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYuTk9ERV9FTlYgfHwgJ2RldmVsb3BtZW50JylcbiAgICB9XG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgLy8gVGFyZ2V0IGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBFUzIwMjAgZm9yIGJyb2FkIGNvbXBhdGliaWxpdHlcbiAgICAvLyBFUzIwMjAgc3VwcG9ydHM6IG9wdGlvbmFsIGNoYWluaW5nLCBudWxsaXNoIGNvYWxlc2NpbmcsIGR5bmFtaWMgaW1wb3J0c1xuICAgIC8vIFNhZmFyaSAxNCssIENocm9tZSA4NyssIEZpcmVmb3ggNzgrLCBFZGdlIDg4KywgaU9TIFNhZmFyaSAxNCtcbiAgICB0YXJnZXQ6IFsnZXMyMDIwJywgJ2VkZ2U4OCcsICdmaXJlZm94NzgnLCAnY2hyb21lODcnLCAnc2FmYXJpMTQnXSxcbiAgICAvLyBHZW5lcmF0ZSBzb3VyY2VtYXBzIGZvciBwcm9kdWN0aW9uIGRlYnVnZ2luZ1xuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICBjc3NNaW5pZnk6ICdsaWdodG5pbmdjc3MnLFxuICAgIC8vIFJvbGx1cCBvcHRpb25zIGZvciBjaHVuayBzcGxpdHRpbmdcbiAgICAvLyBJTVBPUlRBTlQ6IE9ubHkgc3BsaXQgdHJ1bHkgc2VsZi1jb250YWluZWQsIGxhcmdlIHBhY2thZ2VzLlxuICAgIC8vIFBlci1wYWNrYWdlIHNwbGl0dGluZyBjYXVzZXMgXCJDYW5ub3QgYWNjZXNzICdYJyBiZWZvcmUgaW5pdGlhbGl6YXRpb25cIlxuICAgIC8vIGVycm9ycyBhdCBydW50aW1lIGR1ZSB0byBjaXJjdWxhciBpbXBvcnRzIGFjcm9zcyB0aGUgbnBtIGVjb3N5c3RlbS5cbiAgICAvLyBSb2xsdXAncyBkZWZhdWx0IGNodW5raW5nIGhhbmRsZXMgY2lyY3VsYXIgZGVwcyBjb3JyZWN0bHkuXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIGlmICghaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gT25seSBzcGxpdCBoaWdobGlnaHQuanMgbGFuZ3VhZ2VzIChsYXJnZSwgc2VsZi1jb250YWluZWQsIG5vIGNpcmN1bGFyIGRlcHMpXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvaGlnaGxpZ2h0LmpzL2xpYi9sYW5ndWFnZXMvJykpIHtcbiAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWhpZ2hsaWdodC1sYW5ndWFnZXMnXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3JlZnJhY3Rvci8nKSkge1xuICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItcmVmcmFjdG9yJ1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEV2ZXJ5dGhpbmcgZWxzZTogbGV0IHJvbGx1cCBkZWNpZGUgKHNhZmUgZm9yIGNpcmN1bGFyIGRlcHMpXG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIEFsbG93IGxhcmdlciBNb25hY28vaGlnaGxpZ2h0IGNodW5rcyB3aXRoIGludGVudGlvbmFsIGJ1bmRsaW5nLlxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgc2V0dXBGaWxlczogJy4vc3JjL3Rlc3Qvc2V0dXAudHMnLFxuICAgIGluY2x1ZGU6IFsnc3JjLyoqLyoue3Rlc3Qsc3BlY30ue3RzLHRzeH0nXSxcbiAgICBjb3ZlcmFnZToge1xuICAgICAgcHJvdmlkZXI6ICd2OCcsXG4gICAgICByZXBvcnRlcjogWyd0ZXh0JywgJ2pzb24nLCAnaHRtbCddLFxuICAgIH0sXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsb0JBQW9C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
