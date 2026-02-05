/**
 * Shared utilities and imports for script controllers
 * Provides centralized imports and helper functions for all script controller modules
 */
import { Request, Response, NextFunction } from 'express';
import { Script, ScriptAnalysis, Category, User, Tag, ScriptTag, ScriptVersion, ExecutionLog, sequelize } from '../../models';
import { Op, Transaction } from 'sequelize';
import * as path from 'path';
import fs from 'fs';
import axios from 'axios';
import logger from '../../utils/logger';
import { cache } from '../../index';
import { calculateBufferMD5, checkFileExists } from '../../utils/fileIntegrity';
import { findSimilarScripts as findSimilarScriptsByVector } from '../../utils/vectorUtils';
import crypto from 'crypto';

// Import types
import type {
  CacheService,
  AuthenticatedRequest,
  AnalysisResult,
  RawAnalysisRow
} from './types';

// Re-export types
export * from './types';

// Environment configuration
export const isDocker: boolean = process.env.DOCKER_ENV === 'true';
export const AI_SERVICE_URL: string = isDocker
  ? (process.env.AI_SERVICE_URL || 'http://ai-service:8000')
  : (process.env.AI_SERVICE_URL || 'http://localhost:8000');

/**
 * Timeout constants for API requests (in milliseconds)
 * Centralized to enable consistent configuration across all controllers
 */
export const TIMEOUTS = {
  /** Quick operations like status checks */
  QUICK: 15_000,           // 15 seconds
  /** Standard analysis requests */
  STANDARD: 20_000,        // 20 seconds
  /** Full analysis with more processing */
  FULL_ANALYSIS: 30_000,   // 30 seconds
  /** Extended operations like batch processing */
  EXTENDED: 120_000,       // 2 minutes
  /** Long-running agentic AI workflows */
  AGENTIC_WORKFLOW: 300_000 // 5 minutes
} as const;

/**
 * Cache TTL constants (in seconds)
 * Used for Redis/in-memory caching of results
 */
export const CACHE_TTL = {
  /** Short-lived cache for frequently changing data */
  SHORT: 300,      // 5 minutes
  /** Standard cache for analysis results */
  STANDARD: 3600,  // 1 hour
  /** Long cache for rarely changing data */
  LONG: 86400      // 24 hours
} as const;

// Re-export for use in controllers
export {
  Request, Response, NextFunction,
  Script, ScriptAnalysis, Category, User, Tag, ScriptTag, ScriptVersion, ExecutionLog, sequelize,
  Op, Transaction,
  path, fs, axios, logger, cache,
  calculateBufferMD5, checkFileExists, findSimilarScriptsByVector, crypto
};

// Type the cache properly for internal use (guard against import cycles)
const typedCache: CacheService = (cache as CacheService) ?? {
  get: () => null,
  set: () => undefined,
  del: () => undefined,
  clearPattern: () => undefined
};

/**
 * Send a successful response with data
 */
export const sendSuccess = <T>(res: Response, data: T, status = 200): Response => {
  return res.status(status).json(data);
};

/**
 * Standard error response format
 * Used across all script controllers for consistent API responses
 */
export interface ApiErrorResponse {
  message: string;
  success: false;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Common HTTP error status codes used in controllers
 */
export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Send an error response with standardized format
 * All error responses use { message, success: false } for consistency
 * In production, additional details are not sent to clients for security
 *
 * @param res - Express response object
 * @param message - User-facing error message
 * @param status - HTTP status code (default: 500)
 * @param errorCode - Optional machine-readable error code (e.g., 'VALIDATION_ERROR')
 * @param details - Optional details (omitted in production)
 */
export const sendError = (
  res: Response,
  message: string,
  status: number = HTTP_STATUS.INTERNAL_ERROR,
  errorCode?: string,
  details?: Record<string, unknown>
): Response => {
  logger.error(`Error [${status}]: ${message}`, { errorCode, details });

  const responseBody: ApiErrorResponse = {
    message,
    success: false
  };

  // Add error code if provided
  if (errorCode) {
    responseBody.error = errorCode;
  }

  // Include details only in development
  if (process.env.NODE_ENV !== 'production' && details) {
    responseBody.details = details;
  }

  return res.status(status).json(responseBody);
};

/**
 * Sort field mapping for database queries
 * Maps camelCase field names to snake_case database column names
 */
export const sortFieldMap: Record<string, string> = {
  'updatedAt': 'updated_at',
  'createdAt': 'created_at',
  'userId': 'user_id',
  'categoryId': 'category_id',
  'executionCount': 'execution_count',
  'views': 'views',
  'isPublic': 'is_public',
  'fileHash': 'file_hash'
};

/**
 * Get the database column name for a sort field
 */
export const getDbSortField = (sortField: string): string => {
  // Handle 'updated' for backward compatibility
  if (sortField === 'updated') {
    sortField = 'updatedAt';
  }
  return sortFieldMap[sortField] || sortField;
};

/**
 * Build a cache key from parameters
 */
export const buildCacheKey = (prefix: string, params: Record<string, unknown>): string => {
  const parts = Object.entries(params)
    .map(([key, value]) => `${key}:${value ?? ''}`)
    .join(':');
  return `${prefix}:${parts}`;
};

/**
 * Try to get data from cache, otherwise fetch and cache it
 */
export const getCachedOrFetch = async <T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl = 300
): Promise<T> => {
  const cached = typedCache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const data = await fetchFn();
  typedCache.set(cacheKey, data, ttl);
  return data;
};

