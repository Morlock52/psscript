/**
 * Search service for the PowerShell Script Vector Database
 * This service provides functions for searching PowerShell scripts using vector similarity
 */

const { sequelize } = require('../../config/database');
const { QueryTypes } = require('sequelize');
const { generateEmbedding } = require('../embedding/embeddingService');
require('dotenv').config();

/**
 * Search for PowerShell scripts by query
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results to return
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Promise<Array>} - Promise that resolves to an array of search results
 */
async function searchScripts(query, limit = 10, threshold = 0.7) {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Convert embedding to PostgreSQL vector format
    const vectorString = `[${embedding.join(',')}]`;
    
    // Search for scripts using vector similarity
    const results = await sequelize.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.content,
        s.author,
        s.created_at,
        s.updated_at,
        s.views,
        s.downloads,
        s.rating,
        s.file_path,
        s.file_size,
        s.file_hash,
        s.is_public,
        s.is_verified,
        s.version,
        1 - (s.embedding <=> :vectorString) as similarity
      FROM 
        scripts s
      WHERE 
        1 - (s.embedding <=> :vectorString) > :threshold
      ORDER BY 
        similarity DESC
      LIMIT :limit;
    `, {
      replacements: { vectorString, threshold, limit },
      type: QueryTypes.SELECT
    });
    
    return results;
  } catch (error) {
    console.error('Error searching scripts:', error);
    throw error;
  }
}

/**
 * Search for PowerShell scripts by category
 * @param {string} category - Category name
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Promise that resolves to an array of search results
 */
async function searchScriptsByCategory(category, limit = 10) {
  try {
    // Search for scripts by category
    const results = await sequelize.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.content,
        s.author,
        s.created_at,
        s.updated_at,
        s.views,
        s.downloads,
        s.rating,
        s.file_path,
        s.file_size,
        s.file_hash,
        s.is_public,
        s.is_verified,
        s.version
      FROM 
        scripts s
      JOIN 
        script_categories sc ON s.id = sc.script_id
      JOIN 
        categories c ON sc.category_id = c.id
      WHERE 
        c.name = :category
      ORDER BY 
        s.rating DESC, s.downloads DESC
      LIMIT :limit;
    `, {
      replacements: { category, limit },
      type: QueryTypes.SELECT
    });
    
    return results;
  } catch (error) {
    console.error('Error searching scripts by category:', error);
    throw error;
  }
}

/**
 * Search for PowerShell scripts by tag
 * @param {string} tag - Tag name
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Promise that resolves to an array of search results
 */
async function searchScriptsByTag(tag, limit = 10) {
  try {
    // Search for scripts by tag
    const results = await sequelize.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.content,
        s.author,
        s.created_at,
        s.updated_at,
        s.views,
        s.downloads,
        s.rating,
        s.file_path,
        s.file_size,
        s.file_hash,
        s.is_public,
        s.is_verified,
        s.version
      FROM 
        scripts s
      JOIN 
        script_tags st ON s.id = st.script_id
      JOIN 
        tags t ON st.tag_id = t.id
      WHERE 
        t.name = :tag
      ORDER BY 
        s.rating DESC, s.downloads DESC
      LIMIT :limit;
    `, {
      replacements: { tag, limit },
      type: QueryTypes.SELECT
    });
    
    return results;
  } catch (error) {
    console.error('Error searching scripts by tag:', error);
    throw error;
  }
}

/**
 * Search for similar PowerShell scripts
 * @param {number} scriptId - Script ID
 * @param {number} limit - Maximum number of results to return
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Promise<Array>} - Promise that resolves to an array of search results
 */
async function findSimilarScripts(scriptId, limit = 5, threshold = 0.7) {
  try {
    // Get the script's embedding
    const scriptResult = await sequelize.query(
      'SELECT embedding FROM scripts WHERE id = :scriptId;',
      {
        replacements: { scriptId },
        type: QueryTypes.SELECT
      }
    );
    
    if (scriptResult.length === 0) {
      throw new Error(`Script with ID ${scriptId} not found`);
    }
    
    const embedding = scriptResult[0].embedding;
    
    // Search for similar scripts
    const results = await sequelize.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.content,
        s.author,
        s.created_at,
        s.updated_at,
        s.views,
        s.downloads,
        s.rating,
        s.file_path,
        s.file_size,
        s.file_hash,
        s.is_public,
        s.is_verified,
        s.version,
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
      replacements: { embedding, scriptId, threshold, limit },
      type: QueryTypes.SELECT
    });
    
    return results;
  } catch (error) {
    console.error('Error finding similar scripts:', error);
    throw error;
  }
}

module.exports = {
  searchScripts,
  searchScriptsByCategory,
  searchScriptsByTag,
  findSimilarScripts
};
