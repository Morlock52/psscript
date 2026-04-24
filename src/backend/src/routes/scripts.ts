// Request type extensions are in src/types/express.d.ts
import express from 'express';
import { body, param } from 'express-validator';
// New modular controllers (migrated from legacy ScriptController)
import {
  ScriptCrudController,
  ScriptSearchController,
  ScriptAnalysisController,
  ScriptExecutionController,
  ScriptVersionController,
  ScriptExportController
} from '../controllers/script';
import { authenticateJWT, requireAdmin } from '../middleware/authMiddleware';
import upload, { handleMulterError, diskUpload, handleUploadProgress } from '../middleware/uploadMiddleware';
import { corsMiddleware, uploadCorsMiddleware } from '../middleware/corsMiddleware';
import { sequelize } from '../database/connection';
import { Script, ScriptAnalysis, ScriptTag, ScriptVersion, ExecutionLog } from '../models';
import { cache } from '../services/cacheService';
import { handleNetworkErrors } from '../middleware/networkErrorMiddleware';
import AsyncUploadController from '../controllers/AsyncUploadController';
import { generatePowerShellScript } from '../services/agentic/tools/ScriptGenerator';
import axios from 'axios';
import logger from '../utils/logger';

function normalizeScriptIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  const parsed = ids
    .map(id => Number.parseInt(String(id), 10))
    .filter((id) => Number.isFinite(id) && Number.isInteger(id) && id > 0);

  return [...new Set(parsed)];
}

function buildSuggestionContentBlock(suggestions: string[]): string {
  const lines = suggestions
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `# - ${item}`);

  if (lines.length === 0) {
    return '';
  }

  return [``, `# AI Suggestions`, `# ------------`, ...lines, ``].join('\n');
}

const router = express.Router();

// Apply CORS middleware to all routes
router.use(corsMiddleware);

const isDocker = process.env.DOCKER_ENV === 'true';
const AI_SERVICE_URL = isDocker
  ? (process.env.AI_SERVICE_URL || 'http://ai-service:8000')
  : (process.env.AI_SERVICE_URL || 'http://localhost:8000');
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 15000);

function buildAiFailure(error: unknown, unavailableMessage: string) {
  if (axios.isAxiosError(error) && error.response) {
    return {
      status: 502,
      body: {
        message: 'AI service returned an error',
        error: 'ai_service_error',
        upstreamStatus: error.response.status
      }
    };
  }

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
  if ((axios.isAxiosError(error) && error.code === 'ECONNABORTED') || errorMessage.includes('timeout')) {
    return {
      status: 504,
      body: {
        message: 'AI service request timed out',
        error: 'ai_service_timeout'
      }
    };
  }

  return {
    status: 503,
    body: {
      message: unavailableMessage,
      error: 'ai_service_unavailable'
    }
  };
}

/**
 * @swagger
 * /api/scripts/upload/async:
 *   post:
 *     summary: Upload files asynchronously
 *     description: Upload files for async processing with queuing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       202:
 *         description: Files uploaded and queued for processing
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/upload/async', uploadCorsMiddleware, authenticateJWT, AsyncUploadController.uploadFiles);

/**
 * @swagger
 * /api/scripts/upload/status/{uploadId}:
 *   get:
 *     summary: Get upload status
 *     description: Check the status of an asynchronous upload
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Upload ID
 *     responses:
 *       200:
 *         description: Upload status
 *       404:
 *         description: Upload not found
 */
router.get('/upload/status/:uploadId', AsyncUploadController.getUploadStatus);

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
router.get('/', authenticateJWT, ScriptCrudController.getScripts);

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
router.get('/search', authenticateJWT, ScriptSearchController.searchScripts);

