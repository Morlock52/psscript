// @ts-nocheck - Required for middleware integration and route parameter handling
import express from 'express';
import { documentationController } from '../controllers/DocumentationController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { corsMiddleware } from '../middleware/corsMiddleware';

const router = express.Router();

// Apply CORS middleware to all routes
router.use(corsMiddleware);

/**
 * @swagger
 * /api/documentation:
 *   get:
 *     summary: Get recent documentation entries
 *     description: Returns recent documentation entries sorted by crawl date
 *     tags: [Documentation]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of entries to return
 *     responses:
 *       200:
 *         description: List of documentation entries
 */
router.get('/', documentationController.getRecent);

/**
 * @swagger
 * /api/documentation/search:
 *   get:
 *     summary: Search documentation
 *     description: Search documentation by query, sources, tags, and content types
 *     tags: [Documentation]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: sources
 *         schema:
 *           type: string
 *         description: Comma-separated list of sources
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags
 *       - in: query
 *         name: contentTypes
 *         schema:
 *           type: string
 *         description: Comma-separated list of content types
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, date, title]
 *           default: date
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', documentationController.search);

/**
 * @swagger
 * /api/documentation/sources:
 *   get:
 *     summary: Get available documentation sources
 *     description: Returns all unique documentation sources
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: List of sources
 */
router.get('/sources', documentationController.getSources);

/**
 * @swagger
 * /api/documentation/tags:
 *   get:
 *     summary: Get available tags
 *     description: Returns all unique documentation tags
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: List of tags
 */
router.get('/tags', documentationController.getTags);

/**
 * @swagger
 * /api/documentation/stats:
 *   get:
 *     summary: Get documentation statistics
 *     description: Returns statistics about the documentation database
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Documentation statistics
 */
router.get('/stats', documentationController.getStats);

/**
 * @swagger
 * /api/documentation/{id}:
 *   get:
 *     summary: Get documentation by ID
 *     description: Returns a single documentation entry by ID
 *     tags: [Documentation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Documentation ID
 *     responses:
 *       200:
 *         description: Documentation entry
 *       404:
 *         description: Not found
 */
router.get('/:id', documentationController.getById);

/**
 * @swagger
 * /api/documentation:
 *   post:
 *     summary: Create or update documentation
 *     description: Upsert a documentation entry (requires authentication)
 *     tags: [Documentation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - title
 *             properties:
 *               url:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               summary:
 *                 type: string
 *               source:
 *                 type: string
 *               contentType:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Documentation saved
 *       400:
 *         description: Invalid request
 */
router.post('/', authenticateJWT, documentationController.upsert);

/**
 * @swagger
 * /api/documentation/crawl/mslearn:
 *   post:
 *     summary: Crawl Microsoft Learn documentation
 *     description: Fetch and store documentation from Microsoft Learn
 *     tags: [Documentation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query for Microsoft Learn
 *               maxResults:
 *                 type: integer
 *                 default: 20
 *                 description: Maximum results to fetch
 *     responses:
 *       200:
 *         description: Crawl results
 *       400:
 *         description: Invalid request
 */
router.post('/crawl/mslearn', authenticateJWT, documentationController.crawlMSLearn);

/**
 * @swagger
 * /api/documentation/bulk:
 *   post:
 *     summary: Bulk import documentation
 *     description: Import multiple documentation entries at once
 *     tags: [Documentation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Import results
 *       400:
 *         description: Invalid request
 */
// Note: bulkImport is public to allow the crawl page to save documents
router.post('/bulk', documentationController.bulkImport);

/**
 * @swagger
 * /api/documentation/crawl/ai:
 *   post:
 *     summary: AI-powered web crawl
 *     description: Crawl a URL with AI-generated titles, summaries, and script analysis
 *     tags: [Documentation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL to crawl
 *               maxPages:
 *                 type: integer
 *                 default: 10
 *                 description: Maximum pages to crawl
 *               depth:
 *                 type: integer
 *                 default: 1
 *                 description: How deep to follow links
 *     responses:
 *       200:
 *         description: AI crawl results
 *       400:
 *         description: Invalid request
 */
router.post('/crawl/ai', documentationController.crawlWithAI);

/**
 * @swagger
 * /api/documentation/crawl/ai/start:
 *   post:
 *     summary: Start an AI-powered web crawl job (async)
 *     description: Starts an AI crawl in the background and returns a jobId immediately.
 *     tags: [Documentation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *               maxPages:
 *                 type: integer
 *                 default: 10
 *               depth:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       202:
 *         description: Job accepted
 *       400:
 *         description: Invalid request
 */
router.post('/crawl/ai/start', documentationController.startAICrawlJob);

/**
 * @swagger
 * /api/documentation/crawl/ai/status/{jobId}:
 *   get:
 *     summary: Get AI crawl job status (async)
 *     description: Returns progress and result (when completed) for a given crawl job.
 *     tags: [Documentation]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status
 *       404:
 *         description: Job not found
 */
router.get('/crawl/ai/status/:jobId', documentationController.getAICrawlJobStatus);

/**
 * @swagger
 * /api/documentation/{id}:
 *   delete:
 *     summary: Delete documentation
 *     description: Delete a documentation entry (requires authentication)
 *     tags: [Documentation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Documentation ID
 *     responses:
 *       200:
 *         description: Documentation deleted
 *       404:
 *         description: Not found
 */
router.delete('/:id', documentationController.delete);

export default router;
