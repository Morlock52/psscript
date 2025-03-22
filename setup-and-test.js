/**
 * Full Database Setup and Test Script
 * 
 * This script performs complete database setup and testing:
 * 1. Initialize the database schema with all tables
 * 2. Run any pending migrations
 * 3. Test PostgreSQL connectivity
 * 4. Test Redis/caching
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure test results directory exists
const testResultsDir = path.join(__dirname, 'test-results', 'db-tests');
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

// Log the start of the process
console.log('=== Database Setup and Test Script ===');
console.log(`Started at: ${new Date().toISOString()}`);
console.log(`Node version: ${process.version}`);

/**
 * Run a command and return its output
 */
function runCommand(command, description) {
  console.log(`\n== ${description} ==`);
  console.log(`Executing: ${command}`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname
    });
    console.log('Command completed successfully.');
    return { success: true, output };
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    if (error.stderr) {
      console.error(`Error output: ${error.stderr}`);
    }
    return { success: false, error };
  }
}

/**
 * Run all the database setup steps
 */
async function setupAndTest() {
  // Step 1: Initialize database schema
  const schemaResult = runCommand('node setup-database.js', 'Initializing Database Schema');
  if (!schemaResult.success) {
    console.error('Schema initialization failed. Stopping.');
    process.exit(1);
  }
  
  // Step 2: Run migrations
  const migrationResult = runCommand('node run-migration.js', 'Running Database Migrations');
  if (!migrationResult.success) {
    console.warn('Some migrations failed. Continuing with tests.');
  }
  
  // Step 3: Install pgvector
  const pgvectorResult = runCommand('node check-pgvector.js', 'Setting up pgvector Extension');
  if (!pgvectorResult.success) {
    console.warn('pgvector setup failed. Vector search may not be available.');
  }
  
  // Step 4: Test PostgreSQL connectivity
  const pgTestResult = runCommand('cd src/backend && node test-db.js', 'Testing PostgreSQL Connectivity');
  if (!pgTestResult.success) {
    console.error('PostgreSQL connectivity test failed.');
  }
  
  // Step 5: Test Redis/cache
  const redisTestResult = runCommand('cd src/backend && node test-redis.js', 'Testing Redis/Cache Functionality');
  if (!redisTestResult.success) {
    console.error('Redis/cache test failed.');
  }
  
  // Create a summary of all the tests
  console.log('\n=== Database Setup and Test Summary ===');
  console.log(`Schema initialization: ${schemaResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Database migrations: ${migrationResult.success ? 'SUCCESS' : 'WARNING (some migrations may not have applied)'}`);
  console.log(`pgvector setup: ${pgvectorResult.success ? 'SUCCESS' : 'WARNING (vector search may not work)'}`);
  console.log(`PostgreSQL connectivity: ${pgTestResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Redis/cache test: ${redisTestResult.success ? 'SUCCESS' : 'FAILED'}`);
  
  // Final status
  const allSuccess = schemaResult.success && pgTestResult.success && redisTestResult.success;
  console.log(`\nOverall status: ${allSuccess ? 'SUCCESS' : 'INCOMPLETE'}`);
  console.log(`Completed at: ${new Date().toISOString()}`);
  
  // Exit with appropriate code
  process.exit(allSuccess ? 0 : 1);
}

// Run the setup and test process
setupAndTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});