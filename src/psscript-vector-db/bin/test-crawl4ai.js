#!/usr/bin/env node

/**
 * test-crawl4ai.js
 * 
 * This script tests the crawl4ai integration by crawling a small subset of PowerShell documentation
 * and verifying that the content is properly extracted and processed.
 * 
 * Usage:
 *   node test-crawl4ai.js
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Test URL - a small subset of PowerShell documentation
const TEST_URL = 'https://learn.microsoft.com/en-us/powershell/scripting/learn/ps101/01-getting-started';

// Test parameters
const TEST_DEPTH = 1;
const TEST_MAX_PAGES = 3;

console.log('=== Testing crawl4ai Integration ===');
console.log(`Test URL: ${TEST_URL}`);
console.log(`Depth: ${TEST_DEPTH}`);
console.log(`Max Pages: ${TEST_MAX_PAGES}`);

// Create temporary directory for test results
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const outputFile = path.join(tempDir, 'test-crawl-results.json');

// Build crawl4ai command
const crawlCommand = `crawl4ai "${TEST_URL}" --depth=${TEST_DEPTH} --max-pages=${TEST_MAX_PAGES} --output="${outputFile}"`;

// Execute crawl4ai
console.log('\nExecuting crawl4ai...');
try {
  execSync(crawlCommand, { stdio: 'inherit' });
} catch (error) {
  console.error('Error executing crawl4ai:', error.message);
  process.exit(1);
}

// Check if crawl was successful
if (!fs.existsSync(outputFile)) {
  console.error('Error: Crawl did not produce any output');
  process.exit(1);
}

// Read crawl results
console.log('\nReading crawl results...');
const crawlResults = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
console.log(`Found ${crawlResults.length} items`);

// Validate crawl results
if (crawlResults.length === 0) {
  console.error('Error: No items found in crawl results');
  process.exit(1);
}

// Display sample of crawl results
console.log('\nSample of crawled content:');
const sample = crawlResults[0];
console.log(`Title: ${sample.title}`);
console.log(`URL: ${sample.url}`);
console.log(`Content length: ${sample.content.length} characters`);
console.log(`Content preview: ${sample.content.substring(0, 150)}...`);

// Test database connection
console.log('\nTesting database connection...');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/psscript'
});

async function testDatabaseConnection() {
  const client = await pool.connect();
  try {
    // Test query
    const result = await client.query('SELECT NOW() as time');
    console.log(`Database connection successful. Server time: ${result.rows[0].time}`);
    
    // Check if pgvector extension is installed
    try {
      await client.query('SELECT * FROM pg_extension WHERE extname = \'pgvector\'');
      console.log('pgvector extension is installed');
    } catch (error) {
      console.warn('Warning: pgvector extension is not installed. Vector search will not work.');
      console.warn('To install pgvector, run: CREATE EXTENSION vector;');
    }
    
    // Check if required tables exist
    try {
      await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ms_learn_content'
        );
      `);
      console.log('Required tables exist');
    } catch (error) {
      console.warn('Warning: Required tables do not exist. They will be created when running the crawl script.');
    }
    
  } catch (error) {
    console.error('Error connecting to database:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run the test
testDatabaseConnection()
  .then(() => {
    console.log('\nTest completed successfully');
    // Clean up temporary files
    fs.unlinkSync(outputFile);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
