import { Request, Response } from 'express';
import axios from 'axios';
import logger from '../utils/logger';
import { ChatHistory } from '../models';
import { Op } from 'sequelize';
import { cache } from '../services/cacheService';
import { anthropic, inferProvider, MODELS, openai } from '../services/openaiClient';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const AI_CHAT_TIMEOUT_MS = Number(process.env.AI_CHAT_TIMEOUT_MS || 20000);

const summarizeError = (error: unknown): Record<string, unknown> => {
  if (axios.isAxiosError(error)) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { value: String(error) };
};

/**
 * Chat Controller
 * Handles chat interactions with the AI service and manages chat history
 */
export class ChatController {
  private aiServiceUrl: string;
  
  constructor() {
    // Get AI service URL from environment variables or use default
    const isDocker = process.env.DOCKER_ENV === 'true';
    this.aiServiceUrl = isDocker 
      ? (process.env.AI_SERVICE_URL || 'http://ai-service:8000') 
      : (process.env.AI_SERVICE_URL || 'http://localhost:8000');
    logger.info(`ChatController initialized with AI service URL: ${this.aiServiceUrl}`);
  }

  private buildSystemPrompt(systemPrompt?: string): string {
    return systemPrompt || [
      'You are PSScript AI Assistant, an enterprise PowerShell expert.',
      'Give practical, safe, concise answers.',
      'Prefer read-only commands unless the user explicitly asks for changes.',
      'Warn before destructive operations and explain verification steps.'
    ].join(' ');
  }

  private toOpenAIInput(messages: Array<{ role: string; content: string }>, systemPrompt?: string): any[] {
    const input: any[] = [{ role: 'system', content: this.buildSystemPrompt(systemPrompt) }];
    for (const message of messages) {
      input.push({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      });
    }
    return input;
  }

