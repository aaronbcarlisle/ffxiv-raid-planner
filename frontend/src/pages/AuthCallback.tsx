/**
 * Auth Callback Page
 *
 * Handles the OAuth redirect from Discord.
 * Extracts code and state from URL, exchanges for tokens, and redirects.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('auth-callback');

// Timing constants for auth state verification
const VISUAL_FEEDBACK_DELAY_MS = 300;
const AUTH_STATE_TIMEOUT_MS = 2000;

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback, error, clearError } = useAuthStore();

  // Derive initial status from URL params
  const [status, setStatus] = useState<'processing' | 'error' | 'success'>(() => {
    const errorParam = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (errorParam) {
      console.error('Discord OAuth error:', errorParam, searchParams.get('error_description'));
      return 'error';
    }
    if (!code || !state) {
      console.error('Missing code or state in OAuth callback');
      return 'error';
    }
    return 'processing';
  });

  useEffect(() => {
    // Don't process if already in error state
    if (status === 'error') return;

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // These are guaranteed to exist since status would be 'error' otherwise
    if (!code || !state) return;

    // Exchange code for tokens
    handleCallback(code, state)
      .then(() => {
        setStatus('success');
        // Get redirect destination or default to home
        const redirect = sessionStorage.getItem('auth_redirect') || '/';
        sessionStorage.removeItem('auth_redirect');

        // Verify auth state is fully propagated before navigating.
        // This fixes a race condition where React Router navigation creates
        // a new component tree before Zustand state updates are processed.
        const verifyAndNavigate = () => {
          const authState = useAuthStore.getState();
          if (authState.user && authState.isAuthenticated && !authState.isLoading) {
            // State is ready immediately - navigate after brief delay for visual feedback
            logger.info('Auth state ready immediately, navigating', { redirect });
            setTimeout(() => navigate(redirect, { replace: true }), VISUAL_FEEDBACK_DELAY_MS);
          } else {
            // State not ready yet - wait for next update
            // Use a completed flag to prevent race between subscription and timeout
            logger.info('Auth state not ready, subscribing for updates', {
              hasUser: !!authState.user,
              isAuthenticated: authState.isAuthenticated,
              isLoading: authState.isLoading,
            });
            let completed = false;

            const unsubscribe = useAuthStore.subscribe((newState) => {
              if (!completed && newState.user && newState.isAuthenticated && !newState.isLoading) {
                completed = true;
                unsubscribe();
                logger.info('Auth state ready via subscription, navigating', { redirect });
                setTimeout(() => navigate(redirect, { replace: true }), VISUAL_FEEDBACK_DELAY_MS);
              }
            });

            // Fallback: navigate anyway after timeout to prevent hanging
            setTimeout(() => {
              if (!completed) {
                completed = true;
                unsubscribe();
                logger.warn('Auth state timeout, navigating anyway', { redirect });
                navigate(redirect, { replace: true });
              }
            }, AUTH_STATE_TIMEOUT_MS);
          }
        };

        verifyAndNavigate();
      })
      .catch((err) => {
        console.error('OAuth callback failed:', err);
        setStatus('error');
      });
  }, [searchParams, handleCallback, navigate, status]);

  // Processing state
  if (status === 'processing') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-elevated">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-display text-accent mb-2">Signing you in...</h2>
          <p className="text-text-muted">Please wait while we complete authentication.</p>
        </div>
      </div>
    );
  }

  // Success state (brief flash before redirect)
  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-elevated">
        <div className="text-center">
          <div className="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-display text-accent mb-2">Success!</h2>
          <p className="text-text-muted">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-elevated">
      <div className="text-center max-w-md mx-auto p-8 bg-surface-card rounded-lg border border-border-default">
        <div className="w-12 h-12 bg-status-error/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-display text-status-error mb-2">Authentication Failed</h2>
        <p className="text-text-secondary mb-4">
          {error || 'Something went wrong during sign in. Please try again.'}
        </p>
        <button
          onClick={() => {
            clearError();
            navigate('/');
          }}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-bg-primary font-medium rounded transition-colors"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
