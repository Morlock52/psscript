#!/usr/bin/env node

/**
 * Script to crawl Microsoft Learn PowerShell documentation
 * and store it in the database with vector embeddings
 */

const msLearnCrawler = require('./msLearnCrawler');
const { testConnection } = require('../../config/database');
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
 * Main function to run the crawler
 */
async function main() {
  console.log(`${colors.fg.cyan}${colors.bright}PowerShell Script Vector Database${colors.reset}`);
  console.log(`${colors.fg.cyan}Microsoft Learn Documentation Crawler${colors.reset}`);
  console.log('');
  
  try {
    // Test database connection
    console.log(`${colors.fg.yellow}Testing database connection...${colors.reset}`);
    const connected = await testConnection();
    
    if (!connected) {
      console.error(`${colors.fg.red}Failed to connect to the database. Please check your database configuration.${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.fg.green}Database connection successful.${colors.reset}`);
    
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error(`${colors.fg.red}OpenAI API key is not set. Please set the OPENAI_API_KEY environment variable.${colors.reset}`);
      process.exit(1);
    }
    
    // Start the crawler
    console.log(`${colors.fg.yellow}Starting Microsoft Learn crawler...${colors.reset}`);
    console.log(`${colors.fg.yellow}This may take a while depending on the number of pages to crawl.${colors.reset}`);
    console.log(`${colors.fg.yellow}Maximum pages to crawl: ${process.env.MAX_PAGES || 500}${colors.reset}`);
    console.log(`${colors.fg.yellow}Crawl strategy: ${process.env.CRAWL_STRATEGY || 'breadthFirst'}${colors.reset}`);
    console.log('');
    
    // Start the crawler
    await msLearnCrawler.startCrawl();
    
    console.log('');
    console.log(`${colors.fg.green}${colors.bright}Crawling completed successfully!${colors.reset}`);
    process.exit(0);
  } catch (error) {
    console.error(`${colors.fg.red}Error running crawler:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the main function
main();
