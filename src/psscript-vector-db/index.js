/**
 * PowerShell Script Vector Database
 * Main server file
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create access log stream
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

// Configure rate limiter
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes by default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per windowMs by default
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined', { stream: accessLogStream })); // Logging
app.use(bodyParser.json({ limit: '50mb' })); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies
app.use(limiter); // Rate limiting

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/api', (req, res) => {
  res.json({
    name: 'PowerShell Script Vector Database',
    version: '1.0.0',
    description: 'A vector database for PowerShell scripts with crawl4ai integration'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API routes
const {
  searchScripts,
  searchScriptsByCategory,
  searchScriptsByTag,
  findSimilarScripts
} = require('./services/search/searchService');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toFloat = (value, fallback) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

app.get('/api/search', async (req, res, next) => {
  try {
    const query = (req.query.q || '').toString().trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing required query parameter: q' });
    }

    const limit = clamp(toInt(req.query.limit, 10), 1, 50);
    const threshold = clamp(toFloat(req.query.threshold, 0.7), 0, 1);

    const results = await searchScripts(query, limit, threshold);
    return res.json({ query, limit, threshold, results });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/search/category', async (req, res, next) => {
  try {
    const category = (req.query.category || '').toString().trim();
    if (!category) {
      return res.status(400).json({ error: 'Missing required query parameter: category' });
    }

    const limit = clamp(toInt(req.query.limit, 10), 1, 50);
    const results = await searchScriptsByCategory(category, limit);
    return res.json({ category, limit, results });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/search/tag', async (req, res, next) => {
  try {
    const tag = (req.query.tag || '').toString().trim();
    if (!tag) {
      return res.status(400).json({ error: 'Missing required query parameter: tag' });
    }

    const limit = clamp(toInt(req.query.limit, 10), 1, 50);
    const results = await searchScriptsByTag(tag, limit);
    return res.json({ tag, limit, results });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/search/similar', async (req, res, next) => {
  try {
    const scriptId = toInt(req.query.scriptId, null);
    if (!scriptId) {
      return res.status(400).json({ error: 'Missing required query parameter: scriptId' });
    }

    const limit = clamp(toInt(req.query.limit, 5), 1, 50);
    const threshold = clamp(toFloat(req.query.threshold, 0.7), 0, 1);

    const results = await findSimilarScripts(scriptId, limit, threshold);
    return res.json({ scriptId, limit, threshold, results });
  } catch (error) {
    return next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API URL: http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