  private toAnthropicMessages(messages: Array<{ role: string; content: string }>): Array<{ role: 'user' | 'assistant'; content: string }> {
    return messages.map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }));
  }

  private async createChatCompletion(args: {
    messages: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    provider: string;
    model?: string;
    apiKey?: string;
  }): Promise<{ response: string; provider: string; model: string }> {
    if (args.provider === 'anthropic') {
      const anthropicClient = args.apiKey ? new Anthropic({ apiKey: args.apiKey }) : anthropic;
      if (!anthropicClient) {
        throw Object.assign(new Error('Anthropic API key is required. Configure ANTHROPIC_API_KEY or choose an OpenAI model.'), {
          status: 400
        });
      }

      const model = args.model || MODELS.CLAUDE_SONNET;
      const response = await anthropicClient.messages.create({
        model,
        system: this.buildSystemPrompt(args.systemPrompt),
        messages: this.toAnthropicMessages(args.messages),
        max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 1200)
      });
      const text = response.content
        .map((block: any) => block?.type === 'text' ? block.text : '')
        .filter(Boolean)
        .join('\n')
        .trim();

      return { response: text, provider: 'anthropic', model };
    }

    const model = args.model || process.env.OPENAI_MODEL || MODELS.FAST;
    const openaiClient = args.apiKey && args.apiKey !== process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: args.apiKey, maxRetries: 2 })
      : openai;
    const response = await openaiClient.responses.create({
      model,
      input: this.toOpenAIInput(args.messages, args.systemPrompt),
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 1200)
    } as any);

    const text = (response as any).output_text || '';
    return { response: text.trim(), provider: 'openai', model };
  }
  
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
      const { messages: rawMessages, message, system_prompt, api_key, agent_type, session_id, model, provider } = req.body as {
        messages?: Array<{ role: string; content: string }>;
        message?: string;
        system_prompt?: string;
        api_key?: string;
        agent_type?: string;
        session_id?: string;
        model?: string;
        provider?: string;
      };

      // Backward-compatible payload handling for legacy clients that send `message`.
      const messages = Array.isArray(rawMessages)
        ? rawMessages
        : (typeof message === 'string' && message.trim() ? [{ role: 'user', content: message.trim() }] : []);
      
      // Validate request parameters
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        logger.warn(`[${requestId}] Invalid request: Missing or empty messages array`);
        res.status(400).json({ error: 'Messages array is required and must not be empty' });
        return;
      }
      
      // Determine effective provider — infer from model ID if not explicitly set
      const effectiveProvider = provider || inferProvider(model || 'gpt-4.1');

      // Resolve API key: Anthropic requests use ANTHROPIC_API_KEY, OpenAI uses OPENAI_API_KEY
      const effectiveApiKey = effectiveProvider === 'anthropic'
        ? (api_key || process.env.ANTHROPIC_API_KEY || '') // eslint-disable-line camelcase
        : (api_key || process.env.OPENAI_API_KEY || ''); // eslint-disable-line camelcase

      if (!effectiveApiKey) {
        const providerLabel = effectiveProvider === 'anthropic' ? 'Anthropic' : 'OpenAI';
        logger.warn(`[${requestId}] Invalid request: No ${providerLabel} API key provided`);
        res.status(400).json({ error: `${providerLabel} API key is required. Please configure it in the server environment or provide it in Settings.` });
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
      
      // Call provider SDKs directly. The previous Python AI-service proxy can
      // hang locally and is not part of the Netlify production path.
      logger.debug(`[${requestId}] Sending chat request to ${effectiveProvider} with ${messages.length} messages`);
      const startTime = Date.now();
      const completion = await this.createChatCompletion({
        messages,
        systemPrompt: system_prompt,
        provider: effectiveProvider,
        model,
        apiKey: effectiveApiKey,
      });
      
      const duration = Date.now() - startTime;
      logger.info(`[${requestId}] ${completion.provider} responded in ${duration}ms`);
      
      // Validate response format
      if (!completion.response) {
        logger.warn(`[${requestId}] Empty response from AI provider`);
        res.status(502).json({ 
          error: 'Invalid response from AI provider',
          details: 'The AI provider returned an empty response'
        });
        return;
      }
      
      // Store in chat history if user is authenticated
      if (req.user && req.user.id) {
        try {
          await this.storeChatHistory(req.user.id, messages, completion.response);
          logger.debug(`[${requestId}] Chat history stored for user ${req.user.id}`);
        } catch (historyError) {
          // Log but don't fail the request if history storage fails
          logger.error(`[${requestId}] Failed to store chat history`, { error: summarizeError(historyError) });
        }
      }
      
      res.status(200).json({
        response: completion.response,
        text: completion.response,
        provider: completion.provider,
        model: completion.model
      });
    } catch (error) {
      // Generate a user-friendly error message while logging the technical details
      logger.error(`[${requestId}] Error in sendMessage`, { error: summarizeError(error) });
      
      // Handle different types of errors with appropriate responses
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          // Timeout error
          logger.warn(`[${requestId}] Request to AI service timed out after ${error.config?.timeout || AI_CHAT_TIMEOUT_MS}ms`);
          res.status(504).json({ 
            error: 'Request timeout',
            details: 'The AI service took too long to respond. Please try again with a simpler query.'
          });
        } else if (!error.response) {
          // Network error
          logger.warn(`[${requestId}] Network error connecting to AI service: ${error.message}`);
          res.status(503).json({ 
            error: 'AI service unavailable',
            details: 'Could not connect to the AI service. Please check your internet connection and try again.'
          });
        } else if (error.response.status === 429) {
          // Rate limiting
          logger.warn(`[${requestId}] Rate limited by AI service: ${error.response.data?.message || 'No details provided'}`);
          res.status(429).json({ 
            error: 'Too many requests',
            details: 'The AI service is currently experiencing high demand. Please wait a moment and try again.'
          });
        } else if (error.response.status === 401 || error.response.status === 403) {
          // Authentication or authorization error
          logger.warn(`[${requestId}] Authentication error with AI service: ${error.response.status}`);
          res.status(401).json({ 
            error: 'Invalid API key',
            details: 'The provided API key was rejected by the AI service. Please check your API key and try again.'
          });
        } else {
          // Other API errors
          logger.warn(`[${requestId}] AI service error (${error.response.status}): ${error.response.data?.message || error.message}`);
          res.status(error.response.status).json({ 
            error: 'AI service error',
            details: error.response.data?.message || error.message,
            status: error.response.status
          });
        }
      } else {
        // Generic error
        logger.error(`[${requestId}] Unexpected error in sendMessage`, { error: summarizeError(error) });
        res.status(500).json({ 
          error: 'Failed to communicate with AI service',
          details: 'An unexpected error occurred. Please try again later.',
          requestId: requestId // Include request ID for troubleshooting
        });
      }
      
      // Track error in metrics
      try {
        const errorKey = 'metrics:errors:sendMessage';
        const errorCount = cache.get(errorKey) || 0;
        cache.set(errorKey, errorCount + 1, 60 * 60 * 24 * 7); // 7 days
      } catch (metricError) {
        // Don't let metrics tracking failure affect the response
        logger.warn(`[${requestId}] Failed to record error metrics`, { error: summarizeError(metricError) });
      }
    }
  }

  /**
   * Stream a message from the AI service as Server-Sent Events (SSE).
   *
   * This exists so the frontend can stream over the same TLS origin (backend),
   * avoiding mixed-content issues when the UI is served over https locally.
   */
  public async streamMessage(req: Request, res: Response): Promise<void> {
    const requestId = Math.random().toString(36).substring(2, 10);

    // eslint-disable-next-line camelcase -- API request body uses snake_case
    const { messages, system_prompt, api_key, agent_type, session_id, model, provider } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required and must not be empty' });
      return;
    }

    // Provider-aware key resolution (mirrors sendMessage)
    const effectiveProvider = provider || inferProvider(model || 'gpt-4.1');
    const effectiveApiKey = effectiveProvider === 'anthropic'
      ? (api_key || process.env.ANTHROPIC_API_KEY || '') // eslint-disable-line camelcase
      : (api_key || process.env.OPENAI_API_KEY || ''); // eslint-disable-line camelcase

    if (!effectiveApiKey) {
      const providerLabel = effectiveProvider === 'anthropic' ? 'Anthropic' : 'OpenAI';
      res.status(400).json({
        error: `${providerLabel} API key is required. Please configure it in the server environment or provide it in Settings.`,
      });
      return;
    }

    // Set SSE headers before contacting upstream.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as any).flushHeaders?.();

    try {
      logger.debug(`[${requestId}] Creating direct ${effectiveProvider} chat response for SSE client`);
      const completion = await this.createChatCompletion({
        messages,
        systemPrompt: system_prompt,
        provider: effectiveProvider,
        model,
        apiKey: effectiveApiKey,
      });

      res.write(`data: ${JSON.stringify({ type: 'message', content: completion.response })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'metadata', provider: completion.provider, model: completion.model })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      logger.error(`[${requestId}] Error proxying SSE stream`, { error: summarizeError(error) });
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: 'AI streaming unavailable' })}\n\n`);
      } catch (_err) {
        // Ignore write errors after client disconnects.
      }
      res.end();
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
      
      // Check memory cache first
      const cacheKey = `chat:history:${userId}:page:${page}:limit:${limit}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        res.status(200).json(cachedData);
        return;
      }
      
      // Query database for chat history
      const ChatHistoryModel = ChatHistory;
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
      const ChatHistoryModel = ChatHistory;
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
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const userId = req.user.id;
      
      // Delete chat history from database
      const ChatHistoryModel = ChatHistory;
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
      const ChatHistoryModel = ChatHistory;
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
        const ChatHistoryModel = ChatHistory;
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
      
      // Call AI service to generate embedding with timeout
      const response = await axios.post(`${this.aiServiceUrl}/embedding`, {
        content: truncatedText
      }, {
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.data || !response.data.embedding || !Array.isArray(response.data.embedding)) {
        logger.warn('Invalid embedding response format from AI service:', response.data);
        return [];
      }
      
      logger.debug(`Successfully generated embedding with ${response.data.embedding.length} dimensions`);
      return response.data.embedding;
    } catch (error) {
      // Handle different types of errors
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          logger.warn('Embedding generation timed out');
        } else if (!error.response) {
          logger.warn('Network error when generating embedding:', error.message);
        } else {
          logger.error(`AI service error (${error.response.status}) when generating embedding:`, error.message);
        }
      } else {
        logger.error('Unexpected error generating embedding:', error);
      }
      
      return []; // Return empty array on error
    }
  }
}
