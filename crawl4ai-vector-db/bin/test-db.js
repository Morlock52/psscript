#!/usr/bin/env node
require('dotenv').config();
const { testConnection } = require('../src/config/database');

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    const result = await testConnection();
    
    if (result) {
      console.log('✅ Database connection successful!');
      console.log('✅ Vector extension is enabled.');
      process.exit(0);
    } else {
      console.error('❌ Database connection failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error testing database connection:', error);
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection();
