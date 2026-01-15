/**
 * Centralized Error Handling Utility
 *
 * This module provides a standardized way to extract and handle errors
 * across the frontend application. It handles multiple error formats:
 * - Raw Axios errors (with response.data.message)
 * - Transformed errors from api.ts interceptor ({ status, message, originalError })
 * - Generic JavaScript Error objects
 * - Network errors and timeouts
 */

/**
 * Standardized API error interface used throughout the application
 */
export interface ApiError {
  /** HTTP status code (if available) */
  status?: number;
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling (e.g., 'NETWORK_ERROR', 'TIMEOUT') */
  code?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Whether this is a network-related error */
  isNetworkError?: boolean;
  /** Whether this is a timeout error */
  isTimeout?: boolean;
  /** Whether this is an authentication error */
  isAuthError?: boolean;
}

/**
 * Error codes for common error types
 */
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * Default user-friendly messages for common error codes
 */
const defaultMessages: Record<string, string> = {
  [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ErrorCodes.TIMEOUT]: 'The request timed out. Please try again.',
  [ErrorCodes.AUTH_REQUIRED]: 'Please log in to continue.',
  [ErrorCodes.AUTH_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCodes.SERVER_ERROR]: 'A server error occurred. Please try again later.',
  [ErrorCodes.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

/**
 * Determines the error code based on the error object
 */
function determineErrorCode(error: unknown): string {
  if (!error) return ErrorCodes.UNKNOWN;

  const err = error as Record<string, unknown>;

  // Check for axios error code
  if (err.code === 'ECONNABORTED') return ErrorCodes.TIMEOUT;
  if (err.code === 'ERR_NETWORK') return ErrorCodes.NETWORK_ERROR;

  // Check for status code
  const status = err.status ?? (err.response as Record<string, unknown>)?.status;
  if (typeof status === 'number') {
    if (status === 401) return ErrorCodes.AUTH_EXPIRED;
    if (status === 403) return ErrorCodes.FORBIDDEN;
    if (status === 404) return ErrorCodes.NOT_FOUND;
    if (status === 422 || status === 400) return ErrorCodes.VALIDATION_ERROR;
    if (status === 429) return ErrorCodes.RATE_LIMITED;
    if (status >= 500) return ErrorCodes.SERVER_ERROR;
  }

  // Check message content for network-related errors
  const message = String(err.message || '').toLowerCase();
  if (message.includes('network') || message.includes('connection') || message.includes('socket')) {
    return ErrorCodes.NETWORK_ERROR;
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorCodes.TIMEOUT;
  }

  return ErrorCodes.UNKNOWN;
}

/**
 * Extracts a standardized ApiError from any error type
 *
 * This function handles:
 * 1. Transformed errors from api.ts interceptor: { status, message, originalError }
 * 2. Raw Axios errors: { response: { data: { message }, status } }
 * 3. Generic Error objects: { message }
 * 4. String errors
 * 5. Unknown error types
 *
 * @param error - The error to extract from (any type)
 * @param fallbackMessage - Optional fallback message if no message can be extracted
 * @returns Standardized ApiError object
 */
export function extractApiError(error: unknown, fallbackMessage = 'An unexpected error occurred'): ApiError {
  // Handle null/undefined
  if (!error) {
    return {
      message: fallbackMessage,
      code: ErrorCodes.UNKNOWN,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: ErrorCodes.UNKNOWN,
    };
  }

  const err = error as Record<string, unknown>;
  const errorCode = determineErrorCode(error);

  // Extract message from various possible locations (in order of priority)
  let message: string = fallbackMessage;

  // 1. Transformed error from api.ts interceptor: { message }
  if (typeof err.message === 'string' && err.message) {
    message = err.message;
  }
  // 2. Raw Axios error: { response: { data: { message } } }
  else if (err.response) {
    const response = err.response as Record<string, unknown>;
    const data = response.data as Record<string, unknown> | undefined;
    if (data?.message && typeof data.message === 'string') {
      message = data.message;
    } else if (data?.error && typeof data.error === 'string') {
      message = data.error;
    }
  }
  // 3. Error with nested originalError (from api.ts interceptor)
  else if (err.originalError) {
    const original = err.originalError as Record<string, unknown>;
    const response = original.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;
    if (data?.message && typeof data.message === 'string') {
      message = data.message;
    }
  }

  // Use default message for code if we still have the fallback
  if (message === fallbackMessage && defaultMessages[errorCode]) {
    message = defaultMessages[errorCode];
  }

  // Extract status
  const status = typeof err.status === 'number'
    ? err.status
    : typeof (err.response as Record<string, unknown>)?.status === 'number'
      ? (err.response as Record<string, unknown>).status as number
      : undefined;

  return {
    status,
    message,
    code: errorCode,
    isNetworkError: errorCode === ErrorCodes.NETWORK_ERROR,
    isTimeout: errorCode === ErrorCodes.TIMEOUT,
    isAuthError: errorCode === ErrorCodes.AUTH_REQUIRED || errorCode === ErrorCodes.AUTH_EXPIRED,
    details: err.details as Record<string, unknown> | undefined,
  };
}

/**
 * Gets a user-friendly error message from any error type
 *
 * This is a convenience function that extracts just the message.
 * Use extractApiError() when you need more error details.
 *
 * @param error - The error to extract message from
 * @param fallbackMessage - Optional fallback message
 * @returns User-friendly error message string
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  return extractApiError(error, fallbackMessage).message;
}

/**
 * Checks if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  return extractApiError(error).isNetworkError === true;
}

/**
 * Checks if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  return extractApiError(error).isTimeout === true;
}

/**
 * Checks if an error is an authentication error (401)
 */
export function isAuthError(error: unknown): boolean {
  return extractApiError(error).isAuthError === true;
}

/**
 * Checks if an error indicates the resource was not found (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return extractApiError(error).code === ErrorCodes.NOT_FOUND;
}

/**
 * Checks if an error is a validation error (400/422)
 */
export function isValidationError(error: unknown): boolean {
  return extractApiError(error).code === ErrorCodes.VALIDATION_ERROR;
}

/**
 * Checks if the error is retryable (network errors, timeouts, server errors)
 */
export function isRetryableError(error: unknown): boolean {
  const apiError = extractApiError(error);
  return (
    apiError.isNetworkError === true ||
    apiError.isTimeout === true ||
    apiError.code === ErrorCodes.SERVER_ERROR
  );
}

/**
 * Creates a standardized error object for throwing
 * Useful when you need to create an error with a specific code
 */
export function createApiError(
  message: string,
  code: string = ErrorCodes.UNKNOWN,
  status?: number
): ApiError {
  return {
    message,
    code,
    status,
    isNetworkError: code === ErrorCodes.NETWORK_ERROR,
    isTimeout: code === ErrorCodes.TIMEOUT,
    isAuthError: code === ErrorCodes.AUTH_REQUIRED || code === ErrorCodes.AUTH_EXPIRED,
  };
}
