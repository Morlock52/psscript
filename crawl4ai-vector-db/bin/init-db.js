#!/usr/bin/env node
require('dotenv').config();
const { sequelize } = require('../src/models');

async function initializeDatabase() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Create pgvector extension if it doesn't exist
    console.log('Creating pgvector extension...');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Vector extension is enabled.');
    
    // Sync models with database
    console.log('Syncing database models...');
    await sequelize.sync({ force: true });
    console.log('Database models synchronized successfully.');
    
    console.log('Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase();
