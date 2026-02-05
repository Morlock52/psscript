import { Request, Response } from 'express';
import logger from '../utils/logger';
import { ChatHistory } from '../models';
import { sequelize } from '../database/connection';
import { Op } from 'sequelize';
import { cache } from '../index';
import { getEmbeddingModel, getOpenAIClient, getOpenAIModel } from '../services/ai/openaiClient';

/**
 * Chat Controller
 * Handles chat interactions with the AI service and manages chat history
 */
export class ChatController {
  constructor() {
    logger.info('ChatController initialized with direct OpenAI client');
  }

  private static readonly ALLOWED_MODELS = new Set<string>([
    'gpt-5.2-codex',
    'gpt-5.2',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-5',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ]);
  
  /**
   * Send a message to the AI service
   * @param req Request object containing messages array
   * @param res Response object
   */
  public async sendMessage(req: Request, res: Response): Promise<void> {
    // Generate a unique request ID for tracking
    const requestId = Math.random().toString(36).substring(2, 10);
    
    try {
      // eslint-disable-next-line camelcase -- API request body uses snake_case
      const { messages, system_prompt, api_key, model: requestedModel, agent_type, session_id } = req.body;
      
      // Validate request parameters
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        logger.warn(`[${requestId}] Invalid request: Missing or empty messages array`);
        res.status(400).json({ error: 'Messages array is required and must not be empty' });
        return;
      }
      
      // Use server API key if one is not provided by the client
      const headerApiKey = req.headers['x-openai-api-key'] as string | undefined;
      const effectiveApiKey = api_key || headerApiKey || process.env.OPENAI_API_KEY; // eslint-disable-line camelcase
      
      if (!effectiveApiKey) {
        logger.warn(`[${requestId}] Invalid request: No API key provided and no server API key configured`);
        res.status(400).json({ error: 'OpenAI API key is required. Please set your API key in Settings or ask the administrator to configure a server API key.' });
        return;
      }
      
      // Validate message format
      const invalidMessages = messages.filter(m => !m.role || !m.content || typeof m.content !== 'string');
      if (invalidMessages.length > 0) {
        logger.warn(`[${requestId}] Invalid message format detected`);
        res.status(400).json({ 
          error: 'Invalid message format', 
          details: 'Each message must have a role and content string'
        });
        return;
      }
      
      // Log the request for debugging (with sensitive info redacted)
      logger.debug(`[${requestId}] Sending chat request to OpenAI with ${messages.length} messages`);
      
      const client = getOpenAIClient(effectiveApiKey);

      let model = getOpenAIModel();
      if (requestedModel) {
        if (typeof requestedModel !== 'string' || !ChatController.ALLOWED_MODELS.has(requestedModel)) {
          res.status(400).json({ error: `Unsupported model: ${String(requestedModel)}` });
          return;
        }
        model = requestedModel;
      }
      const startTime = Date.now();
      
      const finalMessages = system_prompt
        ? [{ role: 'system', content: system_prompt }, ...messages]
        : messages;
      
      const response = await client.chat.completions.create({
        model,
        messages: finalMessages
      });

      // Expose usage/model to the AI analytics middleware without leaking it to clients.
      // (res.json() is wrapped by AIAnalyticsMiddleware.trackUsage()).
      res.locals.model = model;
      // The OpenAI SDK includes usage on the response; keep it optional for compatibility.
      res.locals.usage = (response as any)?.usage;

      const duration = Date.now() - startTime;
      logger.info(`[${requestId}] OpenAI responded in ${duration}ms`);
      
      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        logger.warn(`[${requestId}] OpenAI response missing content`);
        res.status(502).json({ 
          error: 'Invalid response from OpenAI',
          details: 'No response content received'
        });
        return;
      }
      
      // Store in chat history if user is authenticated
      const userId = Number(req.user?.id);
      if (Number.isFinite(userId) && userId > 0) {
        try {
          await this.storeChatHistory(userId, messages, responseText);
          logger.debug(`[${requestId}] Chat history stored for user ${userId}`);
        } catch (historyError) {
          // Log but don't fail the request if history storage fails
          logger.error(`[${requestId}] Failed to store chat history:`, historyError);
        }
      }
      
      res.status(200).json({ response: responseText, model });
    } catch (error) {
      // Generate a user-friendly error message while logging the technical details
      logger.error(`[${requestId}] Error in sendMessage:`, error);
      
      // Handle different types of errors with appropriate responses
      logger.error(`[${requestId}] Error in sendMessage:`, error);
      res.status(500).json({ 
        error: 'Failed to communicate with OpenAI',
        details: (error as Error).message,
        requestId: requestId // Include request ID for troubleshooting
      });
      
      // Track error in metrics
      try {
        const errorKey = 'metrics:errors:sendMessage';
        const errorCount = cache.get(errorKey) || 0;
        cache.set(errorKey, errorCount + 1, 60 * 60 * 24 * 7); // 7 days
      } catch (metricError) {
        // Don't let metrics tracking failure affect the response
        logger.warn(`[${requestId}] Failed to record error metrics:`, metricError);
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
      const userId = Number(req.user?.id);
      if (!Number.isFinite(userId) || userId <= 0) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      
      // Check memory cache first
      const cacheKey = `chat:history:${userId}:page:${page}:limit:${limit}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        res.status(200).json(cachedData);
        return;
      }
      
      // Query database for chat history
      // Get the model instance from the sequelize import
      const ChatHistoryModel = ChatHistory(sequelize);
      const { count, rows } = await ChatHistoryModel.findAndCountAll({
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
      cache.set(cacheKey, result, 300); // Cache for 5 minutes
      logger.debug(`Cached chat history for user ${userId}, page ${page}`);
      
      res.status(200).json(result);
    } catch (error) {
      logger.error('Error in getChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve chat history',
        details: error instanceof Error ? error.message : String(error)
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
      const userId = Number(req.user?.id);
      if (!Number.isFinite(userId) || userId <= 0) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { messages } = req.body;
      
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
      // Get the model instance from the sequelize import
      const ChatHistoryModel = ChatHistory(sequelize);
      await ChatHistoryModel.create({
        userId,
        messages,
        response
      });
      
      // Invalidate cache
      cache.clearPattern(`chat:history:${userId}:`);
      logger.debug(`Invalidated cache entries for user ${userId}`);
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error in saveChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to save chat history',
        details: error instanceof Error ? error.message : String(error)
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
      const userId = Number(req.user?.id);
      if (!Number.isFinite(userId) || userId <= 0) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      // Delete chat history from database
      // Get the model instance from the sequelize import
      const ChatHistoryModel = ChatHistory(sequelize);
      await ChatHistoryModel.destroy({
        where: {
          userId
        }
      });
      
      // Clear cache
      cache.clearPattern(`chat:history:${userId}:`);
      logger.debug(`Cleared cache entries for user ${userId}`);
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error in clearChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to clear chat history',
        details: error instanceof Error ? error.message : String(error)
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
      const userId = Number(req.user?.id);
      if (!Number.isFinite(userId) || userId <= 0) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const query = req.query.q as string;
      
      if (!query) {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }
      
      // Create a cache key for this search query
      const cacheKey = `chat:search:${userId}:${encodeURIComponent(query)}`;
      
      // Try to get from cache first
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Cache hit for search query '${query}' by user ${userId}`);
        res.status(200).json(cachedData);
        return;
      }
      
      // Search in chat history for the query
      // Note: This is a basic implementation - for production, you might want to use pgvector for semantic search
      // Get the model instance from the sequelize import
      const ChatHistoryModel = ChatHistory(sequelize);
      const results = await ChatHistoryModel.findAll({
        where: {
          userId,
          [Op.or]: [
            { response: { [Op.iLike]: `%${query}%` } }
          ]
        },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      // Format the results
      const searchResults = {
        results: results.map(entry => ({
          id: entry.id,
          timestamp: entry.createdAt,
          messages: entry.messages,
          response: entry.response
        }))
      };
      
      // Cache the search results
      cache.set(cacheKey, searchResults, 900); // Cache for 15 minutes
      logger.debug(`Cached search results for query '${query}' by user ${userId}`);
      
      res.status(200).json(searchResults);
    } catch (error) {
      logger.error('Error in searchChatHistory:', error);
      res.status(500).json({ 
        error: 'Failed to search chat history',
        details: error instanceof Error ? error.message : String(error)
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
      // Generate a unique ID for this chat session for logging purposes
      const chatId = Math.random().toString(36).substring(2, 10);
      logger.debug(`Storing chat history (ID: ${chatId}) for user ${userId} with ${messages.length} messages`);
      
      // Try to store in memory cache for quick access
      try {
        const key = `chat:history:${userId}:latest`;
        const value = {
          chatId,
          messages,
          response,
          timestamp: new Date()
        };
        
        cache.set(key, value, 60 * 60 * 24); // Expire after 24 hours
        logger.debug(`Cached latest chat (ID: ${chatId}) for user ${userId}`);
      } catch (cacheError) {
        logger.warn(`Cache error for chat (ID: ${chatId}):`, cacheError);
        // Continue to database storage even if cache fails
      }
      
      // Store in database with error handling
      try {
        // Create the chat history record
        // Get the model instance from the sequelize import
        const ChatHistoryModel = ChatHistory(sequelize);
        const chatHistory = await ChatHistoryModel.create({
          userId,
          messages,
          response
        });
        
        logger.info(`Successfully stored chat history (ID: ${chatId}, DB ID: ${chatHistory.id}) for user ${userId}`);
        
        // Try to generate and store embedding for semantic search (if enabled)
        if (process.env.ENABLE_EMBEDDINGS === 'true') {
          try {
            // Generate embedding for the response text (for semantic search)
            const embedding = await this.generateEmbedding(response);
            if (embedding && embedding.length > 0) {
              await chatHistory.update({ embedding });
              logger.debug(`Added embedding to chat history (ID: ${chatId})`);
            }
          } catch (embeddingError) {
            logger.warn(`Failed to generate embedding for chat (ID: ${chatId}):`, embeddingError);
            // Continue without embedding if it fails
          }
        }
      } catch (dbError) {
        logger.error(`Database error storing chat history (ID: ${chatId}):`, dbError);
        throw dbError; // Re-throw database errors as they are critical
      }
    } catch (error) {
      logger.error('Critical error in storeChatHistory:', error);
      // Don't throw the error to prevent disrupting the main flow
    }
  }
  
  /**
   * Generate embedding for chat message
   * This would be implemented to support semantic search
   * @param text Text to generate embedding for
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Skip if text is empty
    if (!text || text.trim().length === 0) {
      logger.debug('Skipping embedding generation for empty text');
      return [];
    }
    
    try {
      // Truncate text if it's too long (most embedding APIs have limits)
      const maxLength = 8000; // Adjust based on the AI service's limits
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
      
      if (text.length > maxLength) {
        logger.debug(`Truncated text from ${text.length} to ${maxLength} characters for embedding generation`);
      }
      
      const client = getOpenAIClient();
      const response = await client.embeddings.create({
        model: getEmbeddingModel(),
        input: truncatedText
      });
      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        logger.warn('Invalid embedding response from OpenAI');
        return [];
      }

      logger.debug(`Successfully generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      logger.error('Unexpected error generating embedding:', error);
      return []; // Return empty array on error
    }
  }
}
