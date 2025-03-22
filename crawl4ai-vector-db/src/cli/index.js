#!/usr/bin/env node
require('dotenv').config();
const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Configure CLI
program
  .name('crawl4ai-vector-db')
  .description('CLI tools for Crawl4AI Vector Database')
  .version('1.0.0');

// Register commands
program
  .command('crawl', 'Crawl websites and store them in the database')
  .command('search', 'Search the vector database')
  .command('chat', 'Chat with the vector database')
  .command('server', 'Start the API server', { executableFile: '../server.js' });

// Add help text
program.addHelpText('after', `
Examples:
  $ crawl4ai-vector-db crawl url https://example.com
  $ crawl4ai-vector-db search query "What is vector search?"
  $ crawl4ai-vector-db chat start
  $ crawl4ai-vector-db server
`);

// Parse command line arguments
program.parse();
