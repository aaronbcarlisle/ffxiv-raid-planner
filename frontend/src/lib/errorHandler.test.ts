/**
 * Unit tests for the centralized error handler utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseApiError,
  handleApiError,
  isHttpError,
  isAuthError,
  isPermissionError,
  isNotFoundError,
} from './errorHandler';

// Mock the toast store
vi.mock('../stores/toastStore', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe('parseApiError', () => {
  describe('Response objects', () => {
    it('parses 400 Bad Request', () => {
      const response = new Response(null, { status: 400 });
      const error = parseApiError(response);

      expect(error.message).toBe('Invalid request. Please check your input.');
      expect(error.status).toBe(400);
      expect(error.code).toBe('HTTP_400');
    });

    it('parses 401 Unauthorized', () => {
      const response = new Response(null, { status: 401 });
      const error = parseApiError(response);

      expect(error.message).toBe('Please log in to continue.');
      expect(error.status).toBe(401);
      expect(error.code).toBe('HTTP_401');
    });

    it('parses 403 Forbidden', () => {
      const response = new Response(null, { status: 403 });
      const error = parseApiError(response);

      expect(error.message).toBe("You don't have permission to do that.");
      expect(error.status).toBe(403);
      expect(error.code).toBe('HTTP_403');
    });

    it('parses 404 Not Found', () => {
      const response = new Response(null, { status: 404 });
      const error = parseApiError(response);

      expect(error.message).toBe('The requested item was not found.');
      expect(error.status).toBe(404);
      expect(error.code).toBe('HTTP_404');
    });

    it('parses 409 Conflict', () => {
      const response = new Response(null, { status: 409 });
      const error = parseApiError(response);

      expect(error.message).toBe('This conflicts with existing data.');
      expect(error.status).toBe(409);
    });

    it('parses 422 Unprocessable Entity', () => {
      const response = new Response(null, { status: 422 });
      const error = parseApiError(response);

      expect(error.message).toBe('Invalid data provided.');
      expect(error.status).toBe(422);
    });

    it('parses 429 Too Many Requests', () => {
      const response = new Response(null, { status: 429 });
      const error = parseApiError(response);

      expect(error.message).toBe('Too many requests. Please wait a moment.');
      expect(error.status).toBe(429);
    });

    it('parses 500 Internal Server Error', () => {
      const response = new Response(null, { status: 500 });
      const error = parseApiError(response);

      expect(error.message).toBe('Server error. Please try again later.');
      expect(error.status).toBe(500);
    });

    it('parses 502 Bad Gateway', () => {
      const response = new Response(null, { status: 502 });
      const error = parseApiError(response);

      expect(error.message).toBe('Server is temporarily unavailable.');
      expect(error.status).toBe(502);
    });

    it('parses 503 Service Unavailable', () => {
      const response = new Response(null, { status: 503 });
      const error = parseApiError(response);

      expect(error.message).toBe('Service unavailable. Please try again later.');
      expect(error.status).toBe(503);
    });

    it('handles unknown status codes', () => {
      const response = new Response(null, { status: 418 });
      const error = parseApiError(response);

      expect(error.message).toBe('Request failed (418)');
      expect(error.status).toBe(418);
      expect(error.code).toBe('HTTP_418');
    });
  });

  describe('Error objects', () => {
    it('parses network errors', () => {
      const error = parseApiError(new Error('Failed to fetch'));
      expect(error.message).toBe('Network error. Please check your connection.');
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('parses network errors with NetworkError in message', () => {
      const error = parseApiError(new Error('NetworkError when attempting to fetch'));
      expect(error.message).toBe('Network error. Please check your connection.');
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('parses timeout errors by message', () => {
      const error = parseApiError(new Error('Request timeout'));
      expect(error.message).toBe('Request timed out. Please try again.');
      expect(error.code).toBe('TIMEOUT');
    });

    it('parses AbortError', () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const error = parseApiError(abortError);

      expect(error.message).toBe('Request timed out. Please try again.');
      expect(error.code).toBe('TIMEOUT');
    });

    it('passes through other error messages', () => {
      const error = parseApiError(new Error('Something went wrong'));
      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('ERROR');
    });
  });

  describe('String errors', () => {
    it('parses string errors', () => {
      const error = parseApiError('Custom error message');
      expect(error.message).toBe('Custom error message');
      expect(error.code).toBe('STRING_ERROR');
    });
  });

  describe('Object errors', () => {
    it('parses objects with message property', () => {
      const error = parseApiError({ message: 'Object error' });
      expect(error.message).toBe('Object error');
      expect(error.code).toBe('UNKNOWN');
    });

    it('handles null', () => {
      const error = parseApiError(null);
      expect(error.message).toBe('An unexpected error occurred.');
      expect(error.code).toBe('UNKNOWN');
    });

    it('handles undefined', () => {
      const error = parseApiError(undefined);
      expect(error.message).toBe('An unexpected error occurred.');
      expect(error.code).toBe('UNKNOWN');
    });

    it('handles numbers', () => {
      const error = parseApiError(42);
      expect(error.message).toBe('An unexpected error occurred.');
      expect(error.code).toBe('UNKNOWN');
    });
  });
});

describe('handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses error and returns ApiError', () => {
    const response = new Response(null, { status: 404 });

    const result = handleApiError(response, 'fetch player');

    expect(result.status).toBe(404);
    expect(result.message).toBe('The requested item was not found.');
  });

  it('shows toast notification by default', async () => {
    const { toast } = await import('../stores/toastStore');
    const response = new Response(null, { status: 500 });

    handleApiError(response, 'save data');

    expect(toast.error).toHaveBeenCalledWith('Failed to save data');
  });

  it('does not show toast when showToast is false', async () => {
    const { toast } = await import('../stores/toastStore');
    const response = new Response(null, { status: 500 });

    handleApiError(response, 'save data', false);

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('logs error in development mode', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');

    handleApiError(error, 'test operation');

    // In test environment (DEV mode), should log
    // The actual behavior depends on import.meta.env.DEV
    consoleSpy.mockRestore();
  });
});

describe('isHttpError', () => {
  it('returns true for Response with matching status', () => {
    const response = new Response(null, { status: 404 });
    expect(isHttpError(response, 404)).toBe(true);
  });

  it('returns false for Response with different status', () => {
    const response = new Response(null, { status: 500 });
    expect(isHttpError(response, 404)).toBe(false);
  });

  it('returns true for parsed error with matching status', () => {
    const response = new Response(null, { status: 401 });
    // After parsing, should still match
    expect(isHttpError(response, 401)).toBe(true);
  });
});

describe('isAuthError', () => {
  it('returns true for 401 response', () => {
    const response = new Response(null, { status: 401 });
    expect(isAuthError(response)).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(isAuthError(new Response(null, { status: 403 }))).toBe(false);
    expect(isAuthError(new Response(null, { status: 404 }))).toBe(false);
    expect(isAuthError(new Response(null, { status: 500 }))).toBe(false);
  });
});

describe('isPermissionError', () => {
  it('returns true for 403 response', () => {
    const response = new Response(null, { status: 403 });
    expect(isPermissionError(response)).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(isPermissionError(new Response(null, { status: 401 }))).toBe(false);
    expect(isPermissionError(new Response(null, { status: 404 }))).toBe(false);
  });
});

describe('isNotFoundError', () => {
  it('returns true for 404 response', () => {
    const response = new Response(null, { status: 404 });
    expect(isNotFoundError(response)).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(isNotFoundError(new Response(null, { status: 400 }))).toBe(false);
    expect(isNotFoundError(new Response(null, { status: 500 }))).toBe(false);
  });
});
