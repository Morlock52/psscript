/**
 * Type definitions for Script controllers
 * Provides type safety across all controller modules
 */
import { Request, Response } from 'express';
import type { Transaction } from 'sequelize';

// Extend Express Request with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: 'admin' | 'user';
  };
}

// Standard API response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  scripts: T[];
  total: number;
  page: number;
  totalPages: number;
  query?: string;
}

// Script-related types
export interface ScriptCreateInput {
  title: string;
  description?: string;
  content: string;
  categoryId?: number | null;
  tags?: string[];
}

export interface ScriptUpdateInput {
  title?: string;
  description?: string;
  content?: string;
  categoryId?: number | null;
  isPublic?: boolean;
  tags?: string[];
}

export interface ScriptQueryParams {
  page?: string;
  limit?: string;
  categoryId?: string;
  userId?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

export interface SearchQueryParams extends ScriptQueryParams {
  q?: string;
  qualityThreshold?: string;
}

// Analysis types
export interface AnalysisResult {
  id: number;
  scriptId: number;
  purpose: string;
  parameters: Record<string, unknown> | string;
  securityScore: number;
  codeQualityScore: number;
  riskScore: number;
  optimizationSuggestions: string[];
  commandDetails: Record<string, unknown>;
  msDocsReferences: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AIAnalysisResponse {
  purpose?: string;
  parameters?: Record<string, unknown>;
  security_score?: number;
  code_quality_score?: number;
  risk_score?: number;
  optimization?: string[];
  command_details?: unknown[] | Record<string, unknown>;
  ms_docs_references?: string[];
  category_id?: number;
}

// Raw database result types (snake_case from DB)
export interface RawAnalysisRow {
  id: number;
  script_id: number;
  purpose: string;
  parameter_docs: string;
  security_score: number;
  quality_score: number;
  risk_score: number;
  suggestions: string[];
  command_details: Record<string, unknown>;
  ms_docs_references: string[];
  created_at: string;
  updated_at: string;
}

// Cache interface
export interface CacheService {
  get: <T = unknown>(key: string) => T | null;
  set: (key: string, value: unknown, ttl?: number) => void;
  del: (key: string) => void;
  clearPattern: (pattern: string) => void;
}

// Transaction wrapper type
export type TransactionCallback<T> = (transaction: Transaction) => Promise<T>;

// Controller method signature
export type ControllerMethod = (
  req: Request | AuthenticatedRequest,
  res: Response,
  next: (error?: unknown) => void
) => Promise<void | Response>;

// Sort field mapping
export const SORT_FIELD_MAP: Record<string, string> = {
  'updatedAt': 'updated_at',
  'createdAt': 'created_at',
  'userId': 'user_id',
  'categoryId': 'category_id',
  'executionCount': 'execution_count',
  'isPublic': 'is_public',
  'fileHash': 'file_hash'
} as const;

// Default values
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_CACHE_TTL = 300; // 5 minutes
export const ANALYSIS_TIMEOUT = 15000; // 15 seconds
export const MAX_TAGS_PER_SCRIPT = 10;
