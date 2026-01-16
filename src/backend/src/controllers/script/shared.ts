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

// Re-export for use in controllers
export {
  Request, Response, NextFunction,
  Script, ScriptAnalysis, Category, User, Tag, ScriptTag, ScriptVersion, ExecutionLog, sequelize,
  Op, Transaction,
  path, fs, axios, logger, cache,
  calculateBufferMD5, checkFileExists, findSimilarScriptsByVector, crypto
};

// Type the cache properly for internal use
const typedCache = cache as CacheService;

/**
 * Send a successful response with data
 */
export const sendSuccess = <T>(res: Response, data: T, status = 200): Response => {
  return res.status(status).json(data);
};

/**
 * Send an error response with optional details
 * In production, details are not sent to clients for security
 */
export const sendError = (
  res: Response,
  message: string,
  status = 500,
  details?: Record<string, unknown>
): Response => {
  logger.error(`Error: ${message}`, details);

  const responseBody = process.env.NODE_ENV === 'production'
    ? { error: message }
    : { error: message, details };

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
