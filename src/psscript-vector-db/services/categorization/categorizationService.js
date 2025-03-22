const { PowerShellScript, Category } = require('../../models');
const { sequelize } = require('../../config/database');
const embeddingService = require('../embedding/embeddingService');

/**
 * Service for categorizing PowerShell scripts
 */
class CategorizationService {
  /**
   * Categorize a PowerShell script
   * @param {string} scriptId - ID of the script to categorize
   * @returns {Promise<Object>} - Categorization results
   */
  async categorizeScript(scriptId) {
    try {
      // Get the script
      const script = await PowerShellScript.findByPk(scriptId);
      
      if (!script) {
        throw new Error(`Script with ID ${scriptId} not found`);
      }
      
      // Get all categories
      const categories = await Category.findAll();
      
      if (categories.length === 0) {
        throw new Error('No categories found');
      }
      
      // Determine the best category for the script
      const bestCategory = await this.determineBestCategory(script, categories);
      
      // Update the script with the category
      await script.update({
        categoryId: bestCategory.id
      });
      
      return {
        script,
        category: bestCategory
      };
    } catch (error) {
      console.error('Error categorizing script:', error);
      throw error;
    }
  }
  
  /**
   * Determine the best category for a script
   * @param {Object} script - Script object
   * @param {Array} categories - Array of category objects
   * @returns {Promise<Object>} - Best category
   */
  async determineBestCategory(script, categories) {
    try {
      // If script already has an embedding, use it
      let scriptEmbedding = script.embedding;
      
      // If not, generate an embedding
      if (!scriptEmbedding) {
        scriptEmbedding = await embeddingService.generateEmbedding(
          `${script.name} ${script.description || ''} ${script.content}`
        );
        
        // Update the script with the embedding
        await script.update({
          embedding: scriptEmbedding
        });
      }
      
      // Generate embeddings for category descriptions if not already done
      const categoryEmbeddings = await this.getCategoryEmbeddings(categories);
      
      // Calculate similarity scores
      const similarityScores = categories.map((category, index) => {
        const similarity = embeddingService.cosineSimilarity(
          scriptEmbedding,
          categoryEmbeddings[index]
        );
        
        return {
          category,
          similarity
        };
      });
      
      // Sort by similarity score (descending)
      similarityScores.sort((a, b) => b.similarity - a.similarity);
      
      // Return the best category
      return similarityScores[0].category;
    } catch (error) {
      console.error('Error determining best category:', error);
      throw error;
    }
  }
  
  /**
   * Get embeddings for categories
   * @param {Array} categories - Array of category objects
   * @returns {Promise<Array>} - Array of category embeddings
   */
  async getCategoryEmbeddings(categories) {
    try {
      // Check if categories have metadata.embedding
      const categoriesToEmbed = [];
      const existingEmbeddings = [];
      const categoryIndexMap = {};
      
      // Separate categories with and without embeddings
      categories.forEach((category, index) => {
        if (category.metadata && category.metadata.embedding) {
          existingEmbeddings[index] = category.metadata.embedding;
        } else {
          categoriesToEmbed.push(category);
          categoryIndexMap[categoriesToEmbed.length - 1] = index;
        }
      });
      
      // If all categories have embeddings, return them
      if (categoriesToEmbed.length === 0) {
        return existingEmbeddings;
      }
      
      // Generate embeddings for categories without them
      const categoryTexts = categoriesToEmbed.map(category => 
        `${category.name} ${category.description || ''}`
      );
      
      const newEmbeddings = await embeddingService.generateEmbeddings(categoryTexts);
      
      // Update categories with new embeddings
      const updatePromises = categoriesToEmbed.map(async (category, index) => {
        const metadata = category.metadata || {};
        metadata.embedding = newEmbeddings[index];
        
        await category.update({
          metadata
        });
        
        // Add to existing embeddings array
        existingEmbeddings[categoryIndexMap[index]] = newEmbeddings[index];
      });
      
      await Promise.all(updatePromises);
      
      return existingEmbeddings;
    } catch (error) {
      console.error('Error getting category embeddings:', error);
      throw error;
    }
  }
  
  /**
   * Categorize all uncategorized scripts
   * @returns {Promise<Object>} - Categorization results
   */
  async categorizeAllUncategorized() {
    try {
      // Get all uncategorized scripts
      const scripts = await PowerShellScript.findAll({
        where: {
          categoryId: null
        }
      });
      
      if (scripts.length === 0) {
        return {
          message: 'No uncategorized scripts found',
          count: 0
        };
      }
      
      // Get all categories
      const categories = await Category.findAll();
      
      if (categories.length === 0) {
        throw new Error('No categories found');
      }
      
      // Categorize each script
      const results = [];
      
      for (const script of scripts) {
        const result = await this.categorizeScript(script.id);
        results.push(result);
      }
      
      return {
        message: `Categorized ${results.length} scripts`,
        count: results.length,
        results
      };
    } catch (error) {
      console.error('Error categorizing all uncategorized scripts:', error);
      throw error;
    }
  }
  
  /**
   * Get category distribution
   * @returns {Promise<Array>} - Category distribution
   */
  async getCategoryDistribution() {
    try {
      // Get count of scripts in each category
      const distribution = await sequelize.query(`
        SELECT 
          c.id, 
          c.name, 
          COUNT(ps.id) as script_count
        FROM 
          categories c
        LEFT JOIN 
          powershell_scripts ps ON c.id = ps.category_id
        GROUP BY 
          c.id, c.name
        ORDER BY 
          script_count DESC
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      return distribution;
    } catch (error) {
      console.error('Error getting category distribution:', error);
      throw error;
    }
  }
  
  /**
   * Suggest new categories based on script clusters
   * @param {number} minClusterSize - Minimum cluster size
   * @returns {Promise<Array>} - Suggested categories
   */
  async suggestNewCategories(minClusterSize = 5) {
    try {
      // This is a placeholder for a more sophisticated clustering algorithm
      // In a real implementation, you would use a clustering algorithm like k-means
      // to identify clusters of scripts that don't fit well into existing categories
      
      // Get all scripts with embeddings
      const scripts = await PowerShellScript.findAll({
        where: {
          embedding: {
            [sequelize.Op.not]: null
          }
        },
        attributes: ['id', 'name', 'description', 'embedding', 'categoryId']
      });
      
      // Get all categories
      const categories = await Category.findAll();
      
      // For now, just return a placeholder suggestion
      return [
        {
          name: 'Suggested Category',
          description: 'This is a placeholder for a suggested category',
          scripts: scripts.slice(0, minClusterSize).map(s => s.id)
        }
      ];
    } catch (error) {
      console.error('Error suggesting new categories:', error);
      throw error;
    }
  }
}

module.exports = new CategorizationService();
