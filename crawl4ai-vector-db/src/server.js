#!/usr/bin/env node
require('dotenv').config();
const { initializeApp } = require('./app');

const PORT = process.env.PORT || 3000;

// Start the server
const startServer = async () => {
  try {
    const app = await initializeApp();
    
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
    
    return server;
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

// If this file is run directly, start the server
if (require.main === module) {
  startServer();
}

module.exports = startServer;
