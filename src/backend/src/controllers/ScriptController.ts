import { Request, Response, NextFunction } from 'express';
// Temporarily use mock models for development
//import { Script, ScriptAnalysis, Category, User, Tag, ScriptTag, sequelize } from '../models';
import { Op } from 'sequelize';
import redisClient from '../utils/redis';
import axios from 'axios';
import logger from '../utils/logger';

// Mock models for development
const Script = {
  findByPk: () => ({}),
  findAll: () => [],
  findAndCountAll: () => ({ count: 0, rows: [] }),
  update: () => {},
  destroy: () => {},
  create: () => ({})
};

const ExecutionLog = {
  create: () => ({})
};

const sequelize = {
  transaction: () => ({
    commit: () => {},
    rollback: () => {}
  })
};

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

class ScriptController {
  
  // Get all scripts with pagination and filtering
  async getScripts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      const categoryId = req.query.categoryId as string;
      const userId = req.query.userId as string;
      const sort = req.query.sort as string || 'updatedAt';
      const order = req.query.order as string || 'DESC';
      
      const cacheKey = `scripts:${page}:${limit}:${categoryId || ''}:${userId || ''}:${sort}:${order}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
      
      const whereClause: any = {};
      
      if (categoryId) {
        whereClause.categoryId = categoryId;
      }
      
      if (userId) {
        whereClause.userId = userId;
      }
      
      const { count, rows } = await Script.findAndCountAll({
        where: whereClause,
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          { model: Category, as: 'category', attributes: ['id', 'name'] },
          { model: ScriptAnalysis, as: 'analysis' }
        ],
        limit,
        offset,
        order: [[sort, order]],
        distinct: true
      });
      
      const response = {
        scripts: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit)
      };
      
      await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 300); // Cache for 5 minutes
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
  
  // Get a single script by ID
  async getScript(req: Request, res: Response, next: NextFunction) {
    try {
      const scriptId = req.params.id;
      const cacheKey = `script:${scriptId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
      
      const script = await Script.findByPk(scriptId, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          { model: Category, as: 'category' },
          { model: ScriptAnalysis, as: 'analysis' },
          { 
            model: Tag, 
            as: 'tags',
            through: { attributes: [] } // Don't include join table
          }
        ]
      });
      
      if (!script) {
        return res.status(404).json({ message: 'Script not found' });
      }
      
      await redisClient.set(cacheKey, JSON.stringify(script), 'EX', 300); // Cache for 5 minutes
      
      res.json(script);
    } catch (error) {
      next(error);
    }
  }
  
  // Create a new script
  async createScript(req: Request, res: Response, next: NextFunction) {
    const transaction = await sequelize.transaction();
    
    try {
      const { title, description, content, categoryId, tags } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Create the script
      const script = await Script.create({
        title,
        description,
        content,
        userId,
        categoryId: categoryId || null,
        version: 1,
        executionCount: 0,
        isPublic: true
      }, { transaction });
      
      // Analyze the script with AI service
      try {
        const analysisResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, {
          script_id: script.id,
          content
        });
        
        const analysis = analysisResponse.data;
        
        await ScriptAnalysis.create({
          scriptId: script.id,
          purpose: analysis.purpose,
          parameters: analysis.parameters || {},
          securityScore: analysis.security_score,
          codeQualityScore: analysis.code_quality_score,
          riskScore: analysis.risk_score,
          optimizationSuggestions: analysis.optimization_suggestions || [],
          aiComments: analysis.comments
        }, { transaction });
        
        // Update the script with the determined category if not manually set
        if (!categoryId && analysis.category_id) {
          await script.update({ categoryId: analysis.category_id }, { transaction });
        }
      } catch (analysisError) {
        logger.error('AI analysis failed:', analysisError);
        // Continue without analysis if AI service fails
      }
      
      // Add tags if provided
      if (tags && Array.isArray(tags) && tags.length > 0) {
        for (const tagName of tags) {
          // Find or create the tag
          const [tag] = await Tag.findOrCreate({
            where: { name: tagName.toLowerCase() },
            defaults: { name: tagName.toLowerCase() },
            transaction
          });
          
          await ScriptTag.create({
            scriptId: script.id,
            tagId: tag.id
          }, { transaction });
        }
      }
      
      await transaction.commit();
      
      // Clear relevant caches
      await redisClient.del('scripts:*');
      
      // Fetch the complete script with associations
      const completeScript = await Script.findByPk(script.id, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          { model: Category, as: 'category' },
          { model: ScriptAnalysis, as: 'analysis' },
          { 
            model: Tag, 
            as: 'tags',
            through: { attributes: [] }
          }
        ]
      });
      
      res.status(201).json(completeScript);
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }
  
  // Update a script
  async updateScript(req: Request, res: Response, next: NextFunction) {
    const transaction = await sequelize.transaction();
    
    try {
      const scriptId = req.params.id;
      const { title, description, content, categoryId, isPublic, tags } = req.body;
      const userId = req.user?.id;
      
      const script = await Script.findByPk(scriptId);
      
      if (!script) {
        return res.status(404).json({ message: 'Script not found' });
      }
      
      // Check ownership unless admin
      if (script.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to update this script' });
      }
      
      // Create a new version if content changed
      if (content && content !== script.content) {
        await script.update(
          { 
            version: script.version + 1,
            title,
            description,
            content,
            categoryId: categoryId || script.categoryId,
            isPublic: isPublic ?? script.isPublic
          }, 
          { transaction }
        );
        
        // Re-analyze if content changed
        try {
          const analysisResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, {
            script_id: script.id,
            content
          });
          
          const analysis = analysisResponse.data;
          
          // Update existing analysis or create new
          await ScriptAnalysis.upsert({
            scriptId: script.id,
            purpose: analysis.purpose,
            parameters: analysis.parameters || {},
            securityScore: analysis.security_score,
            codeQualityScore: analysis.code_quality_score,
            riskScore: analysis.risk_score,
            optimizationSuggestions: analysis.optimization_suggestions || [],
            aiComments: analysis.comments
          }, { transaction });
        } catch (analysisError) {
          logger.error('AI analysis failed on update:', analysisError);
          // Continue without re-analysis
        }
      } else {
        // Update without changing version if only metadata changed
        await script.update(
          { 
            title,
            description,
            categoryId: categoryId || script.categoryId,
            isPublic: isPublic ?? script.isPublic
          },
          { transaction }
        );
      }
      
      // Update tags if provided
      if (tags && Array.isArray(tags)) {
        // Remove existing tags
        await ScriptTag.destroy({
          where: { scriptId },
          transaction
        });
        
        // Add new tags
        for (const tagName of tags) {
          const [tag] = await Tag.findOrCreate({
            where: { name: tagName.toLowerCase() },
            defaults: { name: tagName.toLowerCase() },
            transaction
          });
          
          await ScriptTag.create({
            scriptId,
            tagId: tag.id
          }, { transaction });
        }
      }
      
      await transaction.commit();
      
      // Clear relevant caches
      await redisClient.del(`script:${scriptId}`);
      await redisClient.del('scripts:*');
      
      // Fetch the updated script with associations
      const updatedScript = await Script.findByPk(scriptId, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          { model: Category, as: 'category' },
          { model: ScriptAnalysis, as: 'analysis' },
          { 
            model: Tag, 
            as: 'tags',
            through: { attributes: [] }
          }
        ]
      });
      
      res.json(updatedScript);
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }
  
  // Delete a script
  async deleteScript(req: Request, res: Response, next: NextFunction) {
    try {
      const scriptId = req.params.id;
      const userId = req.user?.id;
      
      const script = await Script.findByPk(scriptId);
      
      if (!script) {
        return res.status(404).json({ message: 'Script not found' });
      }
      
      // Check ownership unless admin
      if (script.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to delete this script' });
      }
      
      await script.destroy();
      
      // Clear relevant caches
      await redisClient.del(`script:${scriptId}`);
      await redisClient.del('scripts:*');
      
      res.json({ message: 'Script deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  // Search scripts
  async searchScripts(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query.q as string;
      const categoryId = req.query.categoryId as string;
      const qualityThreshold = req.query.qualityThreshold ? parseFloat(req.query.qualityThreshold as string) : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      
      const cacheKey = `search:${query}:${categoryId || ''}:${qualityThreshold || ''}:${page}:${limit}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
      
      // Search criteria
      const whereClause: any = {};
      
      if (query) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
          { content: { [Op.iLike]: `%${query}%` } }
        ];
      }
      
      if (categoryId) {
        whereClause.categoryId = categoryId;
      }
      
      // For quality filter we need a join with analysis
      const includeOptions: any[] = [
        { model: User, as: 'user', attributes: ['id', 'username'] },
        { model: Category, as: 'category' }
      ];
      
      if (qualityThreshold !== undefined) {
        includeOptions.push({
          model: ScriptAnalysis,
          as: 'analysis',
          where: {
            codeQualityScore: { [Op.gte]: qualityThreshold }
          },
          required: true
        });
      } else {
        includeOptions.push({
          model: ScriptAnalysis,
          as: 'analysis'
        });
      }
      
      const { count, rows } = await Script.findAndCountAll({
        where: whereClause,
        include: includeOptions,
        limit,
        offset,
        order: [['updatedAt', 'DESC']],
        distinct: true
      });
      
      const response = {
        scripts: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        query
      };
      
      await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 300); // Cache for 5 minutes
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
  
  // Get script analysis
  async getScriptAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const scriptId = req.params.id;
      
      const analysis = await ScriptAnalysis.findOne({
        where: { scriptId }
      });
      
      if (!analysis) {
        return res.status(404).json({ message: 'Analysis not found' });
      }
      
      res.json(analysis);
    } catch (error) {
      next(error);
    }
  }
  
  // Execute a script
  async executeScript(req: Request, res: Response, next: NextFunction) {
    try {
      const scriptId = req.params.id;
      const { params } = req.body;
      const userId = req.user?.id;
      
      const script = await Script.findByPk(scriptId);
      
      if (!script) {
        return res.status(404).json({ message: 'Script not found' });
      }
      
      // Here you would implement the actual PowerShell script execution
      // This is a simplified placeholder implementation
      
      // Increment execution count
      await script.update({
        executionCount: script.executionCount + 1
      });
      
      // Record execution in logs
      await ExecutionLog.create({
        scriptId,
        userId,
        parameters: params || {},
        status: 'success',
        output: 'Script executed successfully',
        executionTime: 1.25 // This would be the actual execution time
      });
      
      res.json({
        success: true,
        output: 'Script executed successfully',
        executionTime: 1.25,
        timestamp: new Date()
      });
    } catch (error) {
      next(error);
    }
  }
  
  // Analyze a script without saving
  async analyzeScript(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: 'Script content is required' });
      }
      
      try {
        const analysisResponse = await axios.post(`${AI_SERVICE_URL}/analyze-preview`, {
          content
        });
        
        res.json(analysisResponse.data);
      } catch (analysisError: any) {
        if (analysisError.response) {
          logger.error('AI analysis error:', analysisError.response.data);
          return res.status(analysisError.response.status).json({
            message: 'Analysis failed',
            error: analysisError.response.data
          });
        }
        
        logger.error('AI service connection error:', analysisError.message);
        return res.status(500).json({
          message: 'Could not connect to analysis service',
          error: analysisError.message
        });
      }
    } catch (error) {
      next(error);
    }
  }
  
  // Find similar scripts
  async findSimilarScripts(req: Request, res: Response, next: NextFunction) {
    try {
      const scriptId = req.params.id;
      
      // This would use the embedding service to find similar scripts
      // For now, return a simplified response
      const similarScripts = await Script.findAll({
        where: {
          id: { [Op.ne]: scriptId }
        },
        limit: 5,
        include: [
          { model: Category, as: 'category' }
        ],
        order: [['updatedAt', 'DESC']]
      });
      
      // Calculate a mock similarity score
      const response = similarScripts.map(script => ({
        script_id: script.id,
        title: script.title,
        category: script.category?.name,
        similarity: (Math.random() * 0.5) + 0.5 // Random score between 0.5 and 1.0
      }));
      
      res.json({
        similar_scripts: response
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ScriptController();