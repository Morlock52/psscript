// Request type extensions are in src/types/express.d.ts
import express from 'express';
import { ChatController } from '../controllers/ChatController';
import { ChatHistory } from '../models';
// Fix import error - use the named export
import { authenticateJWT } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = express.Router();
const chatController = new ChatController();
const chatCategoryByUser = new Map<string, string>();

const getCategoryKey = (userId: number | string, chatId: number | string) => `${userId}::${chatId}`;

const getUserCategoryEntries = (userId: number): string[] => {
  const values = new Set<string>();
  for (const [key, value] of chatCategoryByUser.entries()) {
    if (key.startsWith(`${userId}::`)) {
      values.add(value);
    }
  }
  return Array.from(values);
};

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Chat operations
 */

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Send a message to the AI assistant
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - role
 *                     - content
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *               system_prompt:
 *                 type: string
 *                 description: Optional system prompt to override default
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/', chatController.sendMessage.bind(chatController));

/**
 * Backward-compatible endpoint for older frontends that call /chat/message.
 */
router.post('/message', chatController.sendMessage.bind(chatController));

/**
 * @swagger
 * /chat/stream:
 *   post:
 *     summary: Stream a message from the AI assistant (SSE)
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *     responses:
 *       200:
 *         description: SSE stream
 */
router.post('/stream', chatController.streamMessage.bind(chatController));

/**
 * @swagger
 * /chat/history:
 *   get:
 *     summary: Get chat history for the current user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Chat history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/history', authenticateJWT, chatController.getChatHistory.bind(chatController));

/**
 * @swagger
 * /chat/history:
 *   post:
 *     summary: Save chat history
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *     responses:
 *       200:
 *         description: Chat history saved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/history', authenticateJWT, chatController.saveChatHistory.bind(chatController));

/**
 * @swagger
 * /chat/history:
 *   delete:
 *     summary: Clear chat history
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history cleared successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/history', authenticateJWT, chatController.clearChatHistory.bind(chatController));

/**
 * @swagger
 * /chat/history/search:
 *   get:
 *     summary: Search chat history
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Missing search query
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/history/search', authenticateJWT, chatController.searchChatHistory.bind(chatController));

/**
 * Backward-compatible endpoint for older frontends that call /chat/search.
 */
router.get('/search', authenticateJWT, chatController.searchChatHistory.bind(chatController));

/**
 * Get chat categories (compat endpoint). In-memory mapping is used for compatibility.
 */
router.get('/categories', authenticateJWT, async (req, res) => {
  try {
    const categories = getUserCategoryEntries(req.user.id as number);
    res.status(200).json({ categories });
  } catch (error) {
    logger.error('Error fetching chat categories:', error);
    res.status(500).json({ error: 'Failed to fetch chat categories', categories: [] });
  }
});

/**
 * Set category for a chat session (compat endpoint).
 */
router.post('/:chatId/category', authenticateJWT, (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { category } = req.body || {};

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const key = getCategoryKey(req.user.id as number, chatId);
    chatCategoryByUser.set(key, category.trim());

    res.status(200).json({ success: true, chatId, category: category.trim() });
  } catch (error) {
    logger.error('Error setting chat category:', error);
    res.status(500).json({ error: 'Failed to set chat category' });
  }
});

/**
 * Delete a single chat session (compat endpoint) by ID.
 */
router.delete('/history/:chatId', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const chatId = Number(req.params.chatId);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      return res.status(400).json({ error: 'Invalid chat id' });
    }

    const ChatHistoryModel = ChatHistory;
    const deletedRows = await ChatHistoryModel.destroy({ where: { id: chatId, userId } });
    chatCategoryByUser.delete(getCategoryKey(userId, chatId));

    res.status(200).json({ success: true, deleted: deletedRows > 0 });
  } catch (error) {
    logger.error('Error deleting chat session:', error);
    res.status(500).json({ error: 'Failed to delete chat session', success: false });
  }
});

export default router;
