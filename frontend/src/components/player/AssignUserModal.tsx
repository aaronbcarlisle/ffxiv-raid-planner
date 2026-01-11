/**
 * AssignUserModal - Admin/Owner modal for assigning users to player cards
 *
 * Allows admins/owners to assign users with optional auto-membership creation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Checkbox, Select, type SelectOption } from '../ui';
import { Button } from '../primitives';
import { X, Users } from 'lucide-react';
import type { SnapshotPlayer, InteractedUser, AssignPlayerRequest } from '../../types';
import { authRequest } from '../../services/api';
import { logger } from '../../lib/logger';

const log = logger.scope('AssignUserModal');

interface AssignUserModalProps {
  player: SnapshotPlayer;
  groupId: string;
  isAdmin: boolean; // Determines dropdown content (all users vs members only)
  onClose: () => void;
  onAssign: (data: AssignPlayerRequest) => Promise<void>;
}

export function AssignUserModal({
  player,
  groupId,
  isAdmin,
  onClose,
  onAssign,
}: AssignUserModalProps) {
  const [useManualInput, setUseManualInput] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(player.userId || '');
  const [manualId, setManualId] = useState('');
  const [createMembership, setCreateMembership] = useState(false);
  const [membershipRole, setMembershipRole] = useState<'member' | 'lead'>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [interactedUsers, setInteractedUsers] = useState<InteractedUser[]>([]);

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // Admins fetch ALL users, owners fetch only group-interacted users
        const endpoint = isAdmin
          ? '/api/static-groups/admin/all-users'
          : `/api/static-groups/${groupId}/interacted-users`;

        const users = await authRequest<InteractedUser[]>(endpoint);
        setInteractedUsers(users);
        log.debug(`Fetched ${users.length} users (admin: ${isAdmin})`);
      } catch (error) {
        log.error('Failed to fetch users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [groupId, isAdmin]);

  // Check if selected user is a member
  const selectedUser = useMemo(() => {
    if (!selectedUserId || useManualInput) return null;
    return interactedUsers.find(u => u.user.id === selectedUserId);
  }, [selectedUserId, interactedUsers, useManualInput]);

  const isNonMember = selectedUser && !selectedUser.isMember;

  // Transform interacted users to SelectOption format
  const userOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [
      { value: '', label: '-- Select user --' },
      ...interactedUsers.map(u => ({
        value: u.user.id,
        label: `${u.user.displayName || u.user.discordUsername}${
          u.isMember ? ` (${u.memberRole})` : ' (linked player)'
        }`,
      })),
    ];
    return options;
  }, [interactedUsers]);

  // Determine effective user ID
  const effectiveUserId = useManualInput ? manualId.trim() : selectedUserId;
  const hasChanged = effectiveUserId !== (player.userId || '');

  const handleAssign = async () => {
    setIsSubmitting(true);
    try {
      const data: AssignPlayerRequest = {
        userId: effectiveUserId || null,
        createMembership: !!(isNonMember && createMembership),
        membershipRole: isNonMember && createMembership ? membershipRole : undefined,
      };
      await onAssign(data);
    } catch (error) {
      log.error('Failed to assign user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setIsSubmitting(true);
    try {
      await onAssign({ userId: null });
    } catch (error) {
      log.error('Failed to unassign user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Users className="w-5 h-5 text-accent" />
          Assign User to {player.name}
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Admin/Owner notice */}
        <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
          <p className="text-sm text-accent">
            <strong>{isAdmin ? 'Admin' : 'Owner'}:</strong> Assign users to player cards{isAdmin && ' with optional auto-membership'}.
          </p>
        </div>

        {/* Current status */}
        {player.userId && player.linkedUser && (
          <div className="p-3 bg-surface-elevated rounded-lg">
            <p className="text-sm text-text-secondary mb-1">Currently Assigned To:</p>
            <p className="text-text-primary font-medium">
              {player.linkedUser.displayName}{' '}
              <span className="text-text-muted">({player.linkedUser.discordUsername})</span>
            </p>
          </div>
        )}

        {/* Manual input toggle */}
        <Checkbox
          id="manual-input-toggle"
          checked={useManualInput}
          onChange={(checked) => {
            setUseManualInput(checked);
            if (checked) {
              setManualId('');
            } else {
              setSelectedUserId(player.userId || '');
            }
          }}
          label="Enter Discord ID manually"
          disabled={isSubmitting}
        />

        {/* User dropdown (when not using manual input) */}
        {!useManualInput && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Select User
            </label>
            {isLoading ? (
              <div className="text-sm text-text-muted">Loading users...</div>
            ) : (
              <Select
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={userOptions}
                placeholder="-- Select user --"
                disabled={isSubmitting}
              />
            )}
            <p className="text-xs text-text-muted mt-1">
              {isAdmin
                ? 'Admins see all users in the database'
                : 'Owners see only group members'}
            </p>
          </div>
        )}

        {/* Manual Discord ID input (when using manual input) */}
        {useManualInput && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Discord User ID
            </label>
            <Input
              type="text"
              value={manualId}
              onChange={setManualId}
              placeholder="Enter Discord User ID or internal user ID"
              className="w-full"
              disabled={isSubmitting}
            />
            <p className="text-xs text-text-muted mt-1">
              Enter the 18-digit Discord User ID or internal user ID.
            </p>
          </div>
        )}

        {/* Non-member warning and membership creation */}
        {isNonMember && !useManualInput && (
          <div className="p-3 bg-status-warning/10 border border-status-warning/20 rounded-lg space-y-3">
            <p className="text-sm text-status-warning">
              <strong>Not a member:</strong> This user is not currently a member of the group.
            </p>

            <Checkbox
              id="create-membership"
              checked={createMembership}
              onChange={setCreateMembership}
              label="Add them to the group"
              disabled={isSubmitting}
            />

            {createMembership && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Role
                </label>
                <Select
                  value={membershipRole}
                  onChange={(value) => setMembershipRole(value as 'member' | 'lead')}
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'lead', label: 'Lead' },
                  ]}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleAssign}
            disabled={isSubmitting || !hasChanged || (isLoading && !useManualInput)}
            className="flex-1"
          >
            {effectiveUserId ? 'Assign User' : 'Unassign'}
          </Button>

          {player.userId && (
            <Button
              type="button"
              variant="danger"
              onClick={handleUnassign}
              disabled={isSubmitting}
              title="Remove current assignment"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
