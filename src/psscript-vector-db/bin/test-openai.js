#!/usr/bin/env node

/**
 * Test script for OpenAI API
 * This script tests the connection to the OpenAI API and generates embeddings
 */

const { OpenAI } = require('openai');
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
 * Test OpenAI API connection
 * @returns {Promise<boolean>} - Promise that resolves to true if connection is successful
 */
async function testOpenAIConnection() {
  try {
    // Check if API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error(`${colors.fg.red}OpenAI API key is not set.${colors.reset}`);
      console.error(`${colors.fg.red}Please set OPENAI_API_KEY in your .env file.${colors.reset}`);
      return false;
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
    });
    
    // Test API connection with a simple models list request
    const models = await openai.models.list();
    
    return models && models.data && models.data.length > 0;
  } catch (error) {
    console.error(`${colors.fg.red}Error connecting to OpenAI API:${colors.reset}`, error);
    return false;
  }
}

/**
 * Test embedding generation
 * @returns {Promise<boolean>} - Promise that resolves to true if embedding generation is successful
 */
async function testEmbedding() {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
    });
    
    // Get embedding model from environment variables
    const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    
    // Test text to embed
    const text = 'This is a test for PowerShell Script Vector Database.';
    
    // Generate embedding
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: text,
      encoding_format: 'float'
    });
    
    // Check if embedding was generated
    return response && response.data && response.data.length > 0 && response.data[0].embedding.length > 0;
  } catch (error) {
    console.error(`${colors.fg.red}Error generating embedding:${colors.reset}`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.fg.cyan}${colors.bright}PowerShell Script Vector Database${colors.reset}`);
  console.log(`${colors.fg.cyan}OpenAI API Test${colors.reset}`);
  console.log('');
  
  // Test OpenAI API connection
  console.log(`${colors.fg.yellow}Testing OpenAI API connection...${colors.reset}`);
  const connected = await testOpenAIConnection();
  
  if (connected) {
    console.log(`${colors.fg.green}OpenAI API connection successful!${colors.reset}`);
    
    // Print OpenAI API configuration
    console.log(`${colors.fg.yellow}OpenAI API configuration:${colors.reset}`);
    console.log(`${colors.fg.yellow}API URL:${colors.reset} ${process.env.OPENAI_API_URL || 'https://api.openai.com/v1'}`);
    console.log(`${colors.fg.yellow}Embedding Model:${colors.reset} ${process.env.EMBEDDING_MODEL || 'text-embedding-3-small'}`);
    
    // Test embedding generation
    console.log(`${colors.fg.yellow}Testing embedding generation...${colors.reset}`);
    const embeddingGenerated = await testEmbedding();
    
    if (embeddingGenerated) {
      console.log(`${colors.fg.green}Embedding generation successful!${colors.reset}`);
      console.log(`${colors.fg.green}${colors.bright}Test passed!${colors.reset}`);
    } else {
      console.error(`${colors.fg.red}Embedding generation failed.${colors.reset}`);
      console.error(`${colors.fg.red}Please check your OpenAI API key and embedding model.${colors.reset}`);
      process.exit(1);
    }
  } else {
    console.error(`${colors.fg.red}OpenAI API connection failed.${colors.reset}`);
    console.error(`${colors.fg.red}Please check your OpenAI API key and API URL.${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(`${colors.fg.red}Error:${colors.reset}`, error);
  process.exit(1);
});
