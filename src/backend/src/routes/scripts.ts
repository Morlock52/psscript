import express from 'express';
import ScriptController from '../controllers/ScriptController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/scripts:
 *   get:
 *     summary: Get all scripts with pagination and filtering
 *     description: Returns a list of scripts with optional filtering and pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page (default 10)
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field (default 'updatedAt')
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *         description: Sort order (default 'DESC')
 *     responses:
 *       200:
 *         description: A list of scripts
 */
router.get('/', ScriptController.getScripts);

/**
 * @swagger
 * /api/scripts/search:
 *   get:
 *     summary: Search scripts
 *     description: Search scripts by keyword and optional filters
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: qualityThreshold
 *         schema:
 *           type: number
 *         description: Minimum code quality score
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page (default 10)
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', ScriptController.searchScripts);

/**
 * @swagger
 * /api/scripts/{id}:
 *   get:
 *     summary: Get a script by ID
 *     description: Returns detailed information about a specific script
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     responses:
 *       200:
 *         description: Script details
 *       404:
 *         description: Script not found
 */
router.get('/:id', ScriptController.getScript);

/**
 * @swagger
 * /api/scripts:
 *   post:
 *     summary: Create a new script
 *     description: Creates a new script with optional AI analysis
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: string
 *               categoryId:
 *                 type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Created script
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateJWT, ScriptController.createScript);

/**
 * @swagger
 * /api/scripts/{id}:
 *   put:
 *     summary: Update a script
 *     description: Updates an existing script
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: string
 *               categoryId:
 *                 type: integer
 *               isPublic:
 *                 type: boolean
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated script
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Script not found
 */
router.put('/:id', authenticateJWT, ScriptController.updateScript);

/**
 * @swagger
 * /api/scripts/{id}:
 *   delete:
 *     summary: Delete a script
 *     description: Deletes an existing script
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     responses:
 *       200:
 *         description: Deletion confirmation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Script not found
 */
router.delete('/:id', authenticateJWT, ScriptController.deleteScript);

/**
 * @swagger
 * /api/scripts/{id}/analysis:
 *   get:
 *     summary: Get script analysis
 *     description: Returns the AI analysis for a script
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     responses:
 *       200:
 *         description: Script analysis
 *       404:
 *         description: Analysis not found
 */
router.get('/:id/analysis', ScriptController.getScriptAnalysis);

/**
 * @swagger
 * /api/scripts/{id}/execute:
 *   post:
 *     summary: Execute a script
 *     description: Executes a script with optional parameters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               params:
 *                 type: object
 *     responses:
 *       200:
 *         description: Execution results
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Script not found
 */
router.post('/:id/execute', authenticateJWT, ScriptController.executeScript);

/**
 * @swagger
 * /api/scripts/{id}/similar:
 *   get:
 *     summary: Find similar scripts
 *     description: Returns scripts similar to the specified script
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     responses:
 *       200:
 *         description: Similar scripts
 */
router.get('/:id/similar', ScriptController.findSimilarScripts);

/**
 * @swagger
 * /api/scripts/analyze:
 *   post:
 *     summary: Analyze a script without saving
 *     description: Returns AI analysis for a script without storing it
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Script analysis
 *       400:
 *         description: Bad request
 */
router.post('/analyze', ScriptController.analyzeScript);

export default router;