/**
 * @swagger
 * /api/scripts/clear-cache:
 *   get:
 *     summary: Clear scripts cache
 *     description: Clears the in-memory cache for scripts to ensure fresh data
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.get('/clear-cache', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { cache } = await import('../index');
    const count = cache.clearPattern('scripts:');
    res.status(200).json({
      message: 'Scripts cache cleared successfully',
      entriesRemoved: count
    });
  } catch (error) {
    console.error('Error clearing scripts cache:', error);
    res.status(500).json({ message: 'Failed to clear cache' });
  }
});

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
router.get('/:id', authenticateJWT, ScriptCrudController.getScript);

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
// Route for handling JSON uploads
const scriptValidation = [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required (1-100 characters)'),
  body('content').notEmpty().withMessage('Script content is required'),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid category ID'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Tags must be an array (max 10)'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each tag must be 1-50 characters'),
];
router.post('/', authenticateJWT, scriptValidation, ScriptCrudController.createScript);

/**
 * @swagger
 * /api/scripts/upload:
 *   post:
 *     summary: Upload a PowerShell script file
 *     description: Upload a PowerShell script file with metadata
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - script_file
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               script_file:
 *                 type: string
 *                 format: binary
 *               category_id:
 *                 type: string
 *               tags:
 *                 type: string
 *               is_public:
 *                 type: string
 *               analyze_with_ai:
 *                 type: string
 *     responses:
 *       201:
 *         description: Script uploaded successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
// Use special CORS middleware and network error handling for upload endpoints
router.post('/upload', uploadCorsMiddleware, authenticateJWT, handleNetworkErrors, handleUploadProgress, upload.single('script_file'), handleMulterError, ScriptExportController.uploadScript);

/**
 * @swagger
 * /api/scripts/upload/large:
 *   post:
 *     summary: Upload a large PowerShell script file
 *     description: Upload a large PowerShell script file (up to 10MB) with metadata
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - script_file
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               script_file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Script uploaded successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
// Use special CORS middleware and network error handling for large upload endpoint as well
router.post('/upload/large', uploadCorsMiddleware, authenticateJWT, handleNetworkErrors, handleUploadProgress, diskUpload.single('script_file'), handleMulterError, ScriptExportController.uploadScript);

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
const scriptUpdateValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid script ID'),
  body('title').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('content').optional().notEmpty().withMessage('Content cannot be empty'),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid category ID'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Tags must be an array (max 10)'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
];
router.put('/:id', authenticateJWT, scriptUpdateValidation, ScriptCrudController.updateScript);

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
router.delete('/:id', authenticateJWT, ScriptCrudController.deleteScript);

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
router.get('/:id/analysis', ScriptAnalysisController.getScriptAnalysis);

/**
 * @swagger
 * /api/scripts/{id}/export-analysis:
 *   get:
 *     summary: Export script analysis as PDF
 *     description: Generates and downloads a formatted PDF with script content and AI analysis
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Script not found
 */
router.get('/:id/export-analysis', ScriptExportController.exportAnalysis);

/**
 * @swagger
 * /api/scripts/{id}/analyze:
 *   post:
 *     summary: Analyze a script and save the analysis
 *     description: Analyzes a script with AI and saves the analysis to the database
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
 *         description: Script analysis
 *       400:
 *         description: Bad request
 *       404:
 *         description: Script not found
 */
router.post('/:id/analyze', authenticateJWT, ScriptAnalysisController.analyzeScriptAndSave);

/**
 * @swagger
 * /api/scripts/{id}/analyze-langgraph:
 *   post:
 *     summary: Analyze script using LangGraph orchestrator
 *     description: Analyzes a script using the LangGraph 1.0 production orchestrator with multi-agent system
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
 *               require_human_review:
 *                 type: boolean
 *                 description: Whether to require human review during analysis
 *               thread_id:
 *                 type: string
 *                 description: Thread ID for continuing previous analysis
 *               model:
 *                 type: string
 *                 description: AI model to use (default gpt-4)
 *     responses:
 *       200:
 *         description: LangGraph analysis results
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Script not found
 *       503:
 *         description: AI service unavailable
 */
router.post('/:id/analyze-langgraph', authenticateJWT, ScriptAnalysisController.analyzeLangGraph);

