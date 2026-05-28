/**
 * Plugin Auth Consent Page (`/plugin-auth`)
 *
 * Loopback OAuth/PKCE entry point for the Dalamud plugin's "Sign in with browser"
 * button. Reads redirect_uri + state + code_challenge from the URL, requires the
 * user to be logged in, presents an authorize/cancel consent, and on approve
 * redirects back to the loopback URI with `?code=...&state=...`.
 *
 * The plugin's local listener then exchanges code + code_verifier at
 * /api/auth/api-keys/plugin-auth/exchange to mint the actual API key.
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authRequest } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/primitives/Button';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('plugin-auth');

interface AuthorizeResponse {
  code: string;
}

type Status = 'idle' | 'authorizing' | 'redirecting' | 'cancelled' | 'error';

function isLoopbackRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'http:') return false;
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

export default function PluginAuth() {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, login } = useAuthStore();

  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';
  const codeChallenge = searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? 'S256';

  const paramsError = useMemo(() => {
    if (!redirectUri || !state || !codeChallenge) {
      return 'Missing required parameters. The sign-in link from the plugin is incomplete.';
    }
    if (!isLoopbackRedirectUri(redirectUri)) {
      return 'Invalid redirect target. The plugin must use a local loopback URL.';
    }
    if (codeChallengeMethod !== 'S256') {
      return 'Unsupported code challenge method. The plugin must use S256.';
    }
    return null;
  }, [redirectUri, state, codeChallenge, codeChallengeMethod]);

  const [status, setStatus] = useState<Status>('idle');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleAuthorize = async () => {
    setStatus('authorizing');
    setErrorDetail(null);
    try {
      const response = await authRequest<AuthorizeResponse>(
        '/api/auth/api-keys/plugin-auth/authorize',
        {
          method: 'POST',
          body: JSON.stringify({
            redirectUri,
            state,
            codeChallenge,
            codeChallengeMethod,
          }),
        }
      );

      const url = new URL(redirectUri);
      url.searchParams.set('code', response.code);
      url.searchParams.set('state', state);
      const target = url.toString();

      setStatus('redirecting');
      logger.info('Authorize succeeded, redirecting to loopback URI');
      window.location.href = target;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authorization failed';
      logger.error('Authorize call failed', message);
      setErrorDetail(message);
      setStatus('error');
    }
  };

  const handleCancel = () => {
    setStatus('cancelled');
  };

  const handleSignIn = () => {
    sessionStorage.setItem('auth_redirect', `/plugin-auth?${searchParams.toString()}`);
    login();
  };

  if (paramsError) {
    return (
      <ConsentLayout title="Plugin sign-in" variant="error">
        <p className="text-muted-foreground">{paramsError}</p>
        <p className="text-sm text-muted-foreground mt-4">
          Open the plugin's configuration window and try the "Sign in with browser" button again.
        </p>
      </ConsentLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <ConsentLayout title="Sign in to authorize the plugin">
        <p className="text-muted-foreground">
          To link the XIV Raid Planner Dalamud plugin to your account, sign in first with Discord.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={handleSignIn}>Sign in with Discord</Button>
        </div>
      </ConsentLayout>
    );
  }

  if (status === 'cancelled') {
    return (
      <ConsentLayout title="Sign-in cancelled">
        <p className="text-muted-foreground">
          The plugin was not authorized. You can close this tab and return to the game.
        </p>
      </ConsentLayout>
    );
  }

  if (status === 'redirecting') {
    return (
      <ConsentLayout title="Signed in!">
        <p className="text-muted-foreground">
          Returning to the plugin. If your browser doesn't redirect automatically, close this tab.
        </p>
      </ConsentLayout>
    );
  }

  return (
    <ConsentLayout title="Authorize XIV Raid Planner plugin">
      <p className="text-muted-foreground">
        The Dalamud plugin is requesting access to your FFXIV Raid Planner account.
      </p>
      <div className="mt-4 rounded-md border border-border bg-surface-2 p-3 text-sm">
        Signing in as <span className="font-medium text-foreground">{user?.displayName ?? user?.discordUsername ?? 'you'}</span>.
        Approving generates a new API key labeled "Plugin browser sign-in". You can revoke it any
        time from the API key list.
      </div>
      {status === 'error' && errorDetail && (
        <div className="mt-4 rounded-md border border-status-error/40 bg-status-error/10 p-3 text-sm text-status-error">
          {errorDetail}
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <Button
          variant="primary"
          onClick={handleAuthorize}
          loading={status === 'authorizing'}
          disabled={status === 'authorizing'}
        >
          Authorize
        </Button>
        <Button variant="secondary" onClick={handleCancel} disabled={status === 'authorizing'}>
          Cancel
        </Button>
      </div>
    </ConsentLayout>
  );
}

function ConsentLayout({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  variant?: 'error';
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface-1 p-6 shadow-lg">
        <h1 className={`text-xl font-display ${variant === 'error' ? 'text-status-error' : 'text-foreground'}`}>
          {title}
        </h1>
        <div className="mt-4 space-y-2">{children}</div>
      </div>
    </div>
  );
}

// Compatibility wrapper for routers that expect a default-named export.
export { PluginAuth };
