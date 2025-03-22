const { Op } = require('sequelize');
const { ContentChunk, WebPage } = require('../models');
const EmbeddingService = require('./embeddingService');
const pgvector = require('pgvector/sequelize');

/**
 * Service for searching content using vector similarity
 */
class SearchService {
  constructor(options = {}) {
    this.embeddingService = options.embeddingService || new EmbeddingService();
    this.maxResults = options.maxResults || 10;
    this.similarityThreshold = options.similarityThreshold || 0.7;
  }

  /**
   * Search for content similar to a query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} - Search results
   */
  async search(query, options = {}) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Set up search parameters
      const limit = options.limit || this.maxResults;
      const threshold = options.threshold || this.similarityThreshold;
      
      // Search for similar content chunks
      const results = await ContentChunk.findAll({
        attributes: [
          'id',
          'content',
          'metadata',
          'chunkIndex',
          'webPageId',
          [pgvector.cosineSimilarity('embedding', queryEmbedding), 'similarity']
        ],
        where: pgvector.cosineDistance('embedding', queryEmbedding).lte(1 - threshold),
        order: [[pgvector.cosineSimilarity('embedding', queryEmbedding), 'DESC']],
        limit: limit,
        include: [
          {
            model: WebPage,
            as: 'webPage',
            attributes: ['id', 'url', 'title', 'lastCrawled']
          }
        ]
      });
      
      // Format results
      return results.map(result => ({
        id: result.id,
        content: result.content,
        similarity: result.getDataValue('similarity'),
        metadata: result.metadata,
        chunkIndex: result.chunkIndex,
        webpage: {
          id: result.webPage.id,
          url: result.webPage.url,
          title: result.webPage.title,
          lastCrawled: result.webPage.lastCrawled
        }
      }));
    } catch (error) {
      console.error('Error searching for content:', error);
      throw error;
    }
  }

  /**
   * Search for content with keyword filtering
   * @param {string} query - Search query
   * @param {string} keywords - Keywords to filter by
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} - Search results
   */
  async searchWithKeywords(query, keywords, options = {}) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Set up search parameters
      const limit = options.limit || this.maxResults;
      const threshold = options.threshold || this.similarityThreshold;
      
      // Create keyword filter
      const keywordFilter = keywords.split(/\s+/).map(keyword => ({
        content: {
          [Op.iLike]: `%${keyword}%`
        }
      }));
      
      // Search for similar content chunks with keyword filtering
      const results = await ContentChunk.findAll({
        attributes: [
          'id',
          'content',
          'metadata',
          'chunkIndex',
          'webPageId',
          [pgvector.cosineSimilarity('embedding', queryEmbedding), 'similarity']
        ],
        where: {
          [Op.and]: [
            pgvector.cosineDistance('embedding', queryEmbedding).lte(1 - threshold),
            {
              [Op.or]: keywordFilter
            }
          ]
        },
        order: [[pgvector.cosineSimilarity('embedding', queryEmbedding), 'DESC']],
        limit: limit,
        include: [
          {
            model: WebPage,
            as: 'webPage',
            attributes: ['id', 'url', 'title', 'lastCrawled']
          }
        ]
      });
      
      // Format results
      return results.map(result => ({
        id: result.id,
        content: result.content,
        similarity: result.getDataValue('similarity'),
        metadata: result.metadata,
        chunkIndex: result.chunkIndex,
        webpage: {
          id: result.webPage.id,
          url: result.webPage.url,
          title: result.webPage.title,
          lastCrawled: result.webPage.lastCrawled
        }
      }));
    } catch (error) {
      console.error('Error searching with keywords:', error);
      throw error;
    }
  }

  /**
   * Get related content chunks from the same webpage
   * @param {string} chunkId - ID of the content chunk
   * @param {number} limit - Maximum number of related chunks to return
   * @returns {Promise<Object[]>} - Related content chunks
   */
  async getRelatedChunks(chunkId, limit = 5) {
    try {
      // Get the chunk
      const chunk = await ContentChunk.findByPk(chunkId, {
        include: [
          {
            model: WebPage,
            as: 'webPage',
            attributes: ['id', 'url', 'title']
          }
        ]
      });
      
      if (!chunk) {
        throw new Error(`Chunk with ID ${chunkId} not found`);
      }
      
      // Get related chunks from the same webpage
      const relatedChunks = await ContentChunk.findAll({
        where: {
          webPageId: chunk.webPageId,
          id: {
            [Op.ne]: chunkId
          }
        },
        order: [['chunkIndex', 'ASC']],
        limit: limit
      });
      
      // Format results
      return relatedChunks.map(related => ({
        id: related.id,
        content: related.content,
        metadata: related.metadata,
        chunkIndex: related.chunkIndex,
        webpage: {
          id: chunk.webPage.id,
          url: chunk.webPage.url,
          title: chunk.webPage.title
        }
      }));
    } catch (error) {
      console.error(`Error getting related chunks for ${chunkId}:`, error);
      throw error;
    }
  }
}

module.exports = SearchService;
