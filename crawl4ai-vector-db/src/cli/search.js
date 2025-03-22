#!/usr/bin/env node
require('dotenv').config();
const { program } = require('commander');
const { SearchService } = require('../services');
const { sequelize } = require('../models');
const chalk = require('chalk');

// Configure CLI
program
  .name('search')
  .description('CLI tool for searching the vector database')
  .version('1.0.0');

// Command to search for content
program
  .command('query')
  .description('Search for content similar to a query')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum number of results', '5')
  .option('-t, --threshold <number>', 'Similarity threshold (0.0-1.0)', '0.7')
  .action(async (query, options) => {
    try {
      await sequelize.authenticate();
      console.log('Connected to database');
      
      const searchService = new SearchService();
      
      const searchOptions = {
        limit: parseInt(options.limit),
        threshold: parseFloat(options.threshold)
      };
      
      console.log(`Searching for: "${query}"`);
      const results = await searchService.search(query, searchOptions);
      
      if (results.length === 0) {
        console.log(chalk.yellow('No results found.'));
      } else {
        console.log(chalk.green(`Found ${results.length} results:`));
        
        results.forEach((result, index) => {
          console.log();
          console.log(chalk.cyan(`Result ${index + 1} (Similarity: ${result.similarity.toFixed(4)})`));
          console.log(chalk.bold(`URL: ${result.webpage.url}`));
          console.log(chalk.bold(`Title: ${result.webpage.title}`));
          console.log(chalk.gray('---'));
          console.log(result.content);
          console.log(chalk.gray('---'));
        });
      }
      
      await sequelize.close();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Command to search with keywords
program
  .command('keywords')
  .description('Search for content with keyword filtering')
  .argument('<query>', 'Search query')
  .argument('<keywords>', 'Keywords to filter by (space-separated)')
  .option('-l, --limit <number>', 'Maximum number of results', '5')
  .option('-t, --threshold <number>', 'Similarity threshold (0.0-1.0)', '0.7')
  .action(async (query, keywords, options) => {
    try {
      await sequelize.authenticate();
      console.log('Connected to database');
      
      const searchService = new SearchService();
      
      const searchOptions = {
        limit: parseInt(options.limit),
        threshold: parseFloat(options.threshold)
      };
      
      console.log(`Searching for: "${query}" with keywords: "${keywords}"`);
      const results = await searchService.searchWithKeywords(query, keywords, searchOptions);
      
      if (results.length === 0) {
        console.log(chalk.yellow('No results found.'));
      } else {
        console.log(chalk.green(`Found ${results.length} results:`));
        
        results.forEach((result, index) => {
          console.log();
          console.log(chalk.cyan(`Result ${index + 1} (Similarity: ${result.similarity.toFixed(4)})`));
          console.log(chalk.bold(`URL: ${result.webpage.url}`));
          console.log(chalk.bold(`Title: ${result.webpage.title}`));
          console.log(chalk.gray('---'));
          console.log(result.content);
          console.log(chalk.gray('---'));
        });
      }
      
      await sequelize.close();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Command to get related chunks
program
  .command('related')
  .description('Get related content chunks')
  .argument('<chunkId>', 'ID of the content chunk')
  .option('-l, --limit <number>', 'Maximum number of related chunks', '5')
  .action(async (chunkId, options) => {
    try {
      await sequelize.authenticate();
      console.log('Connected to database');
      
      const searchService = new SearchService();
      
      console.log(`Getting related chunks for: ${chunkId}`);
      const results = await searchService.getRelatedChunks(chunkId, parseInt(options.limit));
      
      if (results.length === 0) {
        console.log(chalk.yellow('No related chunks found.'));
      } else {
        console.log(chalk.green(`Found ${results.length} related chunks:`));
        
        results.forEach((result, index) => {
          console.log();
          console.log(chalk.cyan(`Related Chunk ${index + 1}`));
          console.log(chalk.bold(`URL: ${result.webpage.url}`));
          console.log(chalk.bold(`Title: ${result.webpage.title}`));
          console.log(chalk.gray('---'));
          console.log(result.content);
          console.log(chalk.gray('---'));
        });
      }
      
      await sequelize.close();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
