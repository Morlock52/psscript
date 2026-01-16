/**
 * Script CRUD Controller
 *
 * Handles basic Create, Read, Update, Delete operations for scripts.
 * Migrated from the original ScriptController for better modularity.
 */
import {
  Request,
  Response,
  NextFunction,
  Script,
  ScriptAnalysis,
  User,
  Category,
  Tag,
  ScriptTag,
  ScriptVersion,
  ExecutionLog,
  sequelize,
  Transaction,
  logger,
  axios,
  AI_SERVICE_URL,
  getDbSortField,
  clearScriptCaches,
  fetchScriptAnalysis,
  isAuthorizedForScript,
  getScriptIncludes,
  parsePaginationParams
} from './shared';

import type {
  AuthenticatedRequest,
  PaginatedResponse,
  ScriptCreateInput,
  AIAnalysisResponse
} from './types';

// Import cache directly for typing
import { cache } from '../../index';

/**
 * Get all scripts with pagination and filtering
 */
export async function getScripts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query as Record<string, unknown>);
    const categoryId = req.query.categoryId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const sortField = getDbSortField(req.query.sort as string || 'updatedAt');
    const order = (req.query.order as string) || 'DESC';

    const cacheKey = `scripts:${page}:${limit}:${categoryId || ''}:${userId || ''}:${sortField}:${order}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {};
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
        { model: Category, as: 'category', attributes: ['id', 'name'] }
      ],
      limit,
      offset,
      order: [[sequelize.col(`Script.${sortField}`), order]],
      distinct: true
    });

    // Fetch analysis data separately for each script
    for (const script of rows) {
      const analysis = await fetchScriptAnalysis(script.id);
      if (analysis) {
        script.setDataValue('analysis', analysis);
      }
    }

    const response: PaginatedResponse<typeof rows[0]> = {
      scripts: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    };

    cache.set(cacheKey, response, 300);
    return res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single script by ID
 */
export async function getScript(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;
    const cacheKey = `script:${scriptId}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const script = await Script.findByPk(scriptId, {
      include: getScriptIncludes(false)
    });

    if (!script) {
      return res.status(404).json({ message: 'Script not found' });
    }

    // Fetch analysis separately
    const analysis = await fetchScriptAnalysis(scriptId);
    if (analysis) {
      script.setDataValue('analysis', analysis);
    }

    cache.set(cacheKey, script, 300);
    return res.json(script);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new script with transaction management
 */
export async function createScript(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  let transaction: Transaction | undefined;

  try {
    transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    const { title, description, content, categoryId, tags } = req.body as ScriptCreateInput;
    const userId = req.user?.id;

    if (!userId) {
      await transaction.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!title || !content) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Title and content are required' });
    }

    // Create the script
    const script = await Script.create(
      {
        title,
        description: description || '',
        content,
        userId,
        categoryId: categoryId || null,
        version: 1,
        executionCount: 0,
        isPublic: true
      },
      { transaction }
    );

    logger.info(`Created new script with ID ${script.id}`);

    // Add tags if provided (limit to 10)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagsToProcess = tags.slice(0, 10);

      for (const tagName of tagsToProcess) {
        if (typeof tagName !== 'string' || !tagName.trim()) continue;

        try {
          const [tag] = await Tag.findOrCreate({
            where: { name: tagName.toLowerCase().trim() },
            defaults: { name: tagName.toLowerCase().trim() },
            transaction
          });

          await ScriptTag.create(
            { scriptId: script.id, tagId: tag.id },
            { transaction }
          );
        } catch (tagError) {
          logger.warn(`Failed to create tag "${tagName}": ${(tagError as Error).message}`);
        }
      }
    }

    // Analyze the script with AI service
    let analysis: AIAnalysisResponse | null = null;
    try {
      const openaiApiKey = req.headers['x-openai-api-key'] as string;
      const analysisConfig: { headers: Record<string, string>; timeout: number } = {
        headers: {},
        timeout: 15000
      };

      if (openaiApiKey) {
        analysisConfig.headers['x-api-key'] = openaiApiKey;
      }

      logger.info(`Sending script ${script.id} for AI analysis`);

      const analysisResponse = await Promise.race([
        axios.post(`${AI_SERVICE_URL}/analyze`, {
          script_id: script.id,
          content,
          include_command_details: true,
          fetch_ms_docs: true
        }, analysisConfig),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Analysis request timed out')), 15000)
        )
      ]);

      analysis = (analysisResponse as { data: AIAnalysisResponse }).data;

      await ScriptAnalysis.create(
        {
          scriptId: script.id,
          purpose: analysis?.purpose || 'No purpose provided',
          parameters: analysis?.parameters || {},
          securityScore: analysis?.security_score || 5.0,
          codeQualityScore: analysis?.code_quality_score || 5.0,
          riskScore: analysis?.risk_score || 5.0,
          optimizationSuggestions: analysis?.optimization || [],
          commandDetails: analysis?.command_details || [],
          msDocsReferences: analysis?.ms_docs_references || []
        },
        { transaction }
      );

      logger.info(`Created analysis for script ${script.id}`);

      // Update category if AI suggested one and none was provided
      if (!categoryId && analysis?.category_id) {
        await script.update({ categoryId: analysis.category_id }, { transaction });
      }
    } catch (analysisError) {
      logger.error(`AI analysis failed for script ${script.id}:`, analysisError);

      // Create default analysis on failure
      await ScriptAnalysis.create(
        {
          scriptId: script.id,
          purpose: 'Analysis pending',
          parameters: {},
          securityScore: 5.0,
          codeQualityScore: 5.0,
          riskScore: 5.0,
          optimizationSuggestions: [],
          commandDetails: [],
          msDocsReferences: []
        },
        { transaction }
      );
    }

    await transaction.commit();
    logger.info(`Transaction committed for script ${script.id}`);

    clearScriptCaches();

    // Fetch complete script with associations
    const completeScript = await Script.findByPk(script.id, {
      include: getScriptIncludes(true)
    });

    return res.status(201).json(completeScript);
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
        logger.info('Transaction rolled back due to error');
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
    }

    // Handle specific error types
    const err = error as { name?: string; errors?: Array<{ message: string }> };
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        message: 'A script with this title already exists',
        error: 'unique_constraint_error'
      });
    }

    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: 'Validation error',
        error: 'validation_error',
        details: err.errors?.map((e) => e.message)
      });
    }

    logger.error('Error creating script:', error);
    next(error);
  }
}

