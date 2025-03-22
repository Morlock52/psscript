#!/usr/bin/env node
require('dotenv').config();
const { program } = require('commander');
const { CrawlService } = require('../services');
const { sequelize } = require('../models');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

// Configure CLI
program
  .name('crawl')
  .description('CLI tool for crawling websites and storing them in the vector database')
  .version('1.0.0');

// Command to crawl a single URL
program
  .command('url')
  .description('Crawl a single URL and store it in the database')
  .argument('<url>', 'URL to crawl')
  .option('-f, --force', 'Force recrawl if URL already exists')
  .option('-d, --deep', 'Enable deep crawling')
  .option('-s, --strategy <strategy>', 'Deep crawl strategy (bfs, dfs, bestfirst)', 'bfs')
  .option('-m, --max-pages <number>', 'Maximum number of pages to crawl', '10')
  .option('-t, --threshold <number>', 'Score threshold for deep crawling', '0.5')
  .option('-p, --profile <name>', 'Browser profile name to use')
  .option('-h, --http-only', 'Use HTTP-only crawler (no JavaScript)')
  .option('--js <code>', 'Custom JavaScript to execute on the page')
  .option('--no-robots', 'Ignore robots.txt rules')
  .action(async (url, options) => {
    try {
      await sequelize.authenticate();
      console.log(chalk.green('Connected to database'));

      // Configure crawler options
      const crawlOptions = {
        deepCrawlEnabled: options.deep || false,
        deepCrawlStrategy: options.strategy.toUpperCase(),
        maxPages: parseInt(options.maxPages),
        scoreThreshold: parseFloat(options.threshold),
        forceRecrawl: options.force || false,
        useHttpOnly: options.httpOnly || false,
        respectRobotsTxt: options.robots !== false,
        jsCode: options.js
      };

      // Configure browser profile if provided
      if (options.profile) {
        const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.crawl4ai', 'profiles', options.profile);
        crawlOptions.userDataDir = userDataDir;
        crawlOptions.usePersistentContext = true;
        console.log(chalk.blue(`Using browser profile: ${options.profile}`));
      }

      const crawlService = new CrawlService(crawlOptions);

      console.log(chalk.blue(`Crawling ${url}...`));
      
      if (options.deep) {
        console.log(chalk.yellow(`Deep crawling enabled with strategy: ${options.strategy}`));
        console.log(chalk.yellow(`Max pages: ${options.maxPages}, Threshold: ${options.threshold}`));
      }
      
      const result = await crawlService.crawlAndStore(url, crawlOptions);

      console.log(chalk.green('Crawl completed successfully:'));
      console.log(`- Title: ${result.title}`);
      console.log(`- URL: ${result.url}`);
      console.log(`- ID: ${result.id}`);

      await sequelize.close();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Command to crawl multiple URLs from a file
program
  .command('file')
  .description('Crawl multiple URLs from a file')
  .argument('<file>', 'File containing URLs (one per line)')
  .option('-c, --concurrent <number>', 'Number of concurrent crawls', '3')
  .option('-d, --deep', 'Enable deep crawling')
  .option('-s, --strategy <strategy>', 'Deep crawl strategy (bfs, dfs, bestfirst)', 'bfs')
  .option('-m, --max-pages <number>', 'Maximum number of pages to crawl', '10')
  .option('-t, --threshold <number>', 'Score threshold for deep crawling', '0.5')
  .option('-p, --profile <name>', 'Browser profile name to use')
  .option('-h, --http-only', 'Use HTTP-only crawler (no JavaScript)')
  .option('--no-robots', 'Ignore robots.txt rules')
  .action(async (file, options) => {
    try {
      if (!fs.existsSync(file)) {
        console.error(chalk.red(`File not found: ${file}`));
        process.exit(1);
      }

      await sequelize.authenticate();
      console.log(chalk.green('Connected to database'));

      // Configure crawler options
      const crawlOptions = {
        deepCrawlEnabled: options.deep || false,
        deepCrawlStrategy: options.strategy.toUpperCase(),
        maxPages: parseInt(options.maxPages),
        scoreThreshold: parseFloat(options.threshold),
        useHttpOnly: options.httpOnly || false,
        respectRobotsTxt: options.robots !== false
      };

      // Configure browser profile if provided
      if (options.profile) {
        const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.crawl4ai', 'profiles', options.profile);
        crawlOptions.userDataDir = userDataDir;
        crawlOptions.usePersistentContext = true;
        console.log(chalk.blue(`Using browser profile: ${options.profile}`));
      }

      const crawlService = new CrawlService(crawlOptions);
      const concurrentLimit = parseInt(options.concurrent);

      // Read URLs from file
      const fileStream = fs.createReadStream(file);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const urls = [];
      for await (const line of rl) {
        if (line.trim()) {
          urls.push(line.trim());
        }
      }

      console.log(chalk.blue(`Found ${urls.length} URLs to crawl`));
      
      if (options.deep) {
        console.log(chalk.yellow(`Deep crawling enabled with strategy: ${options.strategy}`));
        console.log(chalk.yellow(`Max pages: ${options.maxPages}, Threshold: ${options.threshold}`));
      }

      // Process URLs in batches
      const results = await crawlService.batchCrawlAndStore(urls, {
        ...crawlOptions,
        concurrency: concurrentLimit
      });

      // Print summary
      console.log(chalk.green('\nCrawl Summary:'));
      console.log(`- Total URLs: ${urls.length}`);
      console.log(`- Successful: ${results.length}`);
      console.log(`- Failed: ${urls.length - results.length}`);

      await sequelize.close();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Command to crawl a website recursively (now implemented with deep crawling)
program
  .command('site')
  .description('Crawl a website recursively using deep crawling')
  .argument('<url>', 'Starting URL to crawl')
  .option('-s, --strategy <strategy>', 'Deep crawl strategy (bfs, dfs, bestfirst)', 'bfs')
  .option('-m, --max-pages <number>', 'Maximum number of pages to crawl', '50')
  .option('-t, --threshold <number>', 'Score threshold for deep crawling', '0.5')
  .option('-p, --profile <name>', 'Browser profile name to use')
  .option('-h, --http-only', 'Use HTTP-only crawler (no JavaScript)')
  .option('--no-robots', 'Ignore robots.txt rules')
  .action(async (url, options) => {
    try {
      await sequelize.authenticate();
      console.log(chalk.green('Connected to database'));

      // Configure crawler options
      const crawlOptions = {
        deepCrawlEnabled: true,
        deepCrawlStrategy: options.strategy.toUpperCase(),
        maxPages: parseInt(options.maxPages),
        scoreThreshold: parseFloat(options.threshold),
        useHttpOnly: options.httpOnly || false,
        respectRobotsTxt: options.robots !== false
      };

      // Configure browser profile if provided
      if (options.profile) {
        const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.crawl4ai', 'profiles', options.profile);
        crawlOptions.userDataDir = userDataDir;
        crawlOptions.usePersistentContext = true;
        console.log(chalk.blue(`Using browser profile: ${options.profile}`));
      }

      const crawlService = new CrawlService(crawlOptions);

      console.log(chalk.blue(`Deep crawling ${url}...`));
      console.log(chalk.yellow(`Strategy: ${options.strategy}`));
      console.log(chalk.yellow(`Max pages: ${options.maxPages}, Threshold: ${options.threshold}`));
      
      const result = await crawlService.crawlAndStore(url, crawlOptions);

      console.log(chalk.green('Deep crawl completed successfully:'));
      console.log(`- Starting URL: ${url}`);
      console.log(`- Primary page ID: ${result.id}`);

      await sequelize.close();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Command to create or manage browser profiles
program
  .command('profile')
  .description('Create or manage browser profiles')
  .argument('<action>', 'Action to perform (create, list, delete)')
  .argument('[name]', 'Profile name')
  .action(async (action, name) => {
    try {
      const profilesDir = path.join(process.env.HOME || process.env.USERPROFILE, '.crawl4ai', 'profiles');
      
      // Create profiles directory if it doesn't exist
      if (!fs.existsSync(profilesDir)) {
        fs.mkdirSync(profilesDir, { recursive: true });
      }
      
      switch (action.toLowerCase()) {
        case 'create':
          if (!name) {
            console.error(chalk.red('Profile name is required'));
            process.exit(1);
          }
          
          const profileDir = path.join(profilesDir, name);
          if (fs.existsSync(profileDir)) {
            console.error(chalk.red(`Profile '${name}' already exists`));
            process.exit(1);
          }
          
          fs.mkdirSync(profileDir, { recursive: true });
          console.log(chalk.green(`Created browser profile: ${name}`));
          console.log(chalk.blue(`Profile directory: ${profileDir}`));
          console.log(chalk.yellow('Use this profile with the --profile option when crawling'));
          break;
          
        case 'list':
          if (!fs.existsSync(profilesDir) || fs.readdirSync(profilesDir).length === 0) {
            console.log(chalk.yellow('No browser profiles found'));
            break;
          }
          
          console.log(chalk.green('Available browser profiles:'));
          fs.readdirSync(profilesDir).forEach(profile => {
            const profilePath = path.join(profilesDir, profile);
            if (fs.statSync(profilePath).isDirectory()) {
              console.log(`- ${profile}`);
            }
          });
          break;
          
        case 'delete':
          if (!name) {
            console.error(chalk.red('Profile name is required'));
            process.exit(1);
          }
          
          const profileToDelete = path.join(profilesDir, name);
          if (!fs.existsSync(profileToDelete)) {
            console.error(chalk.red(`Profile '${name}' not found`));
            process.exit(1);
          }
          
          fs.rmSync(profileToDelete, { recursive: true, force: true });
          console.log(chalk.green(`Deleted browser profile: ${name}`));
          break;
          
        default:
          console.error(chalk.red(`Unknown action: ${action}`));
          console.log(chalk.yellow('Available actions: create, list, delete'));
          process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
