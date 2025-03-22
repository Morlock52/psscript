/**
 * Embedding service for the PowerShell Script Vector Database
 * This service generates embeddings using OpenAI's API
 */

const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
});

// Get embedding model from environment variables
const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

/**
 * Generate an embedding for a text
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} - Promise that resolves to an array of embedding values
 */
async function generateEmbedding(text) {
  try {
    // Truncate text if it's too long (OpenAI has token limits)
    const truncatedText = truncateText(text, 8000);
    
    // Generate embedding
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: truncatedText,
      encoding_format: 'float'
    });
    
    // Return embedding
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Truncate text to a maximum number of characters
 * @param {string} text - Text to truncate
 * @param {number} maxChars - Maximum number of characters
 * @returns {string} - Truncated text
 */
function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  
  return text.substring(0, maxChars);
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} embedding1 - First embedding
 * @param {number[]} embedding2 - Second embedding
 * @returns {number} - Cosine similarity (between -1 and 1)
 */
function calculateCosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimensions');
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

module.exports = {
  generateEmbedding,
  calculateCosineSimilarity
};
