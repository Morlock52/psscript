const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage, AIMessage, SystemMessage } = require('langchain/schema');
const { Conversation, Message, MessageCitation } = require('../models');
const SearchService = require('./searchService');
require('dotenv').config();

/**
 * Service for chat functionality with context from the vector database
 */
class ChatService {
  constructor(options = {}) {
    this.model = options.model || process.env.LLM_MODEL || 'gpt-4';
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 1000;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required for chat functionality');
    }
    
    this.chat = new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      streaming: options.streaming || false
    });
    
    this.searchService = options.searchService || new SearchService();
    this.maxContextChunks = options.maxContextChunks || 5;
  }

  /**
   * Create a new conversation
   * @param {string} title - Conversation title
   * @returns {Promise<Object>} - Created conversation
   */
  async createConversation(title = 'New Conversation') {
    try {
      const conversation = await Conversation.create({
        title,
        metadata: {}
      });
      
      // Add system message
      await Message.create({
        conversationId: conversation.id,
        role: 'system',
        content: 'You are a helpful assistant that answers questions based on the provided context. If the answer is not in the context, say so.',
        metadata: {}
      });
      
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get a conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} - Conversation with messages
   */
  async getConversation(conversationId) {
    try {
      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          {
            model: Message,
            as: 'messages',
            order: [['createdAt', 'ASC']]
          }
        ]
      });
      
      if (!conversation) {
        throw new Error(`Conversation with ID ${conversationId} not found`);
      }
      
      return conversation;
    } catch (error) {
      console.error(`Error getting conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} content - Message content
   * @returns {Promise<Object>} - Response message
   */
  async sendMessage(conversationId, content) {
    try {
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      
      // Create user message
      const userMessage = await Message.create({
        conversationId,
        role: 'user',
        content,
        metadata: {}
      });
      
      // Search for relevant context
      const searchResults = await this.searchService.search(content, {
        limit: this.maxContextChunks
      });
      
      // Format context
      let context = '';
      const citations = [];
      
      if (searchResults.length > 0) {
        context = 'Context information:\n\n';
        
        searchResults.forEach((result, index) => {
          context += `[${index + 1}] ${result.content}\n\n`;
          
          citations.push({
            messageId: null, // Will be set after assistant message is created
            webPageId: result.webpage.id,
            relevanceScore: result.similarity
          });
        });
      }
      
      // Get conversation history
      const messages = conversation.messages.map(msg => {
        if (msg.role === 'system') {
          return new SystemMessage(msg.content);
        } else if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });
      
      // Add context and current message
      messages.push(new HumanMessage(`${context ? context + '\n' : ''}${content}`));
      
      // Generate response
      const response = await this.chat.call(messages);
      
      // Create assistant message
      const assistantMessage = await Message.create({
        conversationId,
        role: 'assistant',
        content: response.content,
        metadata: {
          hasContext: searchResults.length > 0,
          contextCount: searchResults.length
        }
      });
      
      // Create citations
      if (citations.length > 0) {
        const citationPromises = citations.map(citation => {
          citation.messageId = assistantMessage.id;
          return MessageCitation.create(citation);
        });
        
        await Promise.all(citationPromises);
      }
      
      return assistantMessage;
    } catch (error) {
      console.error(`Error sending message in conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Stream a response to a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} content - Message content
   * @param {Function} onToken - Callback for each token
   * @returns {Promise<Object>} - Response message
   */
  async streamMessage(conversationId, content, onToken) {
    try {
      // Create streaming chat model
      const streamingChat = new ChatOpenAI({
        openAIApiKey: this.apiKey,
        modelName: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        streaming: true
      });
      
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      
      // Create user message
      const userMessage = await Message.create({
        conversationId,
        role: 'user',
        content,
        metadata: {}
      });
      
      // Search for relevant context
      const searchResults = await this.searchService.search(content, {
        limit: this.maxContextChunks
      });
      
      // Format context
      let context = '';
      const citations = [];
      
      if (searchResults.length > 0) {
        context = 'Context information:\n\n';
        
        searchResults.forEach((result, index) => {
          context += `[${index + 1}] ${result.content}\n\n`;
          
          citations.push({
            messageId: null, // Will be set after assistant message is created
            webPageId: result.webpage.id,
            relevanceScore: result.similarity
          });
        });
      }
      
      // Get conversation history
      const messages = conversation.messages.map(msg => {
        if (msg.role === 'system') {
          return new SystemMessage(msg.content);
        } else if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });
      
      // Add context and current message
      messages.push(new HumanMessage(`${context ? context + '\n' : ''}${content}`));
      
      // Collect the full response
      let fullResponse = '';
      
      // Stream response
      await streamingChat.call(messages, {
        callbacks: [
          {
            handleLLMNewToken(token) {
              fullResponse += token;
              if (onToken) {
                onToken(token);
              }
            }
          }
        ]
      });
      
      // Create assistant message
      const assistantMessage = await Message.create({
        conversationId,
        role: 'assistant',
        content: fullResponse,
        metadata: {
          hasContext: searchResults.length > 0,
          contextCount: searchResults.length
        }
      });
      
      // Create citations
      if (citations.length > 0) {
        const citationPromises = citations.map(citation => {
          citation.messageId = assistantMessage.id;
          return MessageCitation.create(citation);
        });
        
        await Promise.all(citationPromises);
      }
      
      return assistantMessage;
    } catch (error) {
      console.error(`Error streaming message in conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Get citations for a message
   * @param {string} messageId - Message ID
   * @returns {Promise<Object[]>} - Citations with webpage information
   */
  async getMessageCitations(messageId) {
    try {
      const citations = await MessageCitation.findAll({
        where: { messageId },
        include: [
          {
            model: WebPage,
            as: 'webPage',
            attributes: ['id', 'url', 'title']
          }
        ]
      });
      
      return citations.map(citation => ({
        id: citation.id,
        relevanceScore: citation.relevanceScore,
        webpage: {
          id: citation.webPage.id,
          url: citation.webPage.url,
          title: citation.webPage.title
        }
      }));
    } catch (error) {
      console.error(`Error getting citations for message ${messageId}:`, error);
      throw error;
    }
  }
}

module.exports = ChatService;
