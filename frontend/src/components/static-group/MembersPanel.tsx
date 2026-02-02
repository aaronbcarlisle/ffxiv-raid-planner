/**
 * Members Panel
 *
 * Shows group members with their roles and linked players.
 * Owners can manage roles and remove members.
 */

import { useEffect, useState, useCallback } from 'react';
import { UserMinus, Link2Off } from 'lucide-react';
import { authRequest } from '../../services/api';
import { JobIcon } from '../ui/JobIcon';
import { Spinner } from '../ui/Spinner';
import { ErrorBox } from '../ui/ErrorMessage';
import { Select, type SelectOption } from '../ui/Select';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../primitives/Tooltip';
import { eventBus, Events } from '../../lib/eventBus';
import type { Membership, MemberRole, LinkedPlayerInfo } from '../../types';
import { ROLE_COLORS, ROLE_LABELS } from '../../utils/roleConstants';

interface MembersPanelProps {
  groupId: string;
  currentUserRole?: MemberRole;
  isAdmin?: boolean;
}

export function MembersPanel({ groupId, currentUserRole, isAdmin }: MembersPanelProps) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
    role: MemberRole;
    linkedPlayerNames: string[];
  } | null>(null);
  const [unlinkPlayers, setUnlinkPlayers] = useState(true);
  const [linkedPlayerToUnlink, setLinkedPlayerToUnlink] = useState<LinkedPlayerInfo | null>(null);

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
      // Notify other components (e.g., PlayerCards) that member role changed
      eventBus.emit(Events.MEMBER_ROLE_CHANGED, { groupId, userId, role: newRole });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string, role: MemberRole) => {
    // Fetch linked players to show which cards will be unlinked
    // The linked-players endpoint returns ALL linked players (members and non-members)
    try {
      const allLinked = await authRequest<LinkedPlayerInfo[]>(`/api/static-groups/${groupId}/linked-players`);
      const linkedToThisUser = allLinked.filter(lp => lp.user.id === userId);
      const linkedPlayerNames = linkedToThisUser.map(lp => lp.playerName);

      setMemberToRemove({ id: userId, name, role, linkedPlayerNames });
      setUnlinkPlayers(true); // Reset to default (on)
    } catch {
      // If we can't fetch linked players, proceed without the info
      setMemberToRemove({ id: userId, name, role, linkedPlayerNames: [] });
      setUnlinkPlayers(true);
    }
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;

    setIsSaving(true);
    try {
      const url = `/api/static-groups/${groupId}/members/${memberToRemove.id}?unlink_players=${unlinkPlayers}`;
      await authRequest(url, {
        method: 'DELETE',
      });
      setMemberToRemove(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmUnlinkPlayer = async () => {
    if (!linkedPlayerToUnlink) return;

    setIsSaving(true);
    try {
      await authRequest(
        `/api/static-groups/${groupId}/tiers/${linkedPlayerToUnlink.tierId}/players/${linkedPlayerToUnlink.playerId}/claim`,
        { method: 'DELETE' }
      );
      setLinkedPlayerToUnlink(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink player');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" label="Loading members" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} size="sm" />}

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
                    <Tooltip content="Edit role">
                      <button
                        onClick={() => setEditingMember(member.id)}
                        className="p-1 text-text-muted hover:text-text-primary transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}

                  {isEditing && (
                    <Tooltip content="Cancel">
                      <button
                        onClick={() => setEditingMember(null)}
                        className="p-1 text-text-muted hover:text-text-primary transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}

                  {canEditThis && (
                    <Tooltip content="Remove member">
                      <button
                        onClick={() => handleRemoveMember(
                          member.id,
                          member.displayName || member.discordUsername || 'Unknown',
                          membership.role
                        )}
                        disabled={isSaving}
                        className="p-1 text-text-muted hover:text-status-error transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </Tooltip>
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

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded border bg-membership-linked/20 text-membership-linked border-membership-linked/30">
                    Linked
                  </span>
                  {canManage && (
                    <Tooltip content={`Unlink ${linked.playerName}`}>
                      <button
                        onClick={() => setLinkedPlayerToUnlink(linked)}
                        disabled={isSaving}
                        className="p-1 text-text-muted hover:text-status-error transition-colors"
                      >
                        <Link2Off className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      <ConfirmModal
        isOpen={!!memberToRemove}
        title="Remove Member?"
        icon={<UserMinus className="w-5 h-5 text-status-error" />}
        message={
          <div className="space-y-3">
            <p>
              Remove <strong>{memberToRemove?.name}</strong> from this static?
            </p>
            <p className="text-text-secondary">
              They will lose access to this static.
            </p>
            {memberToRemove && memberToRemove.linkedPlayerNames.length > 0 && (
              <div className="pt-2 border-t border-border-subtle">
                <Toggle
                  checked={unlinkPlayers}
                  onChange={setUnlinkPlayers}
                  size="sm"
                  label="Unlink player card"
                  hint={`Also unlink ${memberToRemove.linkedPlayerNames.join(', ')} from their player ${memberToRemove.linkedPlayerNames.length === 1 ? 'card' : 'cards'}`}
                />
              </div>
            )}
          </div>
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />

      {/* Unlink Linked Player Confirmation Modal */}
      <ConfirmModal
        isOpen={!!linkedPlayerToUnlink}
        title="Unlink Player?"
        icon={<Link2Off className="w-5 h-5 text-status-warning" />}
        message={
          <div className="space-y-2">
            <p>
              Unlink <strong>{linkedPlayerToUnlink?.user.displayName || linkedPlayerToUnlink?.user.discordUsername}</strong> from the <strong>{linkedPlayerToUnlink?.playerName}</strong> player card?
            </p>
            <p className="text-text-secondary">
              They will no longer be associated with this player card, but can reclaim it later.
            </p>
          </div>
        }
        confirmLabel="Unlink"
        variant="warning"
        onConfirm={confirmUnlinkPlayer}
        onCancel={() => setLinkedPlayerToUnlink(null)}
      />
    </div>
  );
}