/**
 * @swagger
 * /api/scripts/{id}/analysis-stream:
 *   get:
 *     summary: Stream analysis progress in real-time
 *     description: Returns a Server-Sent Events stream of analysis progress
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *       - in: query
 *         name: require_human_review
 *         schema:
 *           type: boolean
 *         description: Whether to require human review
 *       - in: query
 *         name: thread_id
 *         schema:
 *           type: string
 *         description: Thread ID for session continuity
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: AI model to use
 *     responses:
 *       200:
 *         description: SSE stream of analysis events
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Script not found
 */
router.get('/:id/analysis-stream', authenticateJWT, ScriptAnalysisController.streamAnalysis);

/**
 * @swagger
 * /api/scripts/{id}/provide-feedback:
 *   post:
 *     summary: Provide human feedback for paused workflow
 *     description: Continues a paused LangGraph workflow with human feedback
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
 *             required:
 *               - thread_id
 *               - feedback
 *             properties:
 *               thread_id:
 *                 type: string
 *                 description: Thread ID of the paused workflow
 *               feedback:
 *                 type: string
 *                 description: Human feedback text
 *     responses:
 *       200:
 *         description: Updated analysis after feedback
 *       400:
 *         description: Missing required parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Script or workflow not found
 */
router.post('/:id/provide-feedback', authenticateJWT, ScriptAnalysisController.provideFeedback);

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
router.post('/:id/execute', authenticateJWT, ScriptExecutionController.executeScript);

/**
 * @swagger
 * /api/scripts/{id}/execution-history:
 *   get:
 *     summary: Get execution history for a script
 *     description: Returns the execution history with pagination
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of records to return (default 10)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of records to skip (default 0)
 *     responses:
 *       200:
 *         description: Execution history
 *       404:
 *         description: Script not found
 */
router.get('/:id/execution-history', authenticateJWT, ScriptExecutionController.getExecutionHistory);

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
router.get('/:id/similar', authenticateJWT, ScriptSearchController.findSimilarScripts);

// ===== VERSION CONTROL ROUTES =====

/**
 * @swagger
 * /api/scripts/{id}/versions:
 *   get:
 *     summary: Get version history for a script
 *     description: Returns all versions of a script with changelog and metadata
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *     responses:
 *       200:
 *         description: Version history
 *       404:
 *         description: Script not found
 */
router.get('/:id/versions', ScriptVersionController.getVersionHistory);

/**
 * @swagger
 * /api/scripts/{id}/versions/compare:
 *   get:
 *     summary: Compare two versions of a script
 *     description: Returns a diff between two versions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: integer
 *         description: Source version number
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target version number
 *     responses:
 *       200:
 *         description: Version comparison diff
 *       404:
 *         description: Version not found
 */
router.get('/:id/versions/compare', ScriptVersionController.compareVersions);

/**
 * @swagger
 * /api/scripts/{id}/versions/{versionNumber}:
 *   get:
 *     summary: Get a specific version of a script
 *     description: Returns the content and metadata for a specific version
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *       - in: path
 *         name: versionNumber
 *         required: true
 *         schema:
 *           type: integer
 *         description: Version number
 *     responses:
 *       200:
 *         description: Version details
 *       404:
 *         description: Version not found
 */
router.get('/:id/versions/:versionNumber', ScriptVersionController.getVersion);

/**
 * @swagger
 * /api/scripts/{id}/revert/{versionNumber}:
 *   post:
 *     summary: Revert script to a previous version
 *     description: Creates a new version with the content from a previous version
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Script ID
 *       - in: path
 *         name: versionNumber
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target version to revert to
 *     responses:
 *       200:
 *         description: Revert successful
 *       400:
 *         description: Already at this version
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Version not found
 */
router.post('/:id/revert/:versionNumber', authenticateJWT, ScriptVersionController.revertToVersion);

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
router.post('/analyze', ScriptAnalysisController.analyzeScript);

/**
 * @swagger
 * /api/scripts/delete:
 *   post:
 *     summary: Delete multiple scripts
 *     description: Deletes multiple scripts by their IDs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Deletion confirmation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: One or more scripts not found
 */
