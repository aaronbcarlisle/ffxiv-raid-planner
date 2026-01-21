/**
 * Auth Callback Page
 *
 * Handles the OAuth redirect from Discord.
 * Extracts code and state from URL, exchanges for tokens, and redirects.
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, getOAuthStateCookie } from '../stores/authStore';
import { Spinner } from '../components/ui/Spinner';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('auth-callback');

// Timing constants for auth state verification
const VISUAL_FEEDBACK_DELAY_MS = 300;
const AUTH_STATE_TIMEOUT_MS = 2000;

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback, error, clearError } = useAuthStore();

  // CRITICAL: Capture OAuth state cookie IMMEDIATELY on first render,
  // before any async code (like initializeAuth) can clear cookies.
  // Using useState with lazy initializer ensures this runs exactly once on initial render.
  const [savedOAuthState] = useState(() => {
    const state = getOAuthStateCookie();
    logger.debug('Captured OAuth state on initial render:', state ? 'found' : 'not found');
    return state;
  });

  // Guard against duplicate callback calls (OAuth codes are single-use).
  // This can happen if the effect runs twice due to dependency changes or re-renders.
  const callbackInitiated = useRef(false);

  // Derive initial status from URL params
  const [status, setStatus] = useState<'processing' | 'error' | 'success'>(() => {
    const errorParam = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (errorParam) {
      logger.error('Discord OAuth error:', errorParam, searchParams.get('error_description'));
      return 'error';
    }
    if (!code || !state) {
      logger.error('Missing code or state in OAuth callback');
      return 'error';
    }
    return 'processing';
  });

  useEffect(() => {
    // Don't process if already in error state
    if (status === 'error') return;

    // Prevent duplicate calls - OAuth codes are single-use and will fail on second attempt
    if (callbackInitiated.current) {
      logger.info('Callback already initiated, skipping duplicate call');
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // These are guaranteed to exist since status would be 'error' otherwise
    if (!code || !state) return;

    // Mark as initiated BEFORE the async call to prevent race conditions
    callbackInitiated.current = true;

    // Exchange code for tokens, passing the pre-captured OAuth state
    // (captured before initializeAuth could clear cookies)
    logger.info('Starting handleCallback with captured state');
    handleCallback(code, state, savedOAuthState)
      .then(() => {
        logger.info('handleCallback resolved successfully');
        setStatus('success');
        // Get redirect destination or default to home
        const redirect = sessionStorage.getItem('auth_redirect') || '/';
        sessionStorage.removeItem('auth_redirect');

        // Verify auth state is fully propagated before navigating.
        // This fixes a race condition where React Router navigation creates
        // a new component tree before Zustand state updates are processed.
        const verifyAndNavigate = () => {
          const authState = useAuthStore.getState();
          logger.info('Checking auth state after handleCallback', {
            hasUser: !!authState.user,
            userName: authState.user?.displayName,
            isAuthenticated: authState.isAuthenticated,
            isLoading: authState.isLoading,
            error: authState.error,
          });

          if (authState.user && authState.isAuthenticated && !authState.isLoading) {
            // State is ready immediately - navigate after brief delay for visual feedback
            logger.info('Auth state ready immediately, navigating', { redirect });
            setTimeout(() => navigate(redirect, { replace: true }), VISUAL_FEEDBACK_DELAY_MS);
          } else {
            // State not ready yet - wait for next update
            // Use a completed flag to prevent race between subscription and timeout
            logger.warn('Auth state not ready after handleCallback completed', {
              hasUser: !!authState.user,
              isAuthenticated: authState.isAuthenticated,
              isLoading: authState.isLoading,
            });
            let completed = false;

            const unsubscribe = useAuthStore.subscribe((newState) => {
              logger.info('Auth state subscription update', {
                hasUser: !!newState.user,
                isAuthenticated: newState.isAuthenticated,
                isLoading: newState.isLoading,
              });
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
                const finalState = useAuthStore.getState();
                logger.warn('Auth state timeout, navigating anyway', {
                  redirect,
                  finalState: {
                    hasUser: !!finalState.user,
                    isAuthenticated: finalState.isAuthenticated,
                    isLoading: finalState.isLoading,
                    error: finalState.error,
                  },
                });
                navigate(redirect, { replace: true });
              }
            }, AUTH_STATE_TIMEOUT_MS);
          }
        };

        verifyAndNavigate();
      })
      .catch((err) => {
        logger.error('OAuth callback failed:', err);
        setStatus('error');
      });
  }, [searchParams, handleCallback, navigate, status]);

  // Processing state
  if (status === 'processing') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-elevated">
        <div className="text-center">
          <Spinner size="2xl" className="mx-auto mb-4" label="Signing in" />
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
