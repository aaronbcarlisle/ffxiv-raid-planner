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
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('NetworkError')) {
      return {
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      };
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.name === 'AbortError') {
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