router.post('/delete', authenticateJWT, async (req, res) => {
  let transaction;
  try {
    const { ids } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Invalid request: ids array is required' });
    }
    
    // Start a transaction to ensure atomicity
    transaction = await sequelize.transaction();
    
    // First, verify ownership of all scripts to be deleted
    const scripts = await Script.findAll({
      where: { id: ids }
    });
    
    // Check if all scripts exist
    if (scripts.length !== ids.length) {
      const foundIds = scripts.map(script => script.id);
      const missingIds = ids.filter(id => !foundIds.includes(parseInt(id)));
      await transaction.rollback();
      return res.status(404).json({ 
        message: 'One or more scripts not found',
        missingIds
      });
    }
    
    // Check ownership unless admin
    if (!isAdmin) {
      const unauthorizedScripts = scripts.filter(script => script.userId !== userId);
      if (unauthorizedScripts.length > 0) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'Not authorized to delete one or more scripts',
          unauthorizedIds: unauthorizedScripts.map(script => script.id)
        });
      }
    }
    
    // Process deletion for each script
    for (const script of scripts) {
      const scriptId = script.id;
      
      // 1. Delete script analysis
      await ScriptAnalysis.destroy({
        where: { scriptId },
        transaction
      });
      
      // 2. Delete script tags
      await ScriptTag.destroy({
        where: { scriptId },
        transaction
      });
      
      // 3. Delete script versions
      await ScriptVersion.destroy({
        where: { scriptId },
        transaction
      });
      
      // 4. Delete execution logs
      await ExecutionLog.destroy({
        where: { scriptId },
        transaction
      });
      
      // 5. Delete the script itself
      await script.destroy({ transaction });
      
      // Clear relevant caches
      cache.del(`script:${scriptId}`);
    }
    
    // Commit the transaction
    await transaction.commit();
    
    // Clear scripts cache
    cache.clearPattern('scripts:');
    
    return res.status(200).json({ 
      message: 'All scripts deleted successfully',
      ids,
      success: true
    });
  } catch (error) {
    // Rollback transaction if there was an error
    if (transaction) await transaction.rollback();
    
    console.error('Error in bulk delete scripts:', error);
    return res.status(500).json({ 
      message: 'An error occurred while deleting scripts', 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/scripts/bulk-update:
 *   post:
 *     summary: Bulk update scripts
 *     description: Update common fields across multiple scripts in one request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *               - isPublic
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Bulk update confirmation
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/bulk-update', authenticateJWT, async (req, res) => {
  let transaction;

  try {
    const { isPublic } = req.body || {};
    const ids = normalizeScriptIds(req.body?.ids);
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!ids.length) {
      return res.status(400).json({
        message: 'Invalid request: ids array is required',
        success: false
      });
    }

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({
        message: 'Invalid request: isPublic must be a boolean',
        success: false
      });
    }

    transaction = await sequelize.transaction();

    const scripts = await Script.findAll({
      where: { id: ids },
      transaction
    });

    if (scripts.length !== ids.length) {
      const foundIds = scripts.map(script => script.id);
      const missingIds = ids.filter(id => !foundIds.includes(id));

      await transaction.rollback();
      return res.status(404).json({
        message: 'One or more scripts not found',
        missingIds,
        success: false
      });
    }

    if (!isAdmin) {
      const unauthorizedScripts = scripts.filter(script => script.userId !== userId);
      if (unauthorizedScripts.length > 0) {
        await transaction.rollback();
        return res.status(403).json({
          message: 'Not authorized to update one or more scripts',
          unauthorizedIds: unauthorizedScripts.map(script => script.id),
          success: false
        });
      }
    }

    await Script.update(
      { isPublic },
      {
        where: { id: ids },
        transaction
      }
    );

    await transaction.commit();

    scripts.forEach(script => {
      cache.del(`script:${script.id}`);
    });
    cache.clearPattern('scripts:');

    return res.status(200).json({
      message: 'Scripts updated successfully',
      ids,
      isPublic,
      success: true
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error('Error in bulk update scripts:', error);
    return res.status(500).json({
      message: 'An error occurred while updating scripts',
      error: error.message,
      success: false
    });
  }
});

/**
 * @swagger
 * /api/scripts/{id}/apply-suggestions:
 *   post:
 *     summary: Apply AI suggestions to a script
 *     description: Appends AI suggestions as comments and marks the script as updated
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - suggestions
 *             properties:
 *               suggestions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Suggestions applied
 *       400:
 *         description: Invalid request
 */
router.post('/:id/apply-suggestions', authenticateJWT, async (req, res) => {
  let transaction;

  try {
    const scriptId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(scriptId) || scriptId <= 0) {
      return res.status(400).json({ message: 'Invalid script id', success: false });
    }

    const suggestions: string[] = Array.isArray(req.body?.suggestions)
      ? req.body.suggestions.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : [];

    if (suggestions.length === 0) {
      return res.status(400).json({ message: 'No suggestions provided', success: false });
    }

    transaction = await sequelize.transaction();

    const script = await Script.findByPk(scriptId, { transaction });
    if (!script) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Script not found', success: false });
    }

    if (!req.user || !req.user.id) {
      await transaction.rollback();
      return res.status(401).json({ message: 'Unauthorized', success: false });
    }

    if (script.userId !== req.user.id && req.user.role !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({ message: 'Not authorized to update this script', success: false });
    }

    const uniqueSuggestions = [...new Set(suggestions)];
    const suggestionBlock = buildSuggestionContentBlock(uniqueSuggestions);
    const currentContent = typeof script.content === 'string' ? script.content : '';
    const updatedContent = `${currentContent.trimEnd()}${suggestionBlock}`;

    await script.update({
      content: updatedContent,
      version: script.version + 1
    }, { transaction });

    const analysis = await ScriptAnalysis.findOne({
      where: { scriptId },
      transaction
    });

    if (analysis) {
      const existingSuggestions = Array.isArray((analysis as any).optimizationSuggestions)
        ? (analysis as any).optimizationSuggestions as string[]
        : [];
      const nextSuggestions = [...new Set([...(existingSuggestions || []), ...uniqueSuggestions])];

      await analysis.update({
        optimizationSuggestions: nextSuggestions
      }, { transaction });
    }

    await transaction.commit();

    cache.del(`script:${script.id}`);
    cache.clearPattern('scripts:');

    return res.status(200).json({
      message: 'Suggestions applied successfully',
      scriptId,
      suggestions: uniqueSuggestions,
      success: true
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error('Error applying suggestions:', error);
    return res.status(500).json({
      message: 'Failed to apply suggestions',
      success: false
    });
  }
});

// Add new endpoint for AI script generation
/**
 * @swagger
 * /api/scripts/generate:
 *   post:
 *     summary: Generate a PowerShell script using AI
 *     description: Uses the AI service to generate PowerShell scripts based on a description
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 description: Description of the script to generate
 *     responses:
 *       200:
 *         description: Successfully generated script
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                   description: Generated script content
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/generate', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({
        message: 'Description is required',
        status: 'error'
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({
        message: 'AI service not configured. Please contact administrator.',
        status: 'error'
      });
    }

    console.log(`Generating PowerShell script for: ${description.substring(0, 50)}...`);

    // Use the real AI generator
    const scriptContent = await generatePowerShellScript(description);

    console.log('Script generated successfully');
    res.json({ content: scriptContent });
  } catch (error) {
    console.error('Error generating script:', error);
    res.status(500).json({
      message: 'Failed to generate script',
      status: 'error',
      error: error.message
    });
  }
});

// Add a new route for analyzing scripts with OpenAI Assistant
router.post('/analyze/assistant', authenticateJWT, ScriptAnalysisController.analyzeScriptWithAssistant);

/**
 * Endpoint to handle AI assistant question answering
 */
router.post('/please', async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question) {
      return res.status(400).json({
        message: 'Question is required',
        status: 'error'
      });
    }

    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/chat`, {
        messages: [
          ...(context ? [{ role: 'system', content: `Context: ${context}` }] : []),
          { role: 'user', content: question }
        ]
      }, {
        timeout: AI_REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      });

      const response = aiResponse.data.response || aiResponse.data.message || aiResponse.data;
      return res.json({
        response: typeof response === 'string' ? response : JSON.stringify(response),
        source: 'ai_service'
      });
    } catch (aiError) {
      logger.warn(`AI service unavailable for legacy /scripts/please: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
      const failure = buildAiFailure(aiError, 'AI service is unavailable');
      return res.status(failure.status).json(failure.body);
    }
  } catch (error) {
    console.error('Error in AI agent question endpoint:', error);
    return res.status(500).json({
      message: 'Failed to process your question',
      status: 'error'
    });
  }
});

