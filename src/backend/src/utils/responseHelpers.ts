/**
 * Standardized API Response Helpers
 *
 * Provides consistent response shapes across all endpoints:
 *
 *   Success: { success: true, data: T, meta?: { page, totalPages, total } }
 *   Error:   { success: false, error: { code: string, message: string, details?: any } }
 *
 * Best practice (2026): Every API should use a consistent envelope so
 * clients can parse responses with a single generic handler.
 *
 * Usage in controllers:
 *   import { ok, created, paginated, fail } from '../../utils/responseHelpers';
 *   return ok(res, script);
 *   return fail(res, 404, 'NOT_FOUND', 'Script not found');
 */
import { Response } from 'express';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  totalPages: number;
  total: number;
  limit?: number;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  requestId?: string;
}

// ---------------------------------------------------------------------------
// Success helpers
// ---------------------------------------------------------------------------

/** 200 OK with data */
export function ok<T>(res: Response, data: T, requestId?: string): Response {
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (requestId) body.requestId = requestId;
  return res.status(200).json(body);
}

/** 201 Created with data */
export function created<T>(res: Response, data: T, requestId?: string): Response {
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (requestId) body.requestId = requestId;
  return res.status(201).json(body);
}

/** 200 OK with pagination metadata */
export function paginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  requestId?: string
): Response {
  const body: ApiSuccessResponse<T[]> = { success: true, data, meta };
  if (requestId) body.requestId = requestId;
  return res.status(200).json(body);
}

/** 204 No Content (for deletes) */
export function noContent(res: Response): Response {
  return res.status(204).end();
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * Send a structured error response.
 *
 * @param res     Express Response
 * @param status  HTTP status code (400, 401, 403, 404, 409, 500, 503…)
 * @param code    Machine-readable error code (e.g. 'VALIDATION_ERROR')
 * @param message Human-readable message
 * @param details Optional extra info (omitted in production)
 */
export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: any,
  requestId?: string
): Response {
  const payload: ApiErrorPayload = { code, message };
  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }
  const body: ApiErrorResponse = { success: false, error: payload };
  if (requestId) body.requestId = requestId;
  return res.status(status).json(body);
}

// Convenience shortcuts for common error codes
export const errors = {
  badRequest: (res: Response, message: string, details?: any) =>
    fail(res, 400, 'BAD_REQUEST', message, details),
  unauthorized: (res: Response, message = 'Unauthorized') =>
    fail(res, 401, 'UNAUTHORIZED', message),
  forbidden: (res: Response, message = 'Forbidden') =>
    fail(res, 403, 'FORBIDDEN', message),
  notFound: (res: Response, message = 'Resource not found') =>
    fail(res, 404, 'NOT_FOUND', message),
  conflict: (res: Response, message = 'Resource already exists') =>
    fail(res, 409, 'CONFLICT', message),
  internal: (res: Response, message = 'Internal server error') =>
    fail(res, 500, 'INTERNAL_ERROR', message),
  serviceUnavailable: (res: Response, message = 'Service unavailable') =>
    fail(res, 503, 'SERVICE_UNAVAILABLE', message),
};
