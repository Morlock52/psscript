/**
 * Utility functions for vector operations
 */
import { sequelize } from '../database/connection';
import logger from './logger';
import { getEmbeddingModel, getOpenAIClient } from '../services/ai/openaiClient';

/**
 * Generate embedding for text using the AI service
 * @param text - Text to generate embedding for
 * @returns Promise that resolves to the embedding vector
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: getEmbeddingModel(),
      input: text.substring(0, 8000)
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('Empty embedding response');
    }
    return embedding;
  } catch (error) {
    logger.error('Error generating embedding:', error);
    throw error;
  }
};

/**
 * Calculate cosine similarity between two vectors
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Cosine similarity (between -1 and 1)
 */
export const cosineSimilarity = (vec1: number[], vec2: number[]): number => {
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
};

/**
 * Search for scripts by vector similarity
 * @param embedding - Query embedding vector
 * @param limit - Maximum number of results to return
 * @param threshold - Similarity threshold (0-1)
 * @param filters - Additional filters for the query
 * @returns Promise that resolves to an array of search results
 */
export const searchByVector = async (
  embedding: number[],
  limit: number = 10,
  threshold: number = 0.7,
  filters: any = {}
): Promise<any[]> => {
  try {
    // Convert embedding to PostgreSQL vector format
    // Validate embedding is an array of numbers to prevent injection
    if (!Array.isArray(embedding) || !embedding.every(n => typeof n === 'number' && isFinite(n))) {
      throw new Error('Invalid embedding format: must be an array of finite numbers');
    }
    const vectorString = `[${embedding.join(',')}]`;

    // Validate threshold is a number between 0 and 1
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
      throw new Error('Invalid threshold: must be a number between 0 and 1');
    }

    // Build WHERE clause using parameterized values for threshold
    // Note: vector comparison uses parameterized vectorString in replacements
    let whereClause = `1 - (s.embedding <=> :vectorString::vector) > :threshold`;
    const replacements: any = {
      vectorString,
      threshold
    };
    
    if (filters.categoryId) {
      whereClause += ' AND s.category_id = :categoryId';
      replacements.categoryId = filters.categoryId;
    }
    
    if (filters.isPublic !== undefined) {
      whereClause += ' AND s.is_public = :isPublic';
      replacements.isPublic = filters.isPublic;
    }
    
    if (filters.userId) {
      whereClause += ' AND s.user_id = :userId';
      replacements.userId = filters.userId;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      whereClause += ` AND s.id IN (
        SELECT st.script_id 
        FROM script_tags st 
        JOIN tags t ON st.tag_id = t.id 
        WHERE t.name IN (:tags)
      )`;
      replacements.tags = filters.tags;
    }
    
    if (filters.keywords && filters.keywords.length > 0) {
      const keywordConditions = filters.keywords.map((_: any, index: number) => 
        `(s.title ILIKE :keyword${index} OR s.description ILIKE :keyword${index} OR s.content ILIKE :keyword${index})`
      ).join(' OR ');
      
      whereClause += ` AND (${keywordConditions})`;
      
      filters.keywords.forEach((keyword: string, index: number) => {
        replacements[`keyword${index}`] = `%${keyword}%`;
      });
    }
    
    // Validate limit is a positive integer to prevent injection
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Invalid limit: must be a positive integer between 1 and 100');
    }
    replacements.limit = limit;

    // Execute the query with vector search using fully parameterized query
    const [results] = await sequelize.query(`
      SELECT
        s.id,
        s.title,
        s.description,
        s.content,
        s.user_id as "userId",
        s.category_id as "categoryId",
        s.version,
        s.execution_count as "executionCount",
        s.is_public as "isPublic",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        s.file_path as "filePath",
        s.file_hash as "fileHash",
        1 - (s.embedding <=> :vectorString::vector) as similarity
      FROM
        scripts s
      WHERE
        ${whereClause}
      ORDER BY
        similarity DESC
      LIMIT :limit;
    `, {
      replacements,
      type: 'SELECT',
      raw: true
    });
    
    return results;
  } catch (error) {
    logger.error('Error searching by vector:', error);
    throw error;
  }
};

/**
 * Hybrid search combining vector similarity and keyword search
 * @param query - Search query
 * @param limit - Maximum number of results to return
 * @param threshold - Similarity threshold (0-1)
 * @param filters - Additional filters for the query
 * @returns Promise that resolves to an array of search results
 */
export const hybridSearch = async (
  query: string,
  limit: number = 10,
  threshold: number = 0.7,
  filters: any = {}
): Promise<any[]> => {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Extract keywords from the query
    const keywords = query.split(/\s+/).filter(word => word.length > 3);
    
    // Add keywords to filters
    const searchFilters = {
      ...filters,
      keywords: keywords
    };
    
    // Perform vector search with keyword filtering
    return await searchByVector(embedding, limit, threshold, searchFilters);
  } catch (error) {
    logger.error('Error performing hybrid search:', error);
    throw error;
  }
};

/**
 * Find similar scripts to a given script
 * @param scriptId - Script ID
 * @param limit - Maximum number of results to return
 * @param threshold - Similarity threshold (0-1)
 * @returns Promise that resolves to an array of similar scripts
 */
export const findSimilarScripts = async (
  scriptId: number,
  limit: number = 5,
  threshold: number = 0.7
): Promise<any[]> => {
  try {
    // Get the script's embedding
    const result = await sequelize.query(`
      SELECT embedding FROM scripts WHERE id = :scriptId;
    `, {
      replacements: { scriptId },
      type: 'SELECT',
      raw: true
    });
    
    // Get the first result
    const scriptResult = result[0] as any;
    
    if (!scriptResult || !scriptResult.embedding) {
      throw new Error(`Script with ID ${scriptId} not found or has no embedding`);
    }
    
    // Convert embedding to array if it's not already
    const embedding = Array.isArray(scriptResult.embedding) 
      ? scriptResult.embedding 
      : JSON.parse(scriptResult.embedding);
    
    // Search for similar scripts
    const [results] = await sequelize.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.user_id as "userId",
        s.category_id as "categoryId",
        s.version,
        s.execution_count as "executionCount",
        s.is_public as "isPublic",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        1 - (s.embedding <=> :embedding) as similarity
      FROM 
        scripts s
      WHERE 
        s.id != :scriptId AND
        1 - (s.embedding <=> :embedding) > :threshold
      ORDER BY 
        similarity DESC
      LIMIT :limit;
    `, {
      replacements: { 
        scriptId,
        embedding: JSON.stringify(embedding),
        threshold,
        limit
      },
      type: 'SELECT',
      raw: true
    });
    
    return results;
  } catch (error) {
    logger.error('Error finding similar scripts:', error);
    throw error;
  }
};
