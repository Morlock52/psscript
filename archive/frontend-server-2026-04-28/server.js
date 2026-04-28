import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'frontend' });
});

// API proxy endpoint for testing
app.get('/api/status', (req, res) => {
  res.json({
    frontend: 'running',
    backend_url: process.env.BACKEND_URL || 'http://localhost:4000',
    ai_service_url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  });
});

// Serve static files from dist directory if it exists
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