/**
 * Explain a PowerShell script or command
 */
router.post('/explain', async (req, res) => {
  try {
    const { content, type = 'simple' } = req.body;

    if (!content) {
      return res.status(400).json({
        message: 'Script content is required',
        status: 'error'
      });
    }

    try {
      let systemPrompt = 'You are a PowerShell expert. Explain the following script in a clear, educational manner.';
      if (type === 'detailed') {
        systemPrompt = 'You are a PowerShell expert. Provide a detailed line-by-line explanation of this script, including its purpose, structure, and how each component works.';
      } else if (type === 'security') {
        systemPrompt = 'You are a security-focused PowerShell expert. Analyze this script for security implications, potential vulnerabilities, and best practices. Include warnings for dangerous patterns.';
      }

      const aiResponse = await axios.post(`${AI_SERVICE_URL}/chat`, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Explain this PowerShell script:

${content}` }
        ]
      }, {
        timeout: AI_REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      });

      const explanation = aiResponse.data.response || aiResponse.data.message || aiResponse.data;
      return res.json({
        explanation: typeof explanation === 'string' ? explanation : JSON.stringify(explanation),
        source: 'ai_service'
      });
    } catch (aiError) {
      logger.warn(`AI service unavailable for legacy /scripts/explain: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
      const failure = buildAiFailure(aiError, 'AI service is unavailable');
      return res.status(failure.status).json(failure.body);
    }
  } catch (error) {
    console.error('Error in script explanation endpoint:', error);
    return res.status(500).json({
      message: 'Failed to explain the script',
      status: 'error'
    });
  }
});

/**
 * Get examples of similar scripts
 */
router.get('/examples', async (req, res) => {
  try {
    const { description, limit = 10 } = req.query;

    if (!description) {
      return res.status(400).json({
        message: 'Description is required',
        status: 'error'
      });
    }

    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/chat`, {
        messages: [
          {
            role: 'system',
            content: `You are a PowerShell expert. Provide ${limit} relevant PowerShell script examples as a JSON array. Each example should have: title, snippet (complete working script), and complexity (Low/Medium/High).`
          },
          {
            role: 'user',
            content: `Give me ${limit} PowerShell script examples related to: ${description}`
          }
        ]
      }, {
        timeout: AI_REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      });

      const response = aiResponse.data.response || aiResponse.data.message || aiResponse.data;
      let examples;

      try {
        const jsonMatch = typeof response === 'string' ? response.match(/\[[\s\S]*\]/) : null;
        if (jsonMatch) {
          examples = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch {
        examples = [{
          id: `ex_${Date.now().toString(36)}_0`,
          title: `Example for: ${description}`,
          snippet: typeof response === 'string' ? response : JSON.stringify(response),
          complexity: 'Medium'
        }];
      }

      return res.json({ examples, source: 'ai_service' });
    } catch (aiError) {
      logger.warn(`AI service unavailable for legacy /scripts/examples: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
      const failure = buildAiFailure(aiError, 'AI service is unavailable');
      return res.status(failure.status).json(failure.body);
    }
  } catch (error) {
    console.error('Error in script examples endpoint:', error);
    return res.status(500).json({
      message: 'Failed to retrieve script examples',
      status: 'error'
    });
  }
});

export default router;
