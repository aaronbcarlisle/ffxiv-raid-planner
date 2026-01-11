/**
 * Members Panel
 *
 * Shows group members with their roles and linked players.
 * Owners can manage roles and remove members.
 */

import { useEffect, useState, useCallback } from 'react';
import { authRequest } from '../../services/api';
import { JobIcon } from '../ui/JobIcon';
import { Select, type SelectOption } from '../ui/Select';
import type { Membership, MemberRole, LinkedPlayerInfo } from '../../types';

interface MembersPanelProps {
  groupId: string;
  currentUserRole?: MemberRole;
  isAdmin?: boolean;
}

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

export function MembersPanel({ groupId, currentUserRole, isAdmin }: MembersPanelProps) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = currentUserRole === 'owner';
  const canManage = currentUserRole === 'owner' || currentUserRole === 'lead' || isAdmin;

  const fetchData = useCallback(async () => {
    try {
      const [membersData, linkedData] = await Promise.all([
        authRequest<Membership[]>(`/api/static-groups/${groupId}/members`),
        authRequest<LinkedPlayerInfo[]>(`/api/static-groups/${groupId}/linked-players`),
      ]);
      setMembers(membersData);

      // Filter out linked players who are already members
      const memberUserIds = new Set(membersData.map(m => m.user?.id).filter(Boolean));
      const nonMemberLinked = linkedData.filter(lp => !memberUserIds.has(lp.user.id));
      setLinkedPlayers(nonMemberLinked);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    setIsSaving(true);
    try {
      await authRequest(`/api/static-groups/${groupId}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      await fetchData();
      setEditingMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    setIsSaving(true);
    try {
      await authRequest(`/api/static-groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-status-error/10 border border-status-error/30 rounded text-status-error text-sm">
          {error}
        </div>
      )}

      {/* Members Section */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          Members ({members.length})
        </h3>
        <div className="space-y-2">
          {members.map((membership) => {
            const member = membership.user;
            if (!member) return null;

            const isEditing = editingMember === member.id;
            // Admins and owners can edit all non-owner members; leads can only edit non-owner, non-lead members
            const canEditThis = canManage && membership.role !== 'owner' && (isAdmin || isOwner || membership.role !== 'lead');

            // Role options for the dropdown
            const roleOptions: SelectOption[] = [
              ...(isOwner || isAdmin ? [{ value: 'lead', label: 'Lead' }] : []),
              { value: 'member', label: 'Member' },
              { value: 'viewer', label: 'Viewer' },
            ];

            return (
              <div
                key={membership.id}
                className="flex items-center justify-between p-3 bg-surface-raised rounded-lg border border-border-subtle"
              >
                <div className="flex items-center gap-3">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <span className="text-accent text-sm font-medium">
                        {(member.displayName || member.discordUsername || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="text-text-primary font-medium">
                      {member.displayName || member.discordUsername}
                    </div>
                    {member.displayName && member.discordUsername !== member.displayName && (
                      <div className="text-xs text-text-muted">@{member.discordUsername}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <Select
                      value={membership.role}
                      onChange={(value) => handleRoleChange(member.id, value as MemberRole)}
                      options={roleOptions}
                      disabled={isSaving}
                      className="w-32"
                    />
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[membership.role]}`}>
                      {ROLE_LABELS[membership.role]}
                    </span>
                  )}

                  {canEditThis && !isEditing && (
                    <button
                      onClick={() => setEditingMember(member.id)}
                      className="p-1 text-text-muted hover:text-text-primary transition-colors"
                      title="Edit role"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}

                  {isEditing && (
                    <button
                      onClick={() => setEditingMember(null)}
                      className="p-1 text-text-muted hover:text-text-primary transition-colors"
                      title="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {canEditThis && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isSaving}
                      className="p-1 text-text-muted hover:text-status-error transition-colors"
                      title="Remove member"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="text-center py-4 text-text-muted text-sm">
              No members yet
            </div>
          )}
        </div>
      </div>

      {/* Linked Players Section */}
      {linkedPlayers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Linked Players ({linkedPlayers.length})
          </h3>
          <p className="text-xs text-text-muted mb-3">
            Users who claimed a player card but aren't group members
          </p>
          <div className="space-y-2">
            {linkedPlayers.map((linked) => (
              <div
                key={linked.playerId}
                className="flex items-center justify-between p-3 bg-surface-raised rounded-lg border border-membership-linked/20"
              >
                <div className="flex items-center gap-3">
                  {linked.user.avatarUrl ? (
                    <img
                      src={linked.user.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-membership-linked/20 flex items-center justify-center">
                      <span className="text-membership-linked text-sm font-medium">
                        {(linked.user.displayName || linked.user.discordUsername || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="text-text-primary font-medium">
                      {linked.user.displayName || linked.user.discordUsername}
                    </div>
                    <div className="text-xs text-text-muted flex items-center gap-1">
                      <span>Playing as</span>
                      <JobIcon job={linked.playerJob} size="sm" />
                      <span>{linked.playerName}</span>
                    </div>
                  </div>
                </div>

                <span className="text-xs px-2 py-0.5 rounded border bg-membership-linked/20 text-membership-linked border-membership-linked/30">
                  Linked
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
