const express = require('express');
const router = express.Router();
const { SearchService } = require('../services');
const searchService = new SearchService();

/**
 * @route POST /api/search
 * @description Search for content similar to a query
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit, threshold } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    const options = {};
    
    if (limit) options.limit = parseInt(limit);
    if (threshold) options.threshold = parseFloat(threshold);
    
    const results = await searchService.search(query, options);
    
    res.json({
      query,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error searching for content:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route POST /api/search/keywords
 * @description Search for content with keyword filtering
 * @access Public
 */
router.post('/keywords', async (req, res) => {
  try {
    const { query, keywords, limit, threshold } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    if (!keywords) {
      return res.status(400).json({ message: 'Keywords are required' });
    }
    
    const options = {};
    
    if (limit) options.limit = parseInt(limit);
    if (threshold) options.threshold = parseFloat(threshold);
    
    const results = await searchService.searchWithKeywords(query, keywords, options);
    
    res.json({
      query,
      keywords,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error searching with keywords:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route GET /api/search/related/:chunkId
 * @description Get related content chunks
 * @access Public
 */
router.get('/related/:chunkId', async (req, res) => {
  try {
    const { chunkId } = req.params;
    const { limit } = req.query;
    
    const limitValue = limit ? parseInt(limit) : 5;
    
    const relatedChunks = await searchService.getRelatedChunks(chunkId, limitValue);
    
    res.json({
      chunkId,
      count: relatedChunks.length,
      results: relatedChunks
    });
  } catch (error) {
    console.error(`Error getting related chunks for ${req.params.chunkId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
