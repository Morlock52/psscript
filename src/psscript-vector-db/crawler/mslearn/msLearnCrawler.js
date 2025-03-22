/**
 * Microsoft Learn PowerShell documentation crawler
 */

const { crawl } = require('crawl4ai');
const { sequelize } = require('../../config/database');
const { generateEmbedding } = require('../../services/embedding/embeddingService');
require('dotenv').config();

// Get crawler configuration from environment variables
const maxPages = parseInt(process.env.MAX_PAGES || '500', 10);
const crawlStrategy = process.env.CRAWL_STRATEGY || 'breadthFirst';
const crawlDelay = parseInt(process.env.CRAWL_DELAY || '1000', 10);
const userAgent = process.env.USER_AGENT || 'PowerShell Script Vector Database Crawler';

/**
 * Extract content from HTML
 * @param {string} html - HTML content
 * @param {string} title - Page title
 * @returns {string} - Extracted text content
 */
function extractContent(html, title) {
  try {
    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove script and style elements
    const scripts = tempDiv.querySelectorAll('script, style, header, footer, nav');
    scripts.forEach(script => script.remove());
    
    // Get the main content
    let mainContent = '';
    
    // Try to find the main content element
    const mainElement = tempDiv.querySelector('main, article, .content, #content, .main, #main');
    
    if (mainElement) {
      mainContent = mainElement.textContent;
    } else {
      // If no main content element is found, use the body
      mainContent = tempDiv.textContent;
    }
    
    // Clean up the content
    mainContent = mainContent
      .replace(/\s+/g, ' ')
      .trim();
    
    // Add the title at the beginning
    return `${title}\n\n${mainContent}`;
  } catch (error) {
    console.error('Error extracting content:', error);
    return html;
  }
}

/**
 * Generate a summary of the content
 * @param {string} content - Content to summarize
 * @returns {string} - Summary of the content
 */
function generateSummary(content) {
  // Take the first 500 characters as a summary
  return content.substring(0, 500) + (content.length > 500 ? '...' : '');
}

/**
 * Save a page to the database
 * @param {Object} page - Page object from crawl4ai
 * @returns {Promise<void>} - Promise that resolves when the page is saved
 */
async function savePage(page) {
  try {
    // Extract content from HTML
    const content = extractContent(page.html, page.title);
    
    // Generate summary
    const summary = generateSummary(content);
    
    // Generate embedding
    const embedding = await generateEmbedding(content);
    
    // Convert embedding to PostgreSQL vector format
    const vectorString = `[${embedding.join(',')}]`;
    
    // Check if the page already exists
    const [existingPage] = await sequelize.query(`
      SELECT id FROM mslearn_content WHERE url = :url
    `, {
      replacements: { url: page.url },
      type: sequelize.QueryTypes.SELECT
    });
    
    if (existingPage) {
      // Update existing page
      await sequelize.query(`
        UPDATE mslearn_content
        SET 
          title = :title,
          content = :content,
          summary = :summary,
          embedding = :embedding,
          updated_at = NOW()
        WHERE 
          url = :url
      `, {
        replacements: {
          title: page.title,
          content,
          summary,
          embedding: vectorString,
          url: page.url
        },
        type: sequelize.QueryTypes.UPDATE
      });
      
      console.log(`Updated page: ${page.title}`);
    } else {
      // Insert new page
      await sequelize.query(`
        INSERT INTO mslearn_content (
          title,
          url,
          content,
          summary,
          embedding,
          crawled_at,
          updated_at
        ) VALUES (
          :title,
          :url,
          :content,
          :summary,
          :embedding,
          NOW(),
          NOW()
        )
      `, {
        replacements: {
          title: page.title,
          url: page.url,
          content,
          summary,
          embedding: vectorString
        },
        type: sequelize.QueryTypes.INSERT
      });
      
      console.log(`Saved new page: ${page.title}`);
    }
  } catch (error) {
    console.error(`Error saving page ${page.url}:`, error);
  }
}

/**
 * Start the crawler
 * @returns {Promise<void>} - Promise that resolves when the crawler is finished
 */
async function startCrawl() {
  try {
    // Microsoft Learn PowerShell documentation URLs
    const startUrls = [
      'https://learn.microsoft.com/en-us/powershell/scripting/overview',
      'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core',
      'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility',
      'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management'
    ];
    
    // Configure the crawler
    const crawlerConfig = {
      startUrls,
      maxPages,
      crawlStrategy,
      crawlDelay,
      userAgent,
      allowedDomains: ['learn.microsoft.com'],
      shouldCrawl: (url) => {
        return url.includes('/powershell/') && !url.includes('?view=') && !url.includes('#');
      },
      onSuccess: async (page) => {
        console.log(`Successfully crawled: ${page.url}`);
        await savePage(page);
      },
      onError: (error, url) => {
        console.error(`Error crawling ${url}:`, error);
      }
    };
    
    // Start the crawler
    console.log('Starting Microsoft Learn crawler...');
    console.log(`Max pages: ${maxPages}`);
    console.log(`Crawl strategy: ${crawlStrategy}`);
    console.log(`Crawl delay: ${crawlDelay}ms`);
    console.log(`Start URLs: ${startUrls.join(', ')}`);
    
    await crawl(crawlerConfig);
    
    console.log('Crawling completed successfully!');
  } catch (error) {
    console.error('Error starting crawler:', error);
    throw error;
  }
}

module.exports = {
  startCrawl,
  extractContent,
  generateSummary,
  savePage
};
