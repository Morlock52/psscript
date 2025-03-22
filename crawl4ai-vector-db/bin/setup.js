#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask a question and get the answer
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Main setup function
async function setup() {
  console.log('\n=== Crawl4AI Vector Database Setup ===\n');
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envPath)) {
    console.log('Creating .env file from .env.example...');
    fs.copyFileSync(envExamplePath, envPath);
  }
  
  // Ask for configuration
  console.log('\nDatabase Configuration:');
  const dbHost = await ask('Database Host (default: localhost): ') || 'localhost';
  const dbPort = await ask('Database Port (default: 5432): ') || '5432';
  const dbName = await ask('Database Name (default: crawl4ai_vector): ') || 'crawl4ai_vector';
  const dbUser = await ask('Database User (default: postgres): ') || 'postgres';
  const dbPassword = await ask('Database Password (default: postgres): ') || 'postgres';
  const dbSsl = await ask('Use SSL for Database (true/false, default: false): ') || 'false';
  
  console.log('\nOpenAI Configuration:');
  const openaiApiKey = await ask('OpenAI API Key: ');
  const embeddingModel = await ask('Embedding Model (default: text-embedding-ada-002): ') || 'text-embedding-ada-002';
  const llmModel = await ask('LLM Model (default: gpt-4): ') || 'gpt-4';
  
  console.log('\nServer Configuration:');
  const port = await ask('Server Port (default: 3000): ') || '3000';
  const nodeEnv = await ask('Node Environment (default: development): ') || 'development';
  
  // Update .env file
  const envContent = `# Database
DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DB_SSL=${dbSsl}

# OpenAI
OPENAI_API_KEY=${openaiApiKey}
EMBEDDING_MODEL=${embeddingModel}
LLM_MODEL=${llmModel}

# Server
PORT=${port}
NODE_ENV=${nodeEnv}
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('\n.env file updated successfully!');
  
  // Ask if user wants to run tests
  const runTests = await ask('\nDo you want to run tests to verify the setup? (y/n, default: y): ') || 'y';
  
  if (runTests.toLowerCase() === 'y') {
    console.log('\nRunning tests...');
    try {
      execSync('npm run test-all', { stdio: 'inherit' });
    } catch (error) {
      console.error('\nSome tests failed. Please check the output above for details.');
    }
  }
  
  // Ask if user wants to initialize the database
  const initDb = await ask('\nDo you want to initialize the database? (y/n, default: y): ') || 'y';
  
  if (initDb.toLowerCase() === 'y') {
    console.log('\nInitializing database...');
    try {
      execSync('npm run init-db', { stdio: 'inherit' });
    } catch (error) {
      console.error('\nDatabase initialization failed. Please check the output above for details.');
    }
  }
  
  console.log('\nSetup complete! You can now start the server with:');
  console.log('npm start');
  
  rl.close();
}

// Run setup
setup().catch(error => {
  console.error('Error during setup:', error);
  rl.close();
  process.exit(1);
});
