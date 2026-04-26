/**
 * Script CRUD Controller
 *
 * Handles basic Create, Read, Update, Delete operations for scripts.
 * Migrated from the original ScriptController for better modularity.
 */
import { validationResult } from 'express-validator';
import { errors as apiErrors, fail } from '../../utils/responseHelpers';
import {
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
  CACHE_TTL,
  TIMEOUTS,
  getDbSortField,
  clearScriptCaches,
  fetchScriptAnalysis,
  fetchScriptAnalysesBatch,
  isAuthorizedForScript,
  getScriptIncludes,
  parsePaginationParams,
  Op,
  getCache
} from './shared';

import type {
  AuthenticatedRequest,
  PaginatedResponse,
  ScriptCreateInput,
  AIAnalysisResponse
} from './types';

const isValidUserIdFilter = (value: string): boolean => {
  return /^\d+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const normalizeUserIdFilter = (value?: string): number | string | undefined => {
  if (!value) {
    return undefined;
  }

  return /^\d+$/.test(value) ? parseInt(value, 10) : value;
};

/**
 * Run AI analysis with retry and exponential backoff.
 * Fire-and-forget: call with `void runAnalysisWithRetry(...)`.
 *
 * Best practice (2026): Background tasks should retry transient failures
 * with exponential backoff (max 2-3 retries) so a brief AI service
 * hiccup doesn't permanently lose the analysis.
 */
async function runAnalysisWithRetry(
  scriptId: number,
  content: string,
  categoryId: number | null | undefined,
  openaiApiKey: string | undefined,
  maxRetries = 2
): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const analysisConfig: { headers: Record<string, string>; timeout: number } = {
        headers: {},
        timeout: TIMEOUTS.QUICK
      };
      if (openaiApiKey) {
        analysisConfig.headers['x-api-key'] = openaiApiKey;
      }

      logger.info(`AI analysis for script ${scriptId} (attempt ${attempt + 1}/${maxRetries + 1})`);

      const analysisResponse = await axios.post(
        `${AI_SERVICE_URL}/analyze`,
        {
          script_id: scriptId,
          content,
          include_command_details: true,
          fetch_ms_docs: true
        },
        analysisConfig
      );

      const analysis = analysisResponse.data as AIAnalysisResponse;

      await ScriptAnalysis.upsert({
        scriptId,
        purpose: analysis?.purpose || 'No purpose provided',
        parameters: analysis?.parameters || {},
        securityScore: analysis?.security_score || 5.0,
        codeQualityScore: analysis?.code_quality_score || 5.0,
        riskScore: analysis?.risk_score || 5.0,
        optimizationSuggestions: analysis?.optimization || [],
        commandDetails: analysis?.command_details || [],
        msDocsReferences: analysis?.ms_docs_references || []
      });

      if (!categoryId && analysis?.category_id) {
        await Script.update(
          { categoryId: analysis.category_id },
          { where: { id: scriptId } }
        );
      }

      clearScriptCaches(String(scriptId));
      logger.info(`AI analysis complete for script ${scriptId}`);
      return; // success — exit retry loop
    } catch (err) {
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) {
        logger.error(`AI analysis failed for script ${scriptId} after ${maxRetries + 1} attempts:`, err);
      } else {
        const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s
        logger.warn(`AI analysis attempt ${attempt + 1} failed for script ${scriptId}, retrying in ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
}

/**
 * Get all scripts with pagination and filtering
 */
export async function getScripts(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const cache = getCache();
    const { page, limit, offset } = parsePaginationParams(req.query as Record<string, unknown>);
    const categoryId = req.query.categoryId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const requestedUserId = normalizeUserIdFilter(userId);
    const isAdmin = req.user?.role === 'admin';
    const viewerId = req.user?.id;
    const sortField = getDbSortField(req.query.sort as string || 'updatedAt');
    const order = (req.query.order as string) || 'DESC';

    if (userId && !isValidUserIdFilter(userId)) {
      return apiErrors.badRequest(res, 'Invalid userId filter');
    }

    if (userId && !isAdmin && String(requestedUserId) !== String(viewerId)) {
      return apiErrors.forbidden(res, 'Cannot query scripts for another user');
    }

    const cacheKey = `scripts:${page}:${limit}:${categoryId || ''}:${userId || ''}:${sortField}:${order}:${isAdmin ? 'admin' : `user-${viewerId || 'anon'}`}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Build where clause
    const whereClauses: Record<string, unknown>[] = [];
    if (categoryId) {
      whereClauses.push({ categoryId });
    }
    if (userId) {
      whereClauses.push({ userId: requestedUserId });
    }

    if (!isAdmin) {
      const visibilityFilter = viewerId
        ? { [Op.or]: [{ isPublic: true }, { userId: viewerId }] }
        : { isPublic: true };
      whereClauses.push(visibilityFilter);
    }

    const whereClause = whereClauses.length === 1
      ? whereClauses[0]
      : whereClauses.length > 1
        ? { [Op.and]: whereClauses }
        : {};

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

    // Batch fetch all analyses in a single query (avoids N+1)
    const scriptIds = rows.map(script => script.id);
    const analysisMap = await fetchScriptAnalysesBatch(scriptIds);

    // Assign analyses using O(1) Map lookup
    for (const script of rows) {
      const analysis = analysisMap.get(script.id);
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

    cache.set(cacheKey, response, CACHE_TTL.SHORT);
    return res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single script by ID
 */
export async function getScript(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const cache = getCache();
    const isAdmin = req.user?.role === 'admin';
    const viewerId = req.user?.id;
    const scriptId = req.params.id;
    const cacheKey = `script:${scriptId}:${isAdmin ? 'admin' : `user-${viewerId || 'anon'}`}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const script = await Script.findByPk(scriptId, {
      include: getScriptIncludes(false)
    });

    if (!script) {
      return apiErrors.notFound(res, 'Script not found');
    }

    if (!isAdmin && !script.isPublic && String(script.userId) !== String(viewerId)) {
      return apiErrors.forbidden(res, 'Insufficient permissions to view this script');
    }

    // Fetch analysis separately
    const analysis = await fetchScriptAnalysis(scriptId);
    if (analysis) {
      script.setDataValue('analysis', analysis);
    }

    cache.set(cacheKey, script, CACHE_TTL.SHORT);
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
  // Check express-validator results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, 400, 'VALIDATION_ERROR', errors.array()[0].msg, { validationErrors: errors.array() });
  }

  let transaction: Transaction | undefined;

  try {
    transaction = await sequelize.transaction();

    const { title, description, content, categoryId, tags } = req.body as ScriptCreateInput;
    const userId = req.user?.id;

    if (!userId) {
      await transaction.rollback();
      return apiErrors.unauthorized(res);
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

    await transaction.commit();
    logger.info(`Transaction committed for script ${script.id}`);

    clearScriptCaches();

    // Fetch complete script with associations
    const completeScript = await Script.findByPk(script.id, {
      include: getScriptIncludes(true)
    });

    // Fire-and-forget AI analysis with retry
    const openaiApiKey = req.headers['x-openai-api-key'] as string | undefined;
    void runAnalysisWithRetry(script.id, content, categoryId, openaiApiKey);

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
      return apiErrors.conflict(res, 'A script with this title already exists');
    }

    if (err.name === 'SequelizeValidationError') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', {
        fields: err.errors?.map((e) => e.message)
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
      return apiErrors.notFound(res, 'Script not found');
    }

    if (!isAuthorizedForScript(script, req)) {
      await transaction.rollback();
      return apiErrors.forbidden(res, 'Not authorized to delete this script');
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
      success: true,
      data: { id: scriptId, message: 'Script deleted successfully' }
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
    return apiErrors.internal(res, 'Failed to delete script');
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
  // Check express-validator results
  const valErrors = validationResult(req);
  if (!valErrors.isEmpty()) {
    return fail(res, 400, 'VALIDATION_ERROR', valErrors.array()[0].msg, { validationErrors: valErrors.array() });
  }

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
      return apiErrors.notFound(res, 'Script not found');
    }

    // Check authorization
    if (!isAuthorizedForScript(script, req)) {
      await transaction.rollback();
      return apiErrors.forbidden(res, 'Not authorized to update this script');
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

      // Fire-and-forget re-analysis with retry
      const openaiApiKey = req.headers['x-openai-api-key'] as string;
      void runAnalysisWithRetry(script.id, content, categoryId, openaiApiKey);
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
