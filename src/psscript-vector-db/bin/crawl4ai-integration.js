#!/usr/bin/env node

/**
 * crawl4ai-integration.js
 * 
 * This script demonstrates how to use crawl4ai to crawl PowerShell documentation
 * and store it in the vector database for semantic search.
 * 
 * Usage:
 *   node crawl4ai-integration.js <url> [options]
 * 
 * Options:
 *   --depth=<number>     Crawl depth (default: 2)
 *   --max-pages=<number> Maximum pages to crawl (default: 10)
 *   --external           Include external links (default: false)
 *   --file-types=<types> Comma-separated list of file types to extract (default: ps1,psm1,psd1)
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');

// Check if crawl4ai is installed
try {
  execSync('npm list -g crawl4ai', { stdio: 'ignore' });
} catch (error) {
  console.log('Installing crawl4ai globally...');
  execSync('npm install -g crawl4ai');
}

// Parse command line arguments
const args = process.argv.slice(2);
const url = args[0];

if (!url) {
  console.error('Error: URL is required');
  console.log('Usage: node crawl4ai-integration.js <url> [options]');
  process.exit(1);
}

// Parse options
const options = {
  depth: 2,
  maxPages: 10,
  external: false,
  fileTypes: ['ps1', 'psm1', 'psd1']
};

args.slice(1).forEach(arg => {
  if (arg.startsWith('--depth=')) {
    options.depth = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--max-pages=')) {
    options.maxPages = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--external') {
    options.external = true;
  } else if (arg.startsWith('--file-types=')) {
    options.fileTypes = arg.split('=')[1].split(',');
  }
});

// Create temporary directory for crawl results
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const outputFile = path.join(tempDir, 'crawl-results.json');

console.log('Starting crawl with the following options:');
console.log(`URL: ${url}`);
console.log(`Depth: ${options.depth}`);
console.log(`Max Pages: ${options.maxPages}`);
console.log(`Include External Links: ${options.external}`);
console.log(`File Types: ${options.fileTypes.join(', ')}`);

// Build crawl4ai command
let crawlCommand = `crawl4ai "${url}" --depth=${options.depth} --max-pages=${options.maxPages} --output="${outputFile}"`;

if (options.external) {
  crawlCommand += ' --external';
}

if (options.fileTypes.length > 0) {
  crawlCommand += ` --file-types=${options.fileTypes.join(',')}`;
}

// Execute crawl4ai
console.log('\nExecuting crawl4ai...');
try {
  execSync(crawlCommand, { stdio: 'inherit' });
} catch (error) {
  console.error('Error executing crawl4ai:', error.message);
  process.exit(1);
}

// Check if crawl was successful
if (!fs.existsSync(outputFile)) {
  console.error('Error: Crawl did not produce any output');
  process.exit(1);
}

// Read crawl results
console.log('\nReading crawl results...');
const crawlResults = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
console.log(`Found ${crawlResults.length} items`);

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/psscript'
});

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-ada-002'
});

// Process and store crawl results
async function processCrawlResults() {
  console.log('\nProcessing and storing crawl results...');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS ms_learn_content (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        crawled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        embedding VECTOR(1536)
      );
      
      CREATE TABLE IF NOT EXISTS ms_learn_tags (
        id SERIAL PRIMARY KEY,
        content_id INTEGER REFERENCES ms_learn_content(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        UNIQUE(content_id, tag)
      );
    `);
    
    // Process each crawled item
    for (const item of crawlResults) {
      // Generate embedding for the content
      const embeddingArray = await embeddings.embedQuery(item.content);
      
      // Insert content
      const contentResult = await client.query(
        `INSERT INTO ms_learn_content (title, url, content, source, embedding)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (url) DO UPDATE
         SET title = $1, content = $3, source = $4, embedding = $5, crawled_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          item.title,
          item.url,
          item.content,
          item.source || 'Microsoft Learn',
          embeddingArray
        ]
      );
      
      const contentId = contentResult.rows[0].id;
      
      // Extract tags from content
      const tags = extractTags(item.content);
      
      // Insert tags
      for (const tag of tags) {
        await client.query(
          `INSERT INTO ms_learn_tags (content_id, tag)
           VALUES ($1, $2)
           ON CONFLICT (content_id, tag) DO NOTHING`,
          [contentId, tag]
        );
      }
      
      console.log(`Processed: ${item.title}`);
    }
    
    await client.query('COMMIT');
    console.log('\nAll items processed and stored successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing crawl results:', error);
  } finally {
    client.release();
  }
}

// Extract tags from content using simple keyword matching
function extractTags(content) {
  const tags = new Set();
  
  // Common PowerShell keywords and concepts
  const keywords = [
    'PowerShell', 'cmdlet', 'function', 'module', 'script', 'parameter',
    'pipeline', 'variable', 'array', 'hashtable', 'object', 'class',
    'error handling', 'exception', 'try catch', 'workflow', 'DSC',
    'remoting', 'WMI', 'CIM', 'REST', 'API', 'JSON', 'XML', 'CSV',
    'Get-', 'Set-', 'New-', 'Remove-', 'Format-', 'ConvertTo-', 'ConvertFrom-',
    'process', 'service', 'event', 'log', 'registry', 'file', 'directory',
    'network', 'security', 'authentication', 'credential', 'certificate'
  ];
  
  // Check for each keyword in the content
  for (const keyword of keywords) {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      // Convert multi-word keywords to kebab-case for tags
      const tag = keyword.toLowerCase().replace(/\s+/g, '-');
      tags.add(tag);
    }
  }
  
  return Array.from(tags);
}

// Run the process
processCrawlResults()
  .then(() => {
    console.log('\nCrawl and import completed successfully');
    // Clean up temporary files
    fs.unlinkSync(outputFile);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
