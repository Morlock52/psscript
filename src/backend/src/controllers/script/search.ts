/**
 * Script Search Controller
 *
 * Handles search and similarity operations for scripts.
 * Migrated from the original ScriptController for better modularity.
 */
import {
  Response,
  NextFunction,
  Script,
  ScriptAnalysis,
  User,
  Category,
  Op,
  sequelize,
  logger,
  findSimilarScriptsByVector,
  CACHE_TTL,
  getCache
} from './shared';

import type { AuthenticatedRequest } from './types';

/**
 * Search scripts by keyword and filters
 */
export async function searchScripts(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const cache = getCache();
    const query = req.query.q as string;
    const categoryId = req.query.categoryId as string | undefined;
    const isAdmin = req.user?.role === 'admin';
    const viewerId = req.user?.id;
    const qualityThreshold = req.query.qualityThreshold
      ? parseFloat(req.query.qualityThreshold as string)
      : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const cacheKey = `search:${query || ''}:${categoryId || ''}:${qualityThreshold || ''}:${page}:${limit}:${isAdmin ? 'admin' : `user-${viewerId || 'anon'}`}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const whereConditions: Record<string, unknown>[] = [];

    if (query) {
      whereConditions.push({
        [Op.or]: [
        { title: { [Op.iLike]: `%${query}%` } },
        { description: { [Op.iLike]: `%${query}%` } },
        { content: { [Op.iLike]: `%${query}%` } }
        ]
      });
    }

    if (categoryId) {
      whereConditions.push({ categoryId });
    }

    if (!isAdmin) {
      whereConditions.push(viewerId
        ? { [Op.or]: [{ isPublic: true }, { userId: viewerId }] }
        : { isPublic: true });
    }

    const whereClause = whereConditions.length === 1
      ? whereConditions[0]
      : whereConditions.length > 1
        ? { [Op.and]: whereConditions }
        : {};

    // Build include options
    type IncludeOption = {
      model: typeof User | typeof Category | typeof ScriptAnalysis;
      as: string;
      attributes?: string[];
      where?: Record<string, unknown>;
      required?: boolean;
    };
    const includeOptions: IncludeOption[] = [
      { model: User, as: 'user', attributes: ['id', 'username'] },
      { model: Category, as: 'category', attributes: ['id', 'name', 'description', 'created_at'] }
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
      order: [[sequelize.col('Script.updated_at'), 'DESC']],
      distinct: true
    });

    const response = {
      scripts: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      query
    };

    cache.set(cacheKey, response, CACHE_TTL.SHORT);

    return res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Find similar scripts using vector similarity search
 */
export async function findSimilarScripts(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 5;
    const threshold = parseFloat(req.query.threshold as string) || 0.7;
    const isAdmin = req.user?.role === 'admin';
    const viewerId = req.user?.id;

    // Check if we have a valid script ID
    if (isNaN(scriptId)) {
      return res.status(400).json({
        message: 'Invalid script ID',
        success: false
      });
    }

    // Get the script to verify it exists
    const script = await Script.findByPk(scriptId, {
      attributes: ['id', 'isPublic', 'userId']
    });
    if (!script) {
      return res.status(404).json({
        message: 'Script not found',
        success: false
      });
    }
    if (!isAdmin && !script.isPublic && script.userId !== viewerId) {
      return res.status(403).json({
        message: 'Forbidden: insufficient permissions to view similar scripts',
        success: false
      });
    }

    // Use the vector search utility to find similar scripts
    try {
      const similarScripts = await findSimilarScriptsByVector(scriptId, limit, threshold);
      const visibleScripts = similarScripts.filter((s: { isPublic?: boolean; userId?: number | null }) => (
        isAdmin || !!s.isPublic || (typeof viewerId === 'number' && s.userId === viewerId)
      ));

      // Format the response
      const response = {
        similar_scripts: visibleScripts.map((s: { id: number; title: string; categoryId: number | null; similarity: number }) => ({
          script_id: s.id,
          title: s.title,
          category: s.categoryId,
          similarity: parseFloat(s.similarity.toFixed(4))
        })),
        success: true
      };

      return res.json(response);
    } catch (searchError) {
      logger.error(`Error finding similar scripts for ${scriptId}:`, searchError);

      // Fall back to basic similarity if vector search fails
      const whereConditions: Record<string, unknown>[] = [
        { id: { [Op.ne]: scriptId } }
      ];
      if (!isAdmin) {
        whereConditions.push(viewerId
          ? { [Op.or]: [{ isPublic: true }, { userId: viewerId }] }
          : { isPublic: true });
      }

      const whereClause = whereConditions.length === 1
        ? whereConditions[0]
        : { [Op.and]: whereConditions };

      const similarScripts = await Script.findAll({
        where: whereClause,
        limit: 5,
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name', 'description', 'created_at'] }
        ],
        order: [[sequelize.col('Script.updated_at'), 'DESC']]
      });

      // Calculate a mock similarity score
      const response = {
        similar_scripts: similarScripts.map((s) => ({
          script_id: s.id,
          title: s.title,
          category: s.category?.name ?? null,
          similarity: parseFloat((Math.random() * 0.3 + 0.6).toFixed(4)) // Random score between 0.6 and 0.9
        })),
        success: true,
        fallback: true,
        message: 'Vector search failed, using fallback similarity'
      };

      return res.json(response);
    }
  } catch (error) {
    next(error);
  }
}

// Export as a controller object for compatibility
export const ScriptSearchController = {
  searchScripts,
  findSimilarScripts
};
