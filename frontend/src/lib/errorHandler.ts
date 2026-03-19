/**
 * Centralized Error Handler
 *
 * Provides consistent error parsing, messaging, and logging across the application.
 */

import { toast } from '../stores/toastStore';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * HTTP status code to user-friendly message mapping
 */
const HTTP_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Please log in to continue.',
  403: "You don't have permission to do that.",
  404: 'The requested item was not found.',
  409: 'This conflicts with existing data.',
  422: 'Invalid data provided.',
  429: 'Too many requests. Please wait a moment.',
  500: 'Server error. Please try again later.',
  502: 'Server is temporarily unavailable.',
  503: 'Service unavailable. Please try again later.',
};

/**
 * Patterns for detecting network-related errors from error messages.
 * These are used to identify when a request failed due to connectivity issues
 * rather than server-side errors.
 */
const NETWORK_ERROR_PATTERNS = ['fetch', 'network', 'NetworkError'] as const;

/**
 * Patterns for detecting timeout-related errors from error messages.
 */
const TIMEOUT_ERROR_PATTERNS = ['timeout'] as const;

/**
 * Parse an error into a standardized ApiError structure
 */
export function parseApiError(error: unknown): ApiError {
  // Handle Response objects (from fetch)
  if (error instanceof Response) {
    return {
      message: HTTP_MESSAGES[error.status] || `Request failed (${error.status})`,
      status: error.status,
      code: `HTTP_${error.status}`,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Network errors
    const isNetworkError = NETWORK_ERROR_PATTERNS.some((pattern) =>
      error.message.includes(pattern)
    );
    if (isNetworkError) {
      return {
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      };
    }

    // Timeout errors
    const isTimeoutError =
      error.name === 'AbortError' ||
      TIMEOUT_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern));
    if (isTimeoutError) {
      return {
        message: 'Request timed out. Please try again.',
        code: 'TIMEOUT',
      };
    }

    return {
      message: error.message,
      code: 'ERROR',
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'STRING_ERROR',
    };
  }

  // Handle objects with message property
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      message: String((error as { message: unknown }).message),
      code: 'UNKNOWN',
    };
  }

  // Fallback
  return {
    message: 'An unexpected error occurred.',
    code: 'UNKNOWN',
  };
}

/**
 * Handle an API error with logging and optional toast notification
 *
 * @param error - The error to handle
 * @param context - Short description of what failed (e.g., "save player", "fetch tiers")
 * @param showToast - Whether to show a toast notification (default: true)
 * @returns The parsed ApiError for further handling
 */
export function handleApiError(
  error: unknown,
  context: string,
  showToast: boolean = true
): ApiError {
  const parsed = parseApiError(error);

  // Log in development
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }

  // Show toast notification
  if (showToast) {
    toast.error(`Failed to ${context}`);
  }

  // Dynamic import to break circular dependency (errorHandler <-> errorReporter)
  import('../services/errorReporter').then(({ errorReporter }) => {
    errorReporter.report('api_error', error, { action: context });
  }).catch(() => {});

  return parsed;
}

/**
 * Type guard to check if an error is an ApiError with a specific status
 */
export function isHttpError(error: unknown, status: number): boolean {
  if (error instanceof Response) {
    return error.status === status;
  }
  const parsed = parseApiError(error);
  return parsed.status === status;
}

/**
 * Check if error indicates user needs to authenticate
 */
export function isAuthError(error: unknown): boolean {
  return isHttpError(error, 401);
}

/**
 * Check if error indicates permission denied
 */
export function isPermissionError(error: unknown): boolean {
  return isHttpError(error, 403);
}

/**
 * Check if error indicates resource not found
 */
export function isNotFoundError(error: unknown): boolean {
  return isHttpError(error, 404);
}

/**
 * Extract error message from unknown error type
 * Useful for catch blocks where error is typed as unknown
 */
export function getErrorMessage(error: unknown): string {
  return parseApiError(error).message;
}
