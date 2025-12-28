/**
 * Members Panel
 *
 * Shows group members with their roles.
 * Owners can manage roles and remove members.
 */

import { useEffect, useState, useCallback } from 'react';
import { authRequest } from '../../services/api';
import type { Membership, MemberRole } from '../../types';

interface MembersPanelProps {
  groupId: string;
  currentUserRole?: MemberRole;
}

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

export function MembersPanel({ groupId, currentUserRole }: MembersPanelProps) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = currentUserRole === 'owner';
  const canManage = currentUserRole === 'owner' || currentUserRole === 'lead';

  const fetchMembers = useCallback(async () => {
    try {
      const data = await authRequest<Membership[]>(`/api/static-groups/${groupId}/members`);
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    setIsSaving(true);
    try {
      await authRequest(`/api/static-groups/${groupId}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      await fetchMembers();
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
      await fetchMembers();
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
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="text-sm text-text-muted mb-2">
        {members.length} {members.length === 1 ? 'member' : 'members'}
      </div>

      <div className="space-y-2">
        {members.map((membership) => {
          const member = membership.user;
          if (!member) return null;

          const isEditing = editingMember === member.id;
          const canEditThis = canManage && membership.role !== 'owner' && (isOwner || membership.role !== 'lead');

          return (
            <div
              key={membership.id}
              className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg border border-border-subtle"
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
                  <select
                    value={membership.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                    disabled={isSaving}
                    className="bg-bg-primary border border-border-default rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                  >
                    {isOwner && <option value="lead">Lead</option>}
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
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
                    className="p-1 text-text-muted hover:text-red-400 transition-colors"
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
      </div>

      {members.length === 0 && (
        <div className="text-center py-8 text-text-muted">
          No members yet
        </div>
      )}
    </div>
  );
}
