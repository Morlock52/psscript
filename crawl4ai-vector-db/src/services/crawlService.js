const { 
  AsyncWebCrawler, 
  BrowserConfig, 
  CrawlerRunConfig, 
  CacheMode, 
  DeepCrawlConfig,
  DeepCrawlStrategy,
  AsyncHTTPCrawlerStrategy,
  AsyncPlaywrightCrawlerStrategy,
  RoundRobinProxyStrategy
} = require('crawl4ai');
const { WebPage, ContentChunk } = require('../models');
const EmbeddingService = require('./embeddingService');
const ChunkingService = require('./chunkingService');

/**
 * Service for crawling web pages and storing them in the database
 */
class CrawlService {
  constructor(options = {}) {
    this.browserConfig = options.browserConfig || new BrowserConfig({
      headless: true,
      verbose: false,
      // Support for persistent browser profiles
      user_data_dir: options.userDataDir || null,
      use_persistent_context: options.usePersistentContext || false
    });
    
    // Default to Playwright crawler strategy
    this.crawlerStrategy = options.crawlerStrategy || new AsyncPlaywrightCrawlerStrategy();
    
    // Configure proxy rotation if provided
    if (options.proxies && options.proxies.length > 0) {
      this.proxyStrategy = new RoundRobinProxyStrategy(options.proxies);
      this.browserConfig.proxy = this.proxyStrategy.getNextProxy();
    }
    
    this.crawlerConfig = options.crawlerConfig || new CrawlerRunConfig({
      cache_mode: CacheMode.ENABLED,
      // Support for robots.txt compliance
      respect_robots_txt: options.respectRobotsTxt || true
    });
    
    // Configure deep crawling if enabled
    this.deepCrawlEnabled = options.deepCrawlEnabled || false;
    if (this.deepCrawlEnabled) {
      this.deepCrawlConfig = new DeepCrawlConfig({
        strategy: options.deepCrawlStrategy || DeepCrawlStrategy.BFS,
        max_pages: options.maxPages || 10,
        score_threshold: options.scoreThreshold || 0.5
      });
    }
    
    this.embeddingService = options.embeddingService || new EmbeddingService();
    this.chunkingService = options.chunkingService || new ChunkingService();
  }

