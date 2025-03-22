const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { HuggingFaceInferenceEmbeddings } = require('langchain/embeddings/hf');
require('dotenv').config();

/**
 * Service for generating embeddings from text
 */
class EmbeddingService {
  constructor(options = {}) {
    this.provider = options.provider || process.env.EMBEDDING_PROVIDER || 'openai';
    this.model = options.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.huggingFaceApiKey = options.huggingFaceApiKey || process.env.HUGGINGFACE_API_KEY;
    this.batchSize = options.batchSize || 512;
    this.dimensions = options.dimensions || null; // For OpenAI, can be 1536 or 3072 for text-embedding-3-small

    if (this.provider === 'openai' && !this.apiKey) {
      throw new Error('OpenAI API key is required for embedding generation with OpenAI');
    }

    if (this.provider === 'huggingface' && !this.huggingFaceApiKey) {
      throw new Error('HuggingFace API key is required for embedding generation with HuggingFace');
    }

    this.initializeEmbeddingModel();
  }

  /**
   * Initialize the embedding model based on the provider
   */
  initializeEmbeddingModel() {
    switch (this.provider.toLowerCase()) {
      case 'openai':
        this.embeddings = new OpenAIEmbeddings({
          openAIApiKey: this.apiKey,
          modelName: this.model,
          batchSize: this.batchSize,
          stripNewLines: true,
          dimensions: this.dimensions
        });
        break;
      case 'huggingface':
        this.embeddings = new HuggingFaceInferenceEmbeddings({
          apiKey: this.huggingFaceApiKey,
          model: this.model || 'sentence-transformers/all-MiniLM-L6-v2'
        });
        break;
      default:
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
    }
  }

  /**
   * Generate embeddings for an array of texts
   * @param {string[]} texts - Array of text strings to embed
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    try {
      // Filter out empty texts
      const validTexts = texts.filter(text => text && text.trim().length > 0);

      if (validTexts.length === 0) {
        return [];
      }

      // Generate embeddings
      const embeddings = await this.embeddings.embedDocuments(validTexts);
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate a single embedding for a text
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    try {
      const embedding = await this.embeddings.embedQuery(text);
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vec1 - First vector
   * @param {number[]} vec2 - Second vector
   * @returns {number} - Cosine similarity (between -1 and 1)
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }

  /**
   * Find the most similar texts to a query text
   * @param {string} queryText - Query text
   * @param {string[]} texts - Array of texts to compare against
   * @param {number} topK - Number of top results to return
   * @returns {Promise<Array<{text: string, similarity: number}>>} - Top similar texts with scores
   */
  async findSimilarTexts(queryText, texts, topK = 5) {
    if (!queryText || !texts || texts.length === 0) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Generate embeddings for all texts
      const embeddings = await this.generateEmbeddings(texts);
      
      // Calculate similarities
      const similarities = embeddings.map((embedding, index) => ({
        text: texts[index],
        similarity: this.cosineSimilarity(queryEmbedding, embedding)
      }));
      
      // Sort by similarity (descending)
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      // Return top K results
      return similarities.slice(0, topK);
    } catch (error) {
      console.error('Error finding similar texts:', error);
      throw error;
    }
  }
}

module.exports = EmbeddingService;
