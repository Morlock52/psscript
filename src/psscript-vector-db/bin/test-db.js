#!/usr/bin/env node

/**
 * Test database connection for PowerShell Script Vector Database
 */

const { sequelize, testConnection } = require('../config/database');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m'
  }
};

/**
 * Test database connection
 */
async function testDatabaseConnection() {
  console.log(`${colors.fg.yellow}Testing database connection...${colors.reset}`);
  
  try {
    // Test connection
    const connected = await testConnection();
    
    if (connected) {
      console.log(`${colors.fg.green}Database connection successful!${colors.reset}`);
      
      // Get database information
      const [result] = await sequelize.query('SELECT version();');
      console.log(`${colors.fg.cyan}PostgreSQL version: ${result[0].version}${colors.reset}`);
      
      // Check if pgvector extension is installed
      try {
        await sequelize.query('SELECT * FROM pg_extension WHERE extname = \'vector\';');
        console.log(`${colors.fg.green}pgvector extension is installed.${colors.reset}`);
      } catch (error) {
        console.error(`${colors.fg.red}pgvector extension is not installed.${colors.reset}`);
        console.error(`${colors.fg.yellow}Please install pgvector extension:${colors.reset}`);
        console.error(`${colors.fg.yellow}CREATE EXTENSION vector;${colors.reset}`);
        process.exit(1);
      }
      
      // Close connection
      await sequelize.close();
      process.exit(0);
    } else {
      console.error(`${colors.fg.red}Database connection failed.${colors.reset}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.fg.red}Error testing database connection:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection().catch(error => {
  console.error(`${colors.fg.red}Error:${colors.reset}`, error);
  process.exit(1);
});
