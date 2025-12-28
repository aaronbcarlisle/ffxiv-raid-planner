/**
 * Invitations Panel - Manage invitations for a static group
 */

import { useEffect, useState } from 'react';
import { useInvitationStore } from '../../stores/invitationStore';
import type { Invitation, MemberRole } from '../../types';

interface InvitationsPanelProps {
  groupId: string;
  canManage: boolean;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'text-amber-400',
  lead: 'text-blue-400',
  member: 'text-green-400',
  viewer: 'text-gray-400',
};

export function InvitationsPanel({ groupId, canManage }: InvitationsPanelProps) {
  const {
    invitations,
    isLoading,
    isCreating,
    error,
    fetchInvitations,
    createInvitation,
    revokeInvitation,
    clearError,
  } = useInvitationStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRole, setNewRole] = useState<MemberRole>('member');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (groupId && canManage) {
      fetchInvitations(groupId);
    }
  }, [groupId, canManage, fetchInvitations]);

  const handleCreate = async () => {
    try {
      await createInvitation(groupId, {
        role: newRole,
        expiresInDays: expiresInDays ?? undefined,
        maxUses: maxUses ?? undefined,
      });
      setShowCreateForm(false);
      // Reset form
      setNewRole('member');
      setExpiresInDays(7);
      setMaxUses(null);
    } catch {
      // Error handled by store
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (confirm('Are you sure you want to revoke this invitation?')) {
      await revokeInvitation(groupId, invitationId);
    }
  };

  const copyInviteLink = async (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isExpired = (inv: Invitation) => {
    if (!inv.expiresAt) return false;
    return new Date(inv.expiresAt) < new Date();
  };

  const getStatusBadge = (inv: Invitation) => {
    if (!inv.isActive) {
      return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Revoked</span>;
    }
    if (isExpired(inv)) {
      return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Expired</span>;
    }
    if (inv.maxUses && inv.useCount >= inv.maxUses) {
      return <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded">Exhausted</span>;
    }
    return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Active</span>;
  };

  if (!canManage) {
    return (
      <div className="text-text-muted text-sm">
        Only owners and leads can manage invitations.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/20 text-red-400 p-3 rounded text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="hover:text-red-300">&times;</button>
        </div>
      )}

      {/* Create Invitation */}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded transition-colors"
        >
          + Create Invitation Link
        </button>
      ) : (
        <div className="bg-bg-elevated border border-border-default rounded-lg p-4 space-y-4">
          <h4 className="text-text-primary font-medium">New Invitation</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as MemberRole)}
                className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="member">Member</option>
                <option value="lead">Lead</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Expires In</label>
              <select
                value={expiresInDays ?? 'never'}
                onChange={(e) => setExpiresInDays(e.target.value === 'never' ? null : Number(e.target.value))}
                className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1">Max Uses (optional)</label>
              <input
                type="number"
                value={maxUses ?? ''}
                onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : null)}
                placeholder="Unlimited"
                min="1"
                max="100"
                className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-4 py-2 bg-accent text-bg-primary rounded hover:bg-accent-bright disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Invitations List */}
      {isLoading ? (
        <div className="text-text-muted text-center py-4">Loading invitations...</div>
      ) : invitations.length === 0 ? (
        <div className="text-text-muted text-center py-4">
          No invitations yet. Create one to invite members.
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-text-secondary text-sm font-medium">Active Invitations</h4>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className={`bg-bg-elevated border border-border-default rounded-lg p-3 ${!inv.isValid ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-accent font-mono text-sm">{inv.inviteCode}</code>
                    {getStatusBadge(inv)}
                    <span className={`text-xs ${ROLE_COLORS[inv.role]}`}>
                      {ROLE_LABELS[inv.role]}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">
                    {inv.useCount} uses
                    {inv.maxUses && ` / ${inv.maxUses}`}
                    {' · '}
                    {inv.expiresAt ? `Expires ${formatDate(inv.expiresAt)}` : 'Never expires'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {inv.isValid && (
                    <button
                      onClick={() => copyInviteLink(inv.inviteCode)}
                      className="px-3 py-1.5 text-sm bg-bg-hover hover:bg-bg-primary border border-border-default rounded transition-colors"
                      title="Copy invite link"
                    >
                      {copiedCode === inv.inviteCode ? '✓ Copied' : 'Copy Link'}
                    </button>
                  )}
                  {inv.isActive && (
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                      title="Revoke invitation"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
