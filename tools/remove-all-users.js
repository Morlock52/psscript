/**
 * Script to remove all users from the database
 */
const { Pool } = require('pg');
const { pgConnectionConfig } = require('../scripts/lib/hosted-supabase-db');
require('dotenv').config();

// Create connection pool
const pool = new Pool(pgConnectionConfig());

async function removeAllUsers() {
  console.log('Starting user removal process...');
  const client = await pool.connect();

  try {
    console.log('Connected to PostgreSQL database');

    // Get current user count
    const beforeCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`Current user count: ${beforeCount.rows[0].count}`);

    // Truncate the users table (this removes all rows)
    console.log('Removing all users...');
    await client.query('TRUNCATE TABLE users CASCADE');
    
    // Verify user removal
    const afterCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`User count after removal: ${afterCount.rows[0].count}`);

    console.log('All users have been successfully removed!');

  } catch (error) {
    console.error('Error removing users:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the removal process
removeAllUsers()
  .then(() => {
    console.log('User removal completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('User removal failed:', error);
    process.exit(1);
  });
