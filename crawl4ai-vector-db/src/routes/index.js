const express = require('express');
const router = express.Router();
const webpagesRoutes = require('./webpages');
const searchRoutes = require('./search');
const chatRoutes = require('./chat');

// Register routes
router.use('/webpages', webpagesRoutes);
router.use('/search', searchRoutes);
router.use('/chat', chatRoutes);

// Root route
router.get('/', (req, res) => {
  res.json({
    message: 'Crawl4AI Vector Database API',
    version: '1.0.0',
    endpoints: {
      webpages: '/api/webpages',
      search: '/api/search',
      chat: '/api/chat'
    }
  });
});

module.exports = router;
