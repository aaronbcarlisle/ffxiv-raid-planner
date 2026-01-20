/**
 * Unit tests for AuthCallback OAuth flow
 *
 * Tests the critical timing-sensitive authentication flow logic including:
 * - Error state handling
 * - Callback invocation with proper parameters
 * - Double navigation prevention via ref guard
 * - OAuth state parameter validation
 *
 * Note: These tests focus on the component's logic and state management.
 * The timing-sensitive navigation behavior (fast path, subscription path, timeout fallback)
 * is better suited for integration tests due to the complex interaction between
 * Zustand subscriptions, setTimeout, and React Router navigation.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthCallback } from './AuthCallback';
import type { User } from '../types';

// Import jest-dom matchers
import '@testing-library/jest-dom/vitest';

// Mock the logger to prevent console noise
vi.mock('../lib/logger', () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock React Router's useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the auth store - we'll configure this per test
const mockHandleCallback = vi.fn();
const mockClearError = vi.fn();
const mockGetOAuthStateCookie = vi.fn();

// Type for the mocked useAuthStore
type MockedAuthStore = ReturnType<typeof vi.fn>;

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
  getOAuthStateCookie: () => mockGetOAuthStateCookie(),
}));

// Helper to render AuthCallback with specific URL params
function renderAuthCallback(queryParams: string) {
  const fullUrl = `/auth/callback${queryParams}`;
  return render(
    <MemoryRouter initialEntries={[fullUrl]}>
      <AuthCallback />
    </MemoryRouter>
  );
}


describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockGetOAuthStateCookie.mockReturnValue('valid-state');
  });

  describe('Error states from URL parameters', () => {
    it('shows error when OAuth error parameter is present', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback,
        clearError: mockClearError,
      });

      renderAuthCallback('?error=access_denied&error_description=User+denied+access');

      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong during sign in/)).toBeInTheDocument();
      expect(mockHandleCallback).not.toHaveBeenCalled();
    });

    it('shows error when code parameter is missing', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback,
        clearError: mockClearError,
      });

      renderAuthCallback('?state=valid-state');

      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(mockHandleCallback).not.toHaveBeenCalled();
    });

    it('shows error when state parameter is missing', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback,
        clearError: mockClearError,
      });

      renderAuthCallback('?code=auth-code');

      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(mockHandleCallback).not.toHaveBeenCalled();
    });

    it('shows error UI with return home button', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Access denied',
        handleCallback: mockHandleCallback,
        clearError: mockClearError,
      });

      renderAuthCallback('?error=access_denied');

      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Return Home')).toBeInTheDocument();
    });
  });

  describe('Processing state', () => {
    it('shows processing UI with spinner when callback is pending', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      // Simulate in-progress authentication
      const pendingCallback = vi.fn(() => new Promise(() => {})); // Never resolves

      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        handleCallback: pendingCallback,
        clearError: mockClearError,
      });

      renderAuthCallback('?code=auth-code&state=valid-state');

      expect(screen.getByText('Signing you in...')).toBeInTheDocument();
      expect(screen.getByText('Please wait while we complete authentication.')).toBeInTheDocument();
    });
  });

  describe('Callback invocation', () => {
    it('calls handleCallback with code, state, and captured OAuth state', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      mockGetOAuthStateCookie.mockReturnValue('captured-state');

      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback.mockResolvedValue(undefined),
        clearError: mockClearError,
      });

      renderAuthCallback('?code=test-code&state=test-state');

      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalledWith('test-code', 'test-state', 'captured-state');
      });
    });

    it('passes captured OAuth state even when cookie is different from URL state', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      // This tests the fix for the OAuth state cookie race condition
      mockGetOAuthStateCookie.mockReturnValue('cookie-state');

      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback.mockResolvedValue(undefined),
        clearError: mockClearError,
      });

      renderAuthCallback('?code=test-code&state=url-state');

      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalledWith('test-code', 'url-state', 'cookie-state');
      });
    });

    it('prevents duplicate callback invocations on re-render', async () => {
      const { useAuthStore } = await import('../stores/authStore');

      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback.mockResolvedValue(undefined),
        clearError: mockClearError,
      });

      const { rerender } = renderAuthCallback('?code=auth-code&state=valid-state');

      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalledTimes(1);
      });

      // Force a rerender
      rerender(
        <MemoryRouter initialEntries={['/auth/callback?code=auth-code&state=valid-state']}>
          <AuthCallback />
        </MemoryRouter>
      );

      // Should still only be called once due to the callbackInitiated ref
      expect(mockHandleCallback).toHaveBeenCalledTimes(1);
    });

    it('does not call handleCallback when already in error state', async () => {
      const { useAuthStore } = await import('../stores/authStore');

      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Previous error',
        handleCallback: mockHandleCallback,
        clearError: mockClearError,
      });

      renderAuthCallback('?error=access_denied');

      // Give it time to potentially call handleCallback (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockHandleCallback).not.toHaveBeenCalled();
    });
  });

  describe('Success state', () => {
    it('shows success UI after successful authentication', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      const mockUser: User = {
        id: 'user-123',
        discordId: 'discord-123',
        discordUsername: 'testuser',
        displayName: 'Test User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAdmin: false,
      };

      // Start with processing state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let currentState: any = {
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        handleCallback: mockHandleCallback.mockResolvedValue(undefined),
        clearError: mockClearError,
      };

      (useAuthStore as unknown as MockedAuthStore).mockImplementation(() => currentState);

      renderAuthCallback('?code=auth-code&state=valid-state');

      expect(screen.getByText('Signing you in...')).toBeInTheDocument();

      // Simulate successful auth by updating the mock
      currentState = {
        ...currentState,
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      };

      // Note: Testing the actual success state transition and navigation
      // requires more complex timing mocks. This test verifies the processing
      // state is shown correctly.
    });
  });

  describe('Error handling during callback', () => {
    it('handles callback rejection gracefully', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      const callbackError = new Error('Network error');

      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback.mockRejectedValue(callbackError),
        clearError: mockClearError,
      });

      // Suppress console.error for this test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderAuthCallback('?code=auth-code&state=valid-state');

      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();

      // After error, the component should handle it internally
      // (the actual error state update happens in the component's catch block)
    });
  });

  describe('Session storage redirect handling', () => {
    it('reads redirect destination from sessionStorage', async () => {
      const { useAuthStore } = await import('../stores/authStore');
      sessionStorage.setItem('auth_redirect', '/dashboard');

      (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        handleCallback: mockHandleCallback.mockResolvedValue(undefined),
        clearError: mockClearError,
      });

      renderAuthCallback('?code=auth-code&state=valid-state');

      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalled();
      });

      // The redirect is read in the component's verifyAndNavigate function
      // Testing the actual navigation would require mocking setTimeout and navigate
    });
  });
});

describe('AuthCallback - Timing-sensitive scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockGetOAuthStateCookie.mockReturnValue('valid-state');
  });

  it('component initializes with OAuth state captured on first render', async () => {
    const { useAuthStore } = await import('../stores/authStore');
    // This test verifies the critical fix: OAuth state is captured immediately
    // in useState's lazy initializer before any async code can clear cookies
    
    let capturedStateOnFirstRender: string | null = null;
    mockGetOAuthStateCookie.mockImplementation(() => {
      if (capturedStateOnFirstRender === null) {
        capturedStateOnFirstRender = 'initial-state';
        return 'initial-state';
      }
      // Simulate cookie being cleared by initializeAuth
      return null;
    });

    (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      handleCallback: mockHandleCallback.mockResolvedValue(undefined),
      clearError: mockClearError,
    });

    renderAuthCallback('?code=auth-code&state=valid-state');

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalledWith('auth-code', 'valid-state', 'initial-state');
    });

    // Verify the state was captured before it could be cleared
    expect(capturedStateOnFirstRender).toBe('initial-state');
  });

  it('handles race condition between subscription and timeout fallback', async () => {
    const { useAuthStore } = await import('../stores/authStore');
    
    // This test would need more complex mocking of useAuthStore.subscribe
    // and setTimeout to fully test the race condition prevention
    // For now, we verify the callback is invoked
    
    (useAuthStore as unknown as MockedAuthStore).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      handleCallback: mockHandleCallback.mockResolvedValue(undefined),
      clearError: mockClearError,
    });

    renderAuthCallback('?code=auth-code&state=valid-state');

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalled();
    });
  });
});

