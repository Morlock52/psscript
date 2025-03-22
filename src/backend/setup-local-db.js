/**
 * Local database setup script
 * This script creates necessary tables and inserts seed data for local development
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection parameters
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'psscript', // Create this database first with: createdb psscript
  user: 'postgres',
  password: 'postgres'
};

// Create connection pool
const pool = new Pool(dbConfig);

async function setupDatabase() {
  console.log('Starting local database setup...');
  const client = await pool.connect();

  try {
    console.log('Connected to PostgreSQL database');

    // Create the pgvector extension if it doesn't exist
    console.log('Checking for pgvector extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('pgvector extension enabled');
    } catch (error) {
      console.warn('Could not create pgvector extension. Vector search will not work:', error.message);
      console.warn('You may need to install the pgvector extension first.');
      console.warn('Continuing setup without vector support...');
    }

    // Read schema file
    console.log('Creating database schema...');
    try {
      const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute schema script
      await client.query(schema);
      console.log('Schema created successfully');
    } catch (error) {
      console.error('Error creating schema:', error.message);
      console.error('Make sure the schema.sql file exists at the correct path');
      throw error;
    }

    // Read seed data file
    console.log('Inserting seed data...');
    try {
      const seedPath = path.join(__dirname, '..', 'db', 'seeds', '01-initial-data.sql');
      const seedData = fs.readFileSync(seedPath, 'utf8');
      
      // Execute seed script
      await client.query(seedData);
      console.log('Seed data inserted successfully');
    } catch (error) {
      console.error('Error inserting seed data:', error.message);
      console.error('Make sure the seed data file exists at the correct path');
      throw error;
    }

    // Verify tables
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    console.log(`\nDatabase tables created (${tableResult.rows.length}):`);
    tableResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

    // Verify seed data
    try {
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      const categoryCount = await client.query('SELECT COUNT(*) FROM categories');
      const scriptCount = await client.query('SELECT COUNT(*) FROM scripts');
      
      console.log('\nSeed data summary:');
      console.log(`- Users: ${userCount.rows[0].count}`);
      console.log(`- Categories: ${categoryCount.rows[0].count}`);
      console.log(`- Scripts: ${scriptCount.rows[0].count}`);
    } catch (error) {
      console.warn('Could not verify seed data:', error.message);
    }

    console.log('\nDatabase setup completed successfully!');
    console.log('You can now start the application.');

  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('Setup completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });