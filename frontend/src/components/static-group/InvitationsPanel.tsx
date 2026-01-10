/**
 * Invitations Panel - Manage invitations for a static group
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useInvitationStore } from '../../stores/invitationStore';
import { Select, Label, NumberInput } from '../ui';
import { Button, IconButton } from '../primitives';
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
  owner: 'text-membership-owner',
  lead: 'text-membership-lead',
  member: 'text-membership-member',
  viewer: 'text-membership-viewer',
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
      return <span className="px-2 py-0.5 bg-status-error/20 text-status-error text-xs rounded">Revoked</span>;
    }
    if (isExpired(inv)) {
      return <span className="px-2 py-0.5 bg-status-warning/20 text-status-warning text-xs rounded">Expired</span>;
    }
    if (inv.maxUses && inv.useCount >= inv.maxUses) {
      return <span className="px-2 py-0.5 bg-text-muted/20 text-text-muted text-xs rounded">Exhausted</span>;
    }
    return <span className="px-2 py-0.5 bg-status-success/20 text-status-success text-xs rounded">Active</span>;
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
        <div className="bg-status-error/20 text-status-error p-3 rounded text-sm flex justify-between items-center">
          <span>{error}</span>
          <IconButton
            icon={<X className="w-4 h-4" />}
            onClick={clearError}
            variant="ghost"
            size="sm"
            aria-label="Dismiss error"
            className="text-status-error hover:text-status-error/80"
          />
        </div>
      )}

      {/* Create Invitation */}
      {!showCreateForm ? (
        <Button
          variant="secondary"
          onClick={() => setShowCreateForm(true)}
          className="w-full"
        >
          + Create Invitation Link
        </Button>
      ) : (
        <div className="bg-surface-elevated border border-border-default rounded-lg p-4 space-y-4">
          <h4 className="text-text-primary font-medium">New Invitation</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={newRole}
                onChange={(val) => setNewRole(val as MemberRole)}
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'lead', label: 'Lead' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="invite-expires">Expires In</Label>
              <Select
                id="invite-expires"
                value={expiresInDays?.toString() ?? 'never'}
                onChange={(val) => setExpiresInDays(val === 'never' ? null : Number(val))}
                options={[
                  { value: '1', label: '1 day' },
                  { value: '7', label: '7 days' },
                  { value: '14', label: '14 days' },
                  { value: '30', label: '30 days' },
                  { value: 'never', label: 'Never' },
                ]}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="invite-max-uses">Max Uses (optional)</Label>
              <NumberInput
                id="invite-max-uses"
                value={maxUses}
                onChange={setMaxUses}
                min={1}
                max={100}
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={isCreating}
            >
              Create
            </Button>
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
              className={`bg-surface-elevated border border-border-default rounded-lg p-3 ${!inv.isValid ? 'opacity-60' : ''}`}
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyInviteLink(inv.inviteCode)}
                      title="Copy invite link"
                    >
                      {copiedCode === inv.inviteCode ? '✓ Copied' : 'Copy Link'}
                    </Button>
                  )}
                  {inv.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(inv.id)}
                      title="Revoke invitation"
                      className="text-status-error hover:text-status-error/80"
                    >
                      Revoke
                    </Button>
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
