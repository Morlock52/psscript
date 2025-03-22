#!/usr/bin/env node
require('dotenv').config();
const { AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode } = require('crawl4ai');

async function testCrawl4ai() {
  try {
    console.log('Testing crawl4ai library...');
    
    // Create browser config
    const browserConfig = new BrowserConfig({
      headless: true,
      verbose: false
    });
    
    // Create crawler config
    const crawlerConfig = new CrawlerRunConfig({
      cache_mode: CacheMode.ENABLED
    });
    
    // Create crawler
    console.log('Creating crawler...');
    const crawler = new AsyncWebCrawler(browserConfig);
    
    try {
      // Test crawling a simple page
      const testUrl = 'https://example.com';
      console.log(`Crawling ${testUrl}...`);
      
      const result = await crawler.arun(testUrl, crawlerConfig);
      
      console.log('Crawl result:');
      console.log(`- Title: ${result.metadata.title}`);
      console.log(`- Content length: ${result.extracted_content.length} characters`);
      console.log(`- Markdown length: ${result.markdown.raw_markdown.length} characters`);
      
      console.log('✅ crawl4ai library is working correctly!');
    } finally {
      // Close the browser
      await crawler.close();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing crawl4ai:', error);
    process.exit(1);
  }
}

// Run the test
testCrawl4ai();