/**
 * Delete a script with cascading cleanup
 */
export async function deleteScript(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<Response> {
  let transaction: Transaction | undefined;

  try {
    const scriptId = req.params.id;

    transaction = await sequelize.transaction();

    const script = await Script.findByPk(scriptId);

    if (!script) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Script not found',
        success: false
      });
    }

    if (!isAuthorizedForScript(script, req)) {
      await transaction.rollback();
      return res.status(403).json({
        message: 'Not authorized to delete this script',
        success: false
      });
    }

    // Delete all related records in order
    await ScriptAnalysis.destroy({ where: { scriptId }, transaction });
    await ScriptTag.destroy({ where: { scriptId }, transaction });
    await ScriptVersion.destroy({ where: { scriptId }, transaction });
    await ExecutionLog.destroy({ where: { scriptId }, transaction });
    await script.destroy({ transaction });

    await transaction.commit();

    clearScriptCaches(scriptId);

    return res.json({
      message: 'Script deleted successfully',
      id: scriptId,
      success: true
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
    }

    logger.error('Error deleting script:', error);
    return res.status(500).json({
      message: 'Failed to delete script',
      error: (error as Error).message,
      success: false
    });
  }
}

/**
 * Update an existing script with version tracking
 */
export async function updateScript(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  let transaction: Transaction | undefined;

  try {
    transaction = await sequelize.transaction();

    const scriptId = req.params.id;
    const { title, description, content, categoryId, isPublic, tags } = req.body as {
      title?: string;
      description?: string;
      content?: string;
      categoryId?: number | null;
      isPublic?: boolean;
      tags?: string[];
    };

    const script = await Script.findByPk(scriptId);

    if (!script) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Script not found' });
    }

    // Check authorization
    if (!isAuthorizedForScript(script, req)) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Not authorized to update this script' });
    }

    // Create a new version if content changed
    if (content && content !== script.content) {
      await script.update(
        {
          version: script.version + 1,
          title: title ?? script.title,
          description: description ?? script.description,
          content,
          categoryId: categoryId ?? script.categoryId,
          isPublic: isPublic ?? script.isPublic
        },
        { transaction }
      );

      // Re-analyze if content changed
      try {
        const openaiApiKey = req.headers['x-openai-api-key'] as string;
        const analysisConfig: { headers: Record<string, string>; timeout: number } = {
          headers: {},
          timeout: 15000
        };

        if (openaiApiKey) {
          analysisConfig.headers['x-api-key'] = openaiApiKey;
        }

        const analysisResponse = await axios.post(
          `${AI_SERVICE_URL}/analyze`,
          {
            script_id: script.id,
            content,
            include_command_details: true,
            fetch_ms_docs: true
          },
          analysisConfig
        );

        const analysis = analysisResponse.data as AIAnalysisResponse;

        // Update existing analysis or create new
        await ScriptAnalysis.upsert(
          {
            scriptId: script.id,
            purpose: analysis.purpose || '',
            parameters: analysis.parameters || {},
            securityScore: analysis.security_score || 5.0,
            codeQualityScore: analysis.code_quality_score || 5.0,
            riskScore: analysis.risk_score || 5.0,
            optimizationSuggestions: analysis.optimization || [],
            commandDetails: analysis.command_details || [],
            msDocsReferences: analysis.ms_docs_references || []
          },
          { transaction }
        );
      } catch (analysisError) {
        logger.error('AI analysis failed on update:', analysisError);
        // Continue without re-analysis
      }
    } else {
      // Update without changing version if only metadata changed
      await script.update(
        {
          title: title ?? script.title,
          description: description ?? script.description,
          categoryId: categoryId ?? script.categoryId,
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

      // Add new tags (limit to 10)
      const tagsToProcess = tags.slice(0, 10);
      for (const tagName of tagsToProcess) {
        if (typeof tagName !== 'string' || !tagName.trim()) continue;

        try {
          const [tag] = await Tag.findOrCreate({
            where: { name: tagName.toLowerCase().trim() },
            defaults: { name: tagName.toLowerCase().trim() },
            transaction
          });

          await ScriptTag.create(
            { scriptId: parseInt(scriptId, 10), tagId: tag.id },
            { transaction }
          );
        } catch (tagError) {
          logger.warn(`Failed to update tag "${tagName}": ${(tagError as Error).message}`);
        }
      }
    }

    await transaction.commit();

    // Clear relevant caches
    clearScriptCaches(scriptId);

    // Fetch the updated script with associations
    const updatedScript = await Script.findByPk(scriptId, {
      include: getScriptIncludes(true)
    });

    return res.json(updatedScript);
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
    }
    next(error);
  }
}

// Export as a controller object for compatibility
export const ScriptCrudController = {
  getScripts,
  getScript,
  createScript,
  updateScript,
  deleteScript
};
