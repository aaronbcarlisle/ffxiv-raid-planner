/**
 * Auth Callback Page
 *
 * Handles the OAuth redirect from Discord.
 * Extracts code and state from URL, exchanges for tokens, and redirects.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback, error, clearError } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'error' | 'success'>('processing');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle Discord OAuth errors
    if (errorParam) {
      console.error('Discord OAuth error:', errorParam, errorDescription);
      setStatus('error');
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing code or state in OAuth callback');
      setStatus('error');
      return;
    }

    // Exchange code for tokens
    handleCallback(code, state)
      .then(() => {
        setStatus('success');
        // Get redirect destination or default to home
        const redirect = sessionStorage.getItem('auth_redirect') || '/';
        sessionStorage.removeItem('auth_redirect');
        // Small delay to show success state
        setTimeout(() => navigate(redirect, { replace: true }), 500);
      })
      .catch((err) => {
        console.error('OAuth callback failed:', err);
        setStatus('error');
      });
  }, [searchParams, handleCallback, navigate]);

  // Processing state
  if (status === 'processing') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
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
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="flex items-center justify-center min-h-screen bg-bg-primary">
      <div className="text-center max-w-md mx-auto p-8 bg-bg-card rounded-lg border border-white/10">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-display text-red-400 mb-2">Authentication Failed</h2>
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
