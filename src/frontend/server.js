import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://localhost:4000';

// Enable CORS for all routes
app.use(cors());

// Proxy /api requests to the backend (avoids cross-origin self-signed cert issues)
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  secure: false, // Accept self-signed certs from the backend
  logLevel: 'warn',
}));

// Proxy /docs requests to the backend
app.use('/docs', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  secure: false,
  logLevel: 'warn',
}));

// Serve static files from the dist directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for all routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`API proxy → ${BACKEND_URL}`);
});
