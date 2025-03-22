#!/usr/bin/env node

/**
 * Database migration script for PowerShell Script Vector Database
 * This script runs the SQL migration files in the migrations directory
 */

const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');
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
 * Run a migration file
 * @param {string} filePath - Path to the migration file
 * @returns {Promise<void>} - Promise that resolves when the migration is complete
 */
async function runMigration(filePath) {
  try {
    // Read the migration file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split the SQL into statements
    const statements = sql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Run each statement in a transaction
    await sequelize.transaction(async transaction => {
      for (const statement of statements) {
        await sequelize.query(`${statement};`, { transaction });
      }
    });
    
    console.log(`${colors.fg.green}Migration ${path.basename(filePath)} completed successfully${colors.reset}`);
  } catch (error) {
    console.error(`${colors.fg.red}Error running migration ${path.basename(filePath)}:${colors.reset}`, error);
    throw error;
  }
}

/**
 * Run all migrations
 * @returns {Promise<void>} - Promise that resolves when all migrations are complete
 */
async function runMigrations() {
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order
    
    console.log(`${colors.fg.yellow}Found ${migrationFiles.length} migration files${colors.reset}`);
    
    // Create migrations table if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Get executed migrations
    const [executedMigrations] = await sequelize.query(`
      SELECT name FROM migrations;
    `);
    
    const executedMigrationNames = executedMigrations.map(migration => migration.name);
    
    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedMigrationNames.includes(file)) {
        console.log(`${colors.fg.yellow}Running migration: ${file}${colors.reset}`);
        await runMigration(path.join(migrationsDir, file));
        
        // Record the migration
        await sequelize.query(`
          INSERT INTO migrations (name) VALUES ('${file}');
        `);
      } else {
        console.log(`${colors.fg.dim}Migration already executed: ${file}${colors.reset}`);
      }
    }
    
    console.log(`${colors.fg.green}${colors.bright}All migrations completed successfully${colors.reset}`);
  } catch (error) {
    console.error(`${colors.fg.red}Error running migrations:${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sequelize.close();
  }
}

// Run the migrations
runMigrations().catch(error => {
  console.error(`${colors.fg.red}Error:${colors.reset}`, error);
  process.exit(1);
});