  /**
   * Crawl a URL and store the content in the database
   * @param {string} url - URL to crawl
   * @param {Object} options - Additional crawl options
   * @returns {Promise<Object>} - Crawled webpage data
   */
  async crawlAndStore(url, options = {}) {
    try {
      // Check if URL already exists in database
      const existingPage = await WebPage.findOne({ where: { url } });
      
      if (existingPage && !options.forceRecrawl) {
        console.log(`URL ${url} already exists in database. Updating...`);
        return this.updateWebPage(existingPage, options);
      }
      
      // Crawl the URL
      const result = await this.crawlUrl(url, options);
      
      // Store the primary webpage
      const webpage = await WebPage.create({
        url: result.url,
        title: result.title,
        content: result.content,
        markdown: result.markdown,
        metadata: result.metadata,
        lastCrawled: new Date()
      });
      
      // Create chunks and store them
      await this.processAndStoreChunks(webpage);
      
      // Process additional pages if deep crawling was used
      if (this.deepCrawlEnabled && result.additionalPages && result.additionalPages.length > 0) {
        console.log(`Processing ${result.additionalPages.length} additional pages from deep crawl`);
        
        const additionalPagePromises = result.additionalPages.map(async (page) => {
          try {
            // Check if page already exists
            const existingAdditionalPage = await WebPage.findOne({ where: { url: page.url } });
            if (existingAdditionalPage) {
              return null;
            }
            
            // Store the additional webpage
            const additionalWebpage = await WebPage.create({
              url: page.url,
              title: page.title || '',
              content: page.content || '',
              markdown: page.markdown || '',
              metadata: page.metadata || {},
              lastCrawled: new Date(),
              parentUrl: url
            });
            
            // Create chunks for the additional page
            await this.processAndStoreChunks(additionalWebpage);
            
            return additionalWebpage;
          } catch (error) {
            console.error(`Error processing additional page ${page.url}:`, error);
            return null;
          }
        });
        
        await Promise.all(additionalPagePromises);
      }
      
      return webpage;
    } catch (error) {
      console.error(`Error crawling and storing ${url}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing webpage in the database
   * @param {Object} webpage - Existing webpage record
   * @param {Object} options - Additional crawl options
   * @returns {Promise<Object>} - Updated webpage data
   */
  async updateWebPage(webpage, options = {}) {
    try {
      // Crawl the URL
      const result = await this.crawlUrl(webpage.url, options);
      
      // Update the webpage
      webpage.title = result.title;
      webpage.content = result.content;
      webpage.markdown = result.markdown;
      webpage.metadata = result.metadata;
      webpage.lastCrawled = new Date();
      
      await webpage.save();
      
      // Delete existing chunks
      await ContentChunk.destroy({ where: { webPageId: webpage.id } });
      
      // Create new chunks and store them
      await this.processAndStoreChunks(webpage);
      
      return webpage;
    } catch (error) {
      console.error(`Error updating webpage ${webpage.url}:`, error);
      throw error;
    }
  }

  /**
   * Crawl a URL using crawl4ai
   * @param {string} url - URL to crawl
   * @param {Object} options - Additional crawl options
   * @returns {Promise<Object>} - Crawled data
   */
  async crawlUrl(url, options = {}) {
    try {
      // Apply any custom options
      const browserConfig = { ...this.browserConfig };
      const crawlerConfig = { ...this.crawlerConfig };
      
      // Update proxy if using rotation
      if (this.proxyStrategy) {
        browserConfig.proxy = this.proxyStrategy.getNextProxy();
      }
      
      // Apply custom JavaScript if provided
      if (options.jsCode) {
        crawlerConfig.js_code = Array.isArray(options.jsCode) ? options.jsCode : [options.jsCode];
      }
      
      // Apply LLM extraction if provided
      if (options.extractionSchema) {
        crawlerConfig.extraction_strategy = options.extractionStrategy;
      }
      
      // Create crawler with appropriate strategy
      const crawler = new AsyncWebCrawler({
        config: browserConfig,
        strategy: options.useHttpOnly ? new AsyncHTTPCrawlerStrategy() : this.crawlerStrategy
      });
      
      try {
        let result;
        
        // Use deep crawling if enabled
        if (this.deepCrawlEnabled && !options.skipDeepCrawl) {
          result = await crawler.deep_crawl(url, this.deepCrawlConfig, crawlerConfig);
          
          // Format the result to include additional pages
          const mainPage = result.pages[0];
          const additionalPages = result.pages.slice(1);
          
          return {
            url: url,
            title: mainPage.metadata.title || '',
            content: mainPage.extracted_content || '',
            markdown: mainPage.markdown.raw_markdown || '',
            metadata: mainPage.metadata || {},
            additionalPages: additionalPages.map(page => ({
              url: page.url,
              title: page.metadata.title || '',
              content: page.extracted_content || '',
              markdown: page.markdown.raw_markdown || '',
              metadata: page.metadata || {}
            }))
          };
        } else {
          // Regular single page crawl
          result = await crawler.arun(url, crawlerConfig);
          
          return {
            url: url,
            title: result.metadata.title || '',
            content: result.extracted_content || '',
            markdown: result.markdown.raw_markdown || '',
            metadata: result.metadata || {}
          };
        }
      } finally {
        await crawler.close();
      }
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      throw error;
    }
  }

  /**
   * Process webpage content into chunks and store them with embeddings
   * @param {Object} webpage - Webpage record
   * @returns {Promise<void>}
   */
  async processAndStoreChunks(webpage) {
    try {
      // Create chunks
      const chunks = this.chunkingService.createWebpageChunks(webpage);
      
      if (chunks.length === 0) {
        console.warn(`No chunks created for ${webpage.url}`);
        return;
      }
      
      // Generate embeddings for all chunks
      const chunkTexts = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);
      
      // Store chunks with embeddings
      const chunkPromises = chunks.map((chunk, index) => {
        return ContentChunk.create({
          webPageId: webpage.id,
          content: chunk.content,
          embedding: embeddings[index],
          metadata: chunk.metadata,
          chunkIndex: chunk.chunkIndex
        });
      });
      
      await Promise.all(chunkPromises);
      
      console.log(`Stored ${chunks.length} chunks for ${webpage.url}`);
    } catch (error) {
      console.error(`Error processing chunks for ${webpage.url}:`, error);
      throw error;
    }
  }
  
  /**
   * Crawl multiple URLs and store them in the database
   * @param {string[]} urls - Array of URLs to crawl
   * @param {Object} options - Additional crawl options
   * @returns {Promise<Object[]>} - Array of crawled webpage data
   */
  async batchCrawlAndStore(urls, options = {}) {
    const results = [];
    const concurrency = options.concurrency || 3;
    
    // Process URLs in batches to control concurrency
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchPromises = batch.map(url => this.crawlAndStore(url, options)
        .then(result => {
          results.push(result);
          return result;
        })
        .catch(error => {
          console.error(`Error in batch crawl for ${url}:`, error);
          return null;
        })
      );
      
      await Promise.all(batchPromises);
    }
    
    return results.filter(result => result !== null);
  }
}

module.exports = CrawlService;
