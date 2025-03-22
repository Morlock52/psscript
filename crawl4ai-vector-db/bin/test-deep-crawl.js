#!/usr/bin/env node

/**
 * Test script for deep crawling features
 * 
 * This script demonstrates the deep crawling capabilities of crawl4ai-vector-db
 * by crawling a website recursively using different strategies.
 */

require('dotenv').config();
const { CrawlService } = require('../src/services');
const { WebPage } = require('../src/models');
const { sequelize } = require('../src/config/database');
const chalk = require('chalk');

// Test URLs
const TEST_URLS = [
  'https://en.wikipedia.org/wiki/Web_crawler',
  'https://en.wikipedia.org/wiki/Vector_database',
  'https://en.wikipedia.org/wiki/Semantic_search'
];

// Test strategies
const STRATEGIES = ['BFS', 'DFS', 'BESTFIRST'];

// Test function
async function testDeepCrawl() {
  try {
    console.log(chalk.blue('=== Testing Deep Crawling Features ==='));
    
    // Connect to database
    await sequelize.authenticate();
    console.log(chalk.green('Connected to database'));
    
    // Create crawl service
    const crawlService = new CrawlService();
    
    // Test each strategy with a different URL
    for (let i = 0; i < STRATEGIES.length; i++) {
      const url = TEST_URLS[i];
      const strategy = STRATEGIES[i];
      
      console.log(chalk.yellow(`\nTesting ${strategy} strategy on ${url}`));
      console.log(chalk.gray('This may take a few minutes...'));
      
      // Configure crawl options
      const crawlOptions = {
        deepCrawlEnabled: true,
        deepCrawlStrategy: strategy,
        maxPages: 5, // Limit to 5 pages for testing
        scoreThreshold: 0.5,
        useHttpOnly: true // Use HTTP-only crawler for faster testing
      };
      
      // Start time
      const startTime = Date.now();
      
      // Crawl and store the webpage
      const webpage = await crawlService.crawlAndStore(url, crawlOptions);
      
      // End time
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // in seconds
      
      // Get child pages
      const childPages = await WebPage.findAll({
        where: { parentId: webpage.id },
        attributes: ['id', 'url', 'title', 'depth', 'relevanceScore']
      });
      
      // Print results
      console.log(chalk.green(`\nCrawl completed in ${duration.toFixed(2)} seconds`));
      console.log(chalk.blue(`Root page: ${webpage.title} (${webpage.url})`));
      console.log(chalk.blue(`Child pages: ${childPages.length}`));
      
      // Print child pages
      if (childPages.length > 0) {
        console.log(chalk.blue('\nChild pages:'));
        childPages.forEach((page, index) => {
          console.log(chalk.gray(`${index + 1}. ${page.title}`));
          console.log(chalk.gray(`   URL: ${page.url}`));
          console.log(chalk.gray(`   Depth: ${page.depth}`));
          console.log(chalk.gray(`   Relevance: ${page.relevanceScore ? page.relevanceScore.toFixed(2) : 'N/A'}`));
        });
      }
      
      // Print crawl tree
      console.log(chalk.blue('\nCrawl tree:'));
      await printCrawlTree(webpage.id);
      
      console.log(chalk.yellow(`\nTest for ${strategy} strategy completed`));
    }
    
    console.log(chalk.green('\nAll tests completed successfully'));
    
    // Close database connection
    await sequelize.close();
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

// Function to print crawl tree
async function printCrawlTree(rootId, depth = 0, maxDepth = 2) {
  if (depth > maxDepth) {
    return;
  }
  
  const page = await WebPage.findByPk(rootId, {
    attributes: ['id', 'url', 'title', 'depth']
  });
  
  if (!page) {
    return;
  }
  
  // Print indentation
  const indent = '  '.repeat(depth);
  console.log(chalk.gray(`${indent}${depth === 0 ? '└─ ' : '├─ '}${page.title}`));
  
  // Get child pages
  const children = await WebPage.findAll({
    where: { parentId: rootId },
    attributes: ['id'],
    limit: 5 // Limit to 5 children for readability
  });
  
  // Print children
  for (const child of children) {
    await printCrawlTree(child.id, depth + 1, maxDepth);
  }
  
  // If there are more children, print ellipsis
  const totalChildren = await WebPage.count({ where: { parentId: rootId } });
  if (totalChildren > 5) {
    console.log(chalk.gray(`${indent}  └─ ... and ${totalChildren - 5} more`));
  }
}

// Run the test
testDeepCrawl().catch(console.error);
