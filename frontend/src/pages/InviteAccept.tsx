/**
 * Invite Accept Page
 *
 * Allows users to preview and accept an invitation to join a static.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInvitationStore } from '../stores/invitationStore';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/primitives';
import type { MemberRole } from '../types';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: 'Full control over this static',
  lead: 'Can edit roster and manage members',
  member: 'Can edit their own character gear',
  viewer: 'Read-only access to this static',
};

export function InviteAccept() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  const { isAuthenticated, user, login } = useAuthStore();
  const {
    preview,
    isLoading,
    isAccepting,
    error,
    fetchPreview,
    acceptInvitation,
    clearPreview,
    clearError,
  } = useInvitationStore();

  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (inviteCode) {
      fetchPreview(inviteCode);
    }
    return () => {
      clearPreview();
      clearError();
    };
  }, [inviteCode, fetchPreview, clearPreview, clearError]);

  const handleAccept = async () => {
    if (!inviteCode) return;
    setAcceptError(null);

    try {
      const response = await acceptInvitation(inviteCode);
      if (response.success && response.shareCode) {
        navigate(`/group/${response.shareCode}`);
      } else if (!response.success) {
        setAcceptError(response.message);
      }
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to accept invitation');
    }
  };

  const handleLogin = () => {
    // Store the invite URL so we can redirect back after login
    sessionStorage.setItem('auth_redirect', `/invite/${inviteCode}`);
    login();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-elevated flex items-center justify-center">
        <div className="text-text-secondary">Loading invitation...</div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-screen bg-surface-elevated flex items-center justify-center p-4">
        <div className="bg-surface-card border border-border-default rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-xl font-display text-text-primary mb-2">Invitation Not Found</h1>
          <p className="text-text-secondary mb-6">
            {error || 'This invitation may have expired or been revoked.'}
          </p>
          <Link
            to="/"
            className="inline-block bg-accent text-bg-primary px-6 py-2 rounded font-medium hover:bg-accent-bright"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-elevated flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-default rounded-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-display text-accent mb-2">
            You're Invited!
          </h1>
          <p className="text-text-secondary">
            You've been invited to join a static
          </p>
        </div>

        {/* Static Info */}
        <div className="bg-surface-elevated border border-border-default rounded-lg p-4 mb-6">
          <div className="text-lg font-medium text-text-primary mb-2">
            {preview.staticGroupName}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">You'll join as:</span>
            <span className="px-2 py-0.5 bg-accent/20 text-accent rounded">
              {ROLE_LABELS[preview.role]}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            {ROLE_DESCRIPTIONS[preview.role]}
          </p>
        </div>

        {/* Status Messages */}
        {!preview.isValid && (
          <div className="bg-status-warning/10 border border-status-warning/30 rounded p-3 mb-4 text-sm text-status-warning">
            This invitation is no longer valid. It may have expired or reached its usage limit.
          </div>
        )}

        {preview.alreadyMember && (
          <div className="bg-status-info/10 border border-status-info/30 rounded p-3 mb-4 text-sm text-status-info">
            You're already a member of this static.
            <Link
              to={`/group/${preview.shareCode}`}
              className="block mt-2 text-accent hover:text-accent-bright"
            >
              Go to Static →
            </Link>
          </div>
        )}

        {(acceptError || error) && (
          <div className="bg-status-error/10 border border-status-error/30 rounded p-3 mb-4 text-sm text-status-error">
            {acceptError || error}
          </div>
        )}

        {/* Actions */}
        {!isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-text-secondary text-sm text-center">
              Please log in with Discord to accept this invitation.
            </p>
            <Button
              onClick={handleLogin}
              className="w-full bg-discord hover:bg-discord-hover text-white flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Login with Discord
            </Button>
          </div>
        ) : preview.alreadyMember ? (
          <Link
            to={`/group/${preview.shareCode}`}
            className="block w-full bg-accent text-bg-primary px-6 py-3 rounded font-medium hover:bg-accent-bright text-center"
          >
            Go to Static
          </Link>
        ) : preview.isValid ? (
          <div className="space-y-3">
            <Button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full"
            >
              {isAccepting ? 'Joining...' : 'Accept Invitation'}
            </Button>
            <div className="text-center text-xs text-text-muted">
              Logged in as {user?.discordUsername}
            </div>
          </div>
        ) : (
          <div className="text-center text-text-muted">
            This invitation cannot be accepted.
          </div>
        )}

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-text-secondary hover:text-text-primary text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
