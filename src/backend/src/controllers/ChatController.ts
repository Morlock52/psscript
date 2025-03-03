import { Request, Response } from 'express';
import axios from 'axios';
import { redisClient } from '../middleware/redisMiddleware';
import logger from '../utils/logger';
import { ChatHistory } from '../models';
import { Op } from 'sequelize';

/**
 * Chat Controller
 * Handles chat interactions with the AI service and manages chat history
 */
export class ChatController {
  private aiServiceUrl: string;
  
  constructor() {
    // Get AI service URL from environment variables or use default
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    logger.info(`ChatController initialized with AI service URL: ${this.aiServiceUrl}`);
  }
  
  /**
   * Send a message to the AI service
   * @param req Request object containing messages array
   * @param res Response object
   */
  public async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messages, system_prompt } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Messages array is required' });
        return;
      }
      
      // Log the request for debugging
      logger.debug(`Sending chat request to ${this.aiServiceUrl}/chat with ${messages.length} messages`);
      
      // Forward request to AI service
      const response = await axios.post(`${this.aiServiceUrl}/chat`, {
        messages,
        system_prompt
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      // Store in chat history if user is authenticated
      if (req.user && req.user.id) {
        await this.storeChatHistory(req.user.id, messages, response.data.response);
      }
      
      res.status(200).json(response.data);
    } catch (error) {
      logger.error('Error in sendMessage:', error);
      
      // Handle different types of errors with appropriate responses
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          // Network error
          res.status(503).json({ 
            error: 'AI service unavailable',
            details: 'Network error when connecting to AI service'
          });
        } else if (error.response.status === 429) {
          // Rate limiting
          res.status(429).json({ 
            error: 'Too many requests',
            details: 'Please wait a moment and try again'
          });
        } else {
          // Other API errors
          res.status(error.response.status).json({ 
            error: 'AI service error',
            details: error.response.data?.message || error.message
          });
        }
      } else {
        // Generic error
        res.status(500).json({ 
          error: 'Failed to communicate with AI service',
          details: error.message
        });
      }
    }
  }
  
  /**
   * Get chat history for the current user
   * @param req Request object
   * @param res Response object
   */
  public async getChatHistory(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const userId = req.user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      
      // Check Redis cache first
      const cacheKey = `chat:history:${userId}:page:${page}:limit:${limit}`;
      if (redisClient.isReady) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          res.status(200).json(JSON.parse(cachedData));
          return;
        }
      }
      
      // Query database for chat history
      const { count, rows } = await ChatHistory.findAndCountAll({
        where: {
          userId
        },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });
      
      // Format the response
      const result = {
        history: rows.map(entry => ({
          id: entry.id,
          timestamp: entry.createdAt,
          messages: entry.messages
        })),
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      };
      
      // Cache the result
      if (redisClient.isReady) {
        await redisClient.set(cacheKey, JSON.stringify(result), {
          EX: 60 * 5 // Cache for 5 minutes
        });
      }
      
      res.status(200).json(result);
    } catch (error) {
      logger.error('Error in getChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve chat history',
        details: error.message
      });
    }
  }
  
  /**
   * Save chat history
   * @param req Request object
   * @param res Response object
   */
  public async saveChatHistory(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { messages } = req.body;
      const userId = req.user.id;
      
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Messages array is required' });
        return;
      }
      
      // Extract the last assistant message as the response
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      const response = assistantMessages.length > 0 
        ? assistantMessages[assistantMessages.length - 1].content 
        : '';
      
      // Store in database
      await ChatHistory.create({
        userId,
        messages,
        response
      });
      
      // Invalidate cache
      if (redisClient.isReady) {
        await redisClient.del(`chat:history:${userId}:*`);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error in saveChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to save chat history',
        details: error.message
      });
    }
  }
  
  /**
   * Delete chat history
   * @param req Request object
   * @param res Response object
   */
  public async clearChatHistory(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const userId = req.user.id;
      
      // Delete chat history from database
      await ChatHistory.destroy({
        where: {
          userId
        }
      });
      
      // Clear Redis cache
      if (redisClient.isReady) {
        await redisClient.del(`chat:history:${userId}:*`);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error in clearChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to clear chat history',
        details: error.message
      });
    }
  }
  
  /**
   * Search chat history
   * @param req Request object
   * @param res Response object
   */
  public async searchChatHistory(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const userId = req.user.id;
      const query = req.query.q as string;
      
      if (!query) {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }
      
      // Search in chat history for the query
      // Note: This is a basic implementation - for production, you might want to use pgvector for semantic search
      const results = await ChatHistory.findAll({
        where: {
          userId,
          [Op.or]: [
            { response: { [Op.iLike]: `%${query}%` } }
          ]
        },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      res.status(200).json({
        results: results.map(entry => ({
          id: entry.id,
          timestamp: entry.createdAt,
          messages: entry.messages,
          response: entry.response
        }))
      });
    } catch (error) {
      logger.error('Error in searchChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to search chat history',
        details: error.message
      });
    }
  }
  
  /**
   * Store chat message in history
   * @param userId User ID
   * @param messages Chat messages
   * @param response AI response
   */
  private async storeChatHistory(userId: number, messages: any[], response: string): Promise<void> {
    try {
      // Store in Redis cache for quick access
      if (redisClient.isReady) {
        const key = `chat:history:${userId}:latest`;
        const value = JSON.stringify({
          messages,
          response,
          timestamp: new Date()
        });
        
        await redisClient.set(key, value, {
          EX: 60 * 60 * 24 // Expire after 24 hours
        });
      }
      
      // Store in database
      await ChatHistory.create({
        userId,
        messages,
        response
      });
      
      logger.info(`Stored chat history for user ${userId}`);
    } catch (error) {
      logger.error('Error storing chat history:', error);
      // Don't throw the error to prevent disrupting the main flow
    }
  }
  
  /**
   * Generate embedding for chat message
   * This would be implemented to support semantic search
   * @param text Text to generate embedding for
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Call AI service to generate embedding
      const response = await axios.post(`${this.aiServiceUrl}/embedding`, {
        content: text
      });
      
      return response.data.embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      return []; // Return empty array on error
    }
  }
}