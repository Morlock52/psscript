/**
 * Database Schema Initializer
 * 
 * This script initializes the database with the base schema.
 * It runs the setup-db.sql file directly to create all tables.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database connection parameters
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'psscript';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// SQL file path
const SQL_FILE = path.join(__dirname, 'setup-db.sql');

/**
 * Initialize database schema using psql
 */
function initializeSchema() {
  try {
    console.log('Starting database schema initialization...');
    console.log(`Database: ${DB_NAME} at ${DB_HOST}:${DB_PORT}`);
    
    // Ensure the SQL file exists
    if (!fs.existsSync(SQL_FILE)) {
      console.error(`SQL file not found: ${SQL_FILE}`);
      process.exit(1);
    }
    
    // Set the PGPASSWORD environment variable for psql
    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
    
    // Build the psql command
    const psqlCmd = `psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "${SQL_FILE}"`;
    
    console.log('Executing SQL file...');
    
    // Execute the psql command
    const output = execSync(psqlCmd, { 
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout and stderr
    });
    
    console.log('Database schema initialized successfully');
    console.log('\nOutput from psql:');
    console.log(output);
    
    return true;
  } catch (error) {
    console.error('Schema initialization failed:');
    console.error(error.message);
    if (error.stderr) {
      console.error('psql error:', error.stderr);
    }
    return false;
  }
}

// Run the function
if (initializeSchema()) {
  console.log('Database setup complete.');
  process.exit(0);
} else {
  console.error('Database setup failed.');
  process.exit(1);
};