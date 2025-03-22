const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const routes = require('./routes');
const { sequelize } = require('./models');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
const initializeApp = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Create pgvector extension if it doesn't exist
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Vector extension is enabled.');
    
    // Sync models with database
    await sequelize.sync();
    console.log('Database models synchronized successfully.');
    
    return app;
  } catch (error) {
    console.error('Unable to initialize application:', error);
    process.exit(1);
  }
};

module.exports = { app, initializeApp };