/**
 * Clear script-related caches
 */
export const clearScriptCaches = (scriptId?: string | number): void => {
  if (scriptId) {
    typedCache.del(`script:${scriptId}`);
  }
  typedCache.clearPattern('scripts:');
  typedCache.clearPattern('search:');
};

/**
 * Transform raw analysis row from database to API format
 */
export const transformAnalysisRow = (row: RawAnalysisRow): AnalysisResult => {
  return {
    id: row.id,
    scriptId: row.script_id,
    purpose: row.purpose,
    parameters: row.parameter_docs,
    securityScore: row.security_score,
    codeQualityScore: row.quality_score,
    riskScore: row.risk_score,
    optimizationSuggestions: row.suggestions || [],
    commandDetails: row.command_details || {},
    msDocsReferences: row.ms_docs_references || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

/**
 * Fetch analysis for a script by ID using raw query
 * Returns null if not found
 */
export const fetchScriptAnalysis = async (scriptId: string | number): Promise<AnalysisResult | null> => {
  try {
    const result = await sequelize.query(
      `SELECT * FROM script_analysis WHERE script_id = :scriptId LIMIT 1`,
      {
        replacements: { scriptId },
        type: 'SELECT' as const,
        raw: true,
        plain: true
      }
    );

    // Sequelize raw query returns unknown type, cast through unknown for safety
    const row = result as unknown as RawAnalysisRow | null;

    if (!row) {
      return null;
    }

    return transformAnalysisRow(row);
  } catch (error) {
    logger.error(`Error fetching analysis for script ${scriptId}:`, error);
    return null;
  }
};

/**
 * Batch fetch analyses for multiple scripts in a single query
 * Returns a Map of scriptId -> AnalysisResult for O(1) lookups
 *
 * @param scriptIds - Array of script IDs to fetch analyses for
 * @returns Map with script ID as key and AnalysisResult as value.
 *          Returns empty Map if scriptIds is empty or on error.
 */
export const fetchScriptAnalysesBatch = async (
  scriptIds: (string | number)[]
): Promise<Map<number, AnalysisResult>> => {
  const resultMap = new Map<number, AnalysisResult>();

  // Filter out invalid IDs (null, undefined, NaN)
  const validIds = scriptIds.filter(id => id != null && !isNaN(Number(id)));

  if (validIds.length === 0) {
    return resultMap;
  }

  try {
    // Single query to fetch all analyses at once
    const results = await sequelize.query(
      `SELECT * FROM script_analysis WHERE script_id IN (:scriptIds)`,
      {
        replacements: { scriptIds: validIds },
        type: 'SELECT' as const,
        raw: true
      }
    );

    // Cast and transform results
    const rows = results as unknown as RawAnalysisRow[];

    for (const row of rows) {
      const scriptId = Number(row.script_id);
      const analysis = transformAnalysisRow(row);
      resultMap.set(scriptId, analysis);
    }

    return resultMap;
  } catch (error) {
    logger.error(`Error batch fetching analyses for scripts:`, error);
    return resultMap;
  }
};

/**
 * Check if user is authorized to modify a script
 */
export const isAuthorizedForScript = (
  script: { userId: number },
  req: AuthenticatedRequest
): boolean => {
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  return script.userId === userId || isAdmin;
};

/**
 * Standard include options for script queries
 */
export const getScriptIncludes = (includeAnalysis = false) => {
  const includes = [
    { model: User, as: 'user', attributes: ['id', 'username'] },
    { model: Category, as: 'category', attributes: ['id', 'name', 'description', 'created_at'] },
    {
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      through: { attributes: [] }
    }
  ];

  if (includeAnalysis) {
    includes.push({ model: ScriptAnalysis, as: 'analysis' } as any);
  }

  return includes;
};

/**
 * Execute a function within a transaction with automatic rollback on error
 */
export const withTransaction = async <T>(
  fn: (transaction: Transaction) => Promise<T>
): Promise<T> => {
  const transaction = await sequelize.transaction();

  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Parse pagination parameters from request query
 */
export const parsePaginationParams = (query: Record<string, unknown>) => {
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};
