#!/usr/bin/env node

/**
 * Script to run the file_hash migration using Node.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

// Get the database connection string from .env file
const dbConnectionString = process.env.DATABASE_URL;

if (!dbConnectionString) {
  console.error('Error: DATABASE_URL not set in .env file.');
  process.exit(1);
}

async function runMigration() {
  console.log('Running file_hash migration...');
  
  const client = new Client({
    connectionString: dbConnectionString,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    // Read the migration SQL file
    const migrationPath = path.join(REPO_ROOT, 'src', 'db', 'migrations', 'add_file_hash_to_scripts.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    console.log('Executing migration SQL...');
    await client.query(migrationSql);
    console.log('Migration SQL executed successfully.');
    
    // Update existing scripts with file hashes
    console.log('Updating existing scripts with file hashes...');
    await client.query('CREATE SCHEMA IF NOT EXISTS extensions;');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;');
    await client.query('ALTER EXTENSION pgcrypto SET SCHEMA extensions;');
    await client.query('SET search_path = public, extensions;');
    await client.query(`
      UPDATE scripts 
      SET file_hash = encode(digest(content::text, 'sha256'), 'hex')
      WHERE file_hash IS NULL;
    `);
    
    console.log('Migration and data update completed successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
