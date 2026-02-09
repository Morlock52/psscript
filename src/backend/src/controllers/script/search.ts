/**
 * Script Search Controller
 *
 * Handles search and similarity operations for scripts.
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
  Op,
  sequelize,
  logger,
  findSimilarScriptsByVector,
  CACHE_TTL,
  getCache
} from './shared';

/**
 * Search scripts by keyword and filters
 */
export async function searchScripts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const cache = getCache();
    const query = req.query.q as string;
    const categoryId = req.query.categoryId as string | undefined;
    const qualityThreshold = req.query.qualityThreshold
      ? parseFloat(req.query.qualityThreshold as string)
      : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const cacheKey = `search:${query || ''}:${categoryId || ''}:${qualityThreshold || ''}:${page}:${limit}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Build where clause with proper typing
    type WhereClause = {
      categoryId?: string;
      [Op.or]?: Array<{
        title?: { [Op.iLike]: string };
        description?: { [Op.iLike]: string };
        content?: { [Op.iLike]: string };
      }>;
    };
    const whereClause: WhereClause = {};

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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 5;
    const threshold = parseFloat(req.query.threshold as string) || 0.7;

    // Check if we have a valid script ID
    if (isNaN(scriptId)) {
      return res.status(400).json({
        message: 'Invalid script ID',
        success: false
      });
    }

    // Get the script to verify it exists
    const script = await Script.findByPk(scriptId);
    if (!script) {
      return res.status(404).json({
        message: 'Script not found',
        success: false
      });
    }

    // Use the vector search utility to find similar scripts
    try {
      const similarScripts = await findSimilarScriptsByVector(scriptId, limit, threshold);

      // Format the response
      const response = {
        similar_scripts: similarScripts.map((s: { id: number; title: string; categoryId: number | null; similarity: number }) => ({
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
      const similarScripts = await Script.findAll({
        where: {
          id: { [Op.ne]: scriptId }
        },
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
