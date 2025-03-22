const express = require('express');
const router = express.Router();
const { WebPage } = require('../models');
const { CrawlService } = require('../services');
const crawlService = new CrawlService();

/**
 * @route GET /api/webpages
 * @description Get all webpages
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const webpages = await WebPage.findAll({
      attributes: ['id', 'url', 'title', 'lastCrawled', 'createdAt', 'updatedAt', 'depth', 'crawlStrategy', 'parentId'],
      order: [['lastCrawled', 'DESC']]
    });

    res.json(webpages);
  } catch (error) {
    console.error('Error getting webpages:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route GET /api/webpages/:id
 * @description Get a webpage by ID
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const webpage = await WebPage.findByPk(req.params.id);

    if (!webpage) {
      return res.status(404).json({ message: 'Webpage not found' });
    }

    res.json(webpage);
  } catch (error) {
    console.error(`Error getting webpage ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route GET /api/webpages/:id/children
 * @description Get child pages of a webpage
 * @access Public
 */
router.get('/:id/children', async (req, res) => {
  try {
    const webpage = await WebPage.findByPk(req.params.id);

    if (!webpage) {
      return res.status(404).json({ message: 'Webpage not found' });
    }

    const childPages = await WebPage.findAll({
      where: { parentId: webpage.id },
      attributes: ['id', 'url', 'title', 'lastCrawled', 'depth', 'crawlStrategy', 'relevanceScore'],
      order: [
        ['depth', 'ASC'],
        ['relevanceScore', 'DESC'],
        ['lastCrawled', 'DESC']
      ]
    });

    res.json({
      parentPage: {
        id: webpage.id,
        url: webpage.url,
        title: webpage.title
      },
      childPages
    });
  } catch (error) {
    console.error(`Error getting child pages for webpage ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route POST /api/webpages
 * @description Crawl and store a new webpage
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const { url, deepCrawl, strategy, maxPages, threshold, profile, httpOnly } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Check if URL already exists
    const existingPage = await WebPage.findOne({ where: { url } });

    if (existingPage && !req.body.forceRecrawl) {
      return res.status(400).json({
        message: 'URL already exists',
        webpage: {
          id: existingPage.id,
          url: existingPage.url,
          title: existingPage.title,
          lastCrawled: existingPage.lastCrawled
        }
      });
    }

    // Configure crawl options
    const crawlOptions = {
      forceRecrawl: req.body.forceRecrawl || false,
      deepCrawlEnabled: deepCrawl || false,
      useHttpOnly: httpOnly || false
    };

    // Add deep crawl options if enabled
    if (deepCrawl) {
      crawlOptions.deepCrawlStrategy = strategy || process.env.DEFAULT_DEEP_CRAWL_STRATEGY || 'BFS';
      crawlOptions.maxPages = maxPages || parseInt(process.env.DEFAULT_MAX_PAGES) || 10;
      crawlOptions.scoreThreshold = threshold || parseFloat(process.env.DEFAULT_SCORE_THRESHOLD) || 0.5;
    }

    // Configure browser profile if provided
    if (profile) {
      const path = require('path');
      const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.crawl4ai', 'profiles', profile);
      crawlOptions.userDataDir = userDataDir;
      crawlOptions.usePersistentContext = true;
    }

    // Crawl and store the webpage
    const webpage = await crawlService.crawlAndStore(url, crawlOptions);

    // Prepare response
    const response = {
      message: 'Webpage crawled and stored successfully',
      webpage: {
        id: webpage.id,
        url: webpage.url,
        title: webpage.title,
        lastCrawled: webpage.lastCrawled
      }
    };

    // Add deep crawl info if enabled
    if (deepCrawl) {
      const childCount = await WebPage.count({ where: { parentId: webpage.id } });
      response.deepCrawlInfo = {
        strategy: crawlOptions.deepCrawlStrategy,
        childPagesCount: childCount,
        maxPages: crawlOptions.maxPages
      };
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error crawling webpage:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route PUT /api/webpages/:id/recrawl
 * @description Recrawl and update a webpage
 * @access Public
 */
router.put('/:id/recrawl', async (req, res) => {
  try {
    const webpage = await WebPage.findByPk(req.params.id);

    if (!webpage) {
      return res.status(404).json({ message: 'Webpage not found' });
    }

    // Configure crawl options
    const crawlOptions = {
      deepCrawlEnabled: req.body.deepCrawl || false,
      useHttpOnly: req.body.httpOnly || false
    };

    // Add deep crawl options if enabled
    if (req.body.deepCrawl) {
      crawlOptions.deepCrawlStrategy = req.body.strategy || process.env.DEFAULT_DEEP_CRAWL_STRATEGY || 'BFS';
      crawlOptions.maxPages = req.body.maxPages || parseInt(process.env.DEFAULT_MAX_PAGES) || 10;
      crawlOptions.scoreThreshold = req.body.threshold || parseFloat(process.env.DEFAULT_SCORE_THRESHOLD) || 0.5;
    }

    // Configure browser profile if provided
    if (req.body.profile) {
      const path = require('path');
      const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.crawl4ai', 'profiles', req.body.profile);
      crawlOptions.userDataDir = userDataDir;
      crawlOptions.usePersistentContext = true;
    }

    // Recrawl and update the webpage
    const updatedWebpage = await crawlService.updateWebPage(webpage, crawlOptions);

    // Prepare response
    const response = {
      message: 'Webpage recrawled and updated successfully',
      webpage: {
        id: updatedWebpage.id,
        url: updatedWebpage.url,
        title: updatedWebpage.title,
        lastCrawled: updatedWebpage.lastCrawled
      }
    };

    // Add deep crawl info if enabled
    if (req.body.deepCrawl) {
      const childCount = await WebPage.count({ where: { parentId: updatedWebpage.id } });
      response.deepCrawlInfo = {
        strategy: crawlOptions.deepCrawlStrategy,
        childPagesCount: childCount,
        maxPages: crawlOptions.maxPages
      };
    }

    res.json(response);
  } catch (error) {
    console.error(`Error recrawling webpage ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route DELETE /api/webpages/:id
 * @description Delete a webpage
 * @access Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const webpage = await WebPage.findByPk(req.params.id);

    if (!webpage) {
      return res.status(404).json({ message: 'Webpage not found' });
    }

    // Check if this page has child pages
    const childCount = await WebPage.count({ where: { parentId: webpage.id } });
    
    // If deleteChildren flag is set, delete all child pages
    if (childCount > 0 && req.query.deleteChildren === 'true') {
      await WebPage.destroy({ where: { parentId: webpage.id } });
    } else if (childCount > 0) {
      // If there are child pages and deleteChildren is not set, return an error
      return res.status(400).json({ 
        message: 'Webpage has child pages. Set deleteChildren=true to delete them as well.',
        childCount
      });
    }

    await webpage.destroy();

    res.json({ message: 'Webpage deleted successfully' });
  } catch (error) {
    console.error(`Error deleting webpage ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route POST /api/webpages/batch
 * @description Crawl and store multiple webpages
 * @access Public
 */
router.post('/batch', async (req, res) => {
  try {
    const { urls, deepCrawl, strategy, maxPages, threshold, profile, httpOnly, concurrency } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ message: 'URLs array is required' });
    }

    // Configure crawl options
    const crawlOptions = {
      deepCrawlEnabled: deepCrawl || false,
      useHttpOnly: httpOnly || false,
      concurrency: concurrency || 3
    };

    // Add deep crawl options if enabled
    if (deepCrawl) {
      crawlOptions.deepCrawlStrategy = strategy || process.env.DEFAULT_DEEP_CRAWL_STRATEGY || 'BFS';
      crawlOptions.maxPages = maxPages || parseInt(process.env.DEFAULT_MAX_PAGES) || 10;
      crawlOptions.scoreThreshold = threshold || parseFloat(process.env.DEFAULT_SCORE_THRESHOLD) || 0.5;
    }

    // Configure browser profile if provided
    if (profile) {
      const path = require('path');
      const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.crawl4ai', 'profiles', profile);
      crawlOptions.userDataDir = userDataDir;
      crawlOptions.usePersistentContext = true;
    }

    // Process URLs in batches
    const results = await crawlService.batchCrawlAndStore(urls, crawlOptions);

    // Count child pages if deep crawling was enabled
    let totalChildPages = 0;
    if (deepCrawl) {
      for (const webpage of results) {
        if (webpage && webpage.id) {
          const childCount = await WebPage.count({ where: { parentId: webpage.id } });
          webpage.childPagesCount = childCount;
          totalChildPages += childCount;
        }
      }
    }

    // Prepare response
    const response = {
      message: 'Batch crawl completed',
      totalProcessed: urls.length,
      successCount: results.filter(r => r !== null).length,
      failedCount: results.filter(r => r === null).length,
      results: results.filter(r => r !== null).map(webpage => ({
        id: webpage.id,
        url: webpage.url,
        title: webpage.title,
        childPagesCount: webpage.childPagesCount || 0
      }))
    };

    // Add deep crawl info if enabled
    if (deepCrawl) {
      response.deepCrawlInfo = {
        strategy: crawlOptions.deepCrawlStrategy,
        totalChildPages,
        maxPagesPerUrl: crawlOptions.maxPages
      };
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error in batch crawl:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route GET /api/webpages/tree/:id
 * @description Get a webpage and its child pages as a tree
 * @access Public
 */
router.get('/tree/:id', async (req, res) => {
  try {
    const rootPage = await WebPage.findByPk(req.params.id);

    if (!rootPage) {
      return res.status(404).json({ message: 'Webpage not found' });
    }

    // Function to recursively build the tree
    async function buildTree(pageId, depth = 0, maxDepth = 3) {
      if (depth > maxDepth) {
        return null;
      }

      const page = await WebPage.findByPk(pageId, {
        attributes: ['id', 'url', 'title', 'depth', 'crawlStrategy', 'relevanceScore', 'lastCrawled']
      });

      if (!page) {
        return null;
      }

      const children = await WebPage.findAll({
        where: { parentId: pageId },
        attributes: ['id'],
        order: [
          ['relevanceScore', 'DESC'],
          ['lastCrawled', 'DESC']
        ]
      });

      const childNodes = [];
      for (const child of children) {
        const childNode = await buildTree(child.id, depth + 1, maxDepth);
        if (childNode) {
          childNodes.push(childNode);
        }
      }

      return {
        id: page.id,
        url: page.url,
        title: page.title,
        depth: page.depth,
        relevanceScore: page.relevanceScore,
        childCount: children.length,
        children: childNodes
      };
    }

    // Get max depth from query params or default to 3
    const maxDepth = parseInt(req.query.maxDepth) || 3;
    
    // Build the tree
    const tree = await buildTree(rootPage.id, 0, maxDepth);

    res.json(tree);
  } catch (error) {
    console.error(`Error getting webpage tree for ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
