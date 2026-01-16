/**
 * AssignUserModal - Admin/Owner modal for assigning users to player cards
 *
 * Allows admins/owners to assign users with optional auto-membership creation.
 * Shows role badges next to user names and handles reassignment confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal, ConfirmModal, Input, Checkbox, Select, Label, type SelectOption } from '../ui';
import { Button } from '../primitives';
import { X, Users, AlertTriangle } from 'lucide-react';
import type { SnapshotPlayer, InteractedUser, AssignPlayerRequest, MemberRole } from '../../types';
import { authRequest } from '../../services/api';
import { logger } from '../../lib/logger';
import { toast } from '../../stores/toastStore';
import { parseApiError } from '../../lib/errorHandler';

/**
 * Role badge colors matching design system
 */
const ROLE_BADGE_STYLES: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/30 text-membership-owner border-membership-owner/50',
  lead: 'bg-membership-lead/30 text-membership-lead border-membership-lead/50',
  member: 'bg-membership-member/30 text-membership-member border-membership-member/50',
  viewer: 'bg-membership-viewer/30 text-membership-viewer border-membership-viewer/50',
};

const LINKED_BADGE_STYLE = 'bg-membership-linked/30 text-membership-linked border-membership-linked/50';

/**
 * Role badge component for select dropdown
 */
function RoleBadge({ role, isLinked }: { role?: MemberRole; isLinked?: boolean }) {
  if (isLinked) {
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${LINKED_BADGE_STYLE}`}>
        Linked
      </span>
    );
  }
  if (!role) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${ROLE_BADGE_STYLES[role]}`}>
      {role}
    </span>
  );
}

const log = logger.scope('AssignUserModal');

// Discord IDs are 17-19 digit snowflakes
const DISCORD_ID_REGEX = /^\d{17,19}$/;
// UUID v4 format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a user ID (Discord ID or internal UUID)
 */
function isValidUserId(id: string): boolean {
  if (!id.trim()) return true; // Empty is valid (for unassign)
  return DISCORD_ID_REGEX.test(id) || UUID_REGEX.test(id);
}

interface AssignUserModalProps {
  player: SnapshotPlayer;
  groupId: string;
  isAdmin: boolean; // Determines dropdown content (all users vs members only)
  /** All players in the tier (for checking existing assignments) */
  allPlayers?: SnapshotPlayer[];
  onClose: () => void;
  onAssign: (data: AssignPlayerRequest) => Promise<void>;
}

export function AssignUserModal({
  player,
  groupId,
  isAdmin,
  allPlayers = [],
  onClose,
  onAssign,
}: AssignUserModalProps) {
  const [useManualInput, setUseManualInput] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(player.userId || '');
  const [manualId, setManualId] = useState('');
  const [manualIdError, setManualIdError] = useState<string | null>(null);
  const [createMembership, setCreateMembership] = useState(false);
  const [membershipRole, setMembershipRole] = useState<'member' | 'lead'>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [interactedUsers, setInteractedUsers] = useState<InteractedUser[]>([]);
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);
  const [pendingReassignUserId, setPendingReassignUserId] = useState<string | null>(null);

  // Reset state when player changes (defensive - in case modal stays mounted between uses)
  useEffect(() => {
    setSelectedUserId(player.userId || '');
    setUseManualInput(false);
    setManualId('');
    setManualIdError(null);
    setCreateMembership(false);
    setShowReassignConfirm(false);
    setPendingReassignUserId(null);
  }, [player.id, player.userId]);

  // Build a map of userId -> player name for existing assignments (excluding current player)
  const userAssignments = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allPlayers) {
      if (p.userId && p.id !== player.id) {
        map.set(p.userId, p.name);
      }
    }
    return map;
  }, [allPlayers, player.id]);

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // Admins fetch ALL users (with group context for membership check), owners fetch only group-interacted users
        const encodedGroupId = encodeURIComponent(groupId);
        const endpoint = isAdmin
          ? `/api/static-groups/admin/all-users?group_id=${encodedGroupId}`
          : `/api/static-groups/${encodedGroupId}/interacted-users`;

        const users = await authRequest<InteractedUser[]>(endpoint);
        setInteractedUsers(users);
        log.debug(`Fetched ${users.length} users (admin: ${isAdmin})`);
      } catch (error) {
        log.error('Failed to fetch users:', error);
        const apiError = parseApiError(error);
        toast.error(apiError.message || 'Failed to load users');
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

  // Default checkbox to checked when selecting a non-member
  useEffect(() => {
    if (isNonMember) {
      setCreateMembership(true);
    }
  }, [isNonMember]);

  // Transform interacted users to SelectOption format with role badges
  // Sort: unassigned users first, then assigned users at bottom
  const userOptions = useMemo<SelectOption[]>(() => {
    // Sort users: unassigned first, assigned last
    const sortedUsers = [...interactedUsers].sort((a, b) => {
      const aAssigned = userAssignments.has(a.user.id);
      const bAssigned = userAssignments.has(b.user.id);
      if (aAssigned && !bAssigned) return 1;
      if (!aAssigned && bAssigned) return -1;
      // Secondary sort by name
      const aName = a.user.displayName || a.user.discordUsername;
      const bName = b.user.displayName || b.user.discordUsername;
      return aName.localeCompare(bName);
    });

    const options: SelectOption[] = [
      { value: '', label: '-- Select user --' },
      ...sortedUsers.map(u => {
        const assignedToPlayer = userAssignments.get(u.user.id);
        const displayName = u.user.displayName || u.user.discordUsername;

        return {
          value: u.user.id,
          label: assignedToPlayer
            ? `${displayName} (assigned to ${assignedToPlayer})`
            : displayName,
          icon: <RoleBadge role={u.memberRole} isLinked={!u.isMember} />,
        };
      }),
    ];
    return options;
  }, [interactedUsers, userAssignments]);

  // Determine effective user ID
  const effectiveUserId = useManualInput ? manualId.trim() : selectedUserId;
  const hasChanged = effectiveUserId !== (player.userId || '');

  // Get info about pending reassignment for the confirm modal
  const pendingReassignPlayerName = pendingReassignUserId
    ? userAssignments.get(pendingReassignUserId)
    : null;
  const pendingReassignUserName = useMemo(() => {
    if (!pendingReassignUserId) return null;
    const user = interactedUsers.find(u => u.user.id === pendingReassignUserId);
    return user?.user.displayName || user?.user.discordUsername || 'this user';
  }, [pendingReassignUserId, interactedUsers]);

  // Handle user selection - check for reassignment confirmation
  const handleUserSelect = (userId: string) => {
    if (userId && userAssignments.has(userId)) {
      // User is already assigned to another player - show confirmation
      setPendingReassignUserId(userId);
      setShowReassignConfirm(true);
    } else {
      setSelectedUserId(userId);
    }
  };

  // Confirm reassignment
  const handleConfirmReassign = () => {
    if (pendingReassignUserId) {
      setSelectedUserId(pendingReassignUserId);
    }
    setShowReassignConfirm(false);
    setPendingReassignUserId(null);
  };

  // Cancel reassignment - keep the previous valid selection
  // (selectedUserId already holds the user's last valid choice before they triggered the confirm)
  const handleCancelReassign = () => {
    setShowReassignConfirm(false);
    setPendingReassignUserId(null);
    // Don't reset selectedUserId - it already contains the user's previous valid selection
  };

  const handleAssign = async () => {
    // Validate manual ID if using manual input
    if (useManualInput && effectiveUserId && !isValidUserId(effectiveUserId)) {
      setManualIdError('Please enter a valid Discord ID (17-19 digits) or internal user ID (UUID format)');
      return;
    }
    setManualIdError(null);

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
      const apiError = parseApiError(error);
      toast.error(apiError.message || 'Failed to assign user');
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
      const apiError = parseApiError(error);
      toast.error(apiError.message || 'Failed to unassign user');
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
            <Label>Select User</Label>
            {isLoading ? (
              <div className="text-sm text-text-muted">Loading users...</div>
            ) : (
              <Select
                value={selectedUserId}
                onChange={handleUserSelect}
                options={userOptions}
                placeholder="-- Select user --"
                disabled={isSubmitting}
              />
            )}
            <p className="text-xs text-text-muted mt-1">
              {isAdmin
                ? 'Admins see all users in the database'
                : 'Owners see only static members'}
            </p>
          </div>
        )}

        {/* Manual Discord ID input (when using manual input) */}
        {useManualInput && (
          <div>
            <Label>Discord User ID</Label>
            <Input
              type="text"
              value={manualId}
              onChange={(value) => {
                setManualId(value);
                setManualIdError(null); // Clear error on change
              }}
              placeholder="Enter Discord User ID or internal user ID"
              className={`w-full ${manualIdError ? 'border-status-error' : ''}`}
              disabled={isSubmitting}
            />
            {manualIdError ? (
              <p className="text-xs text-status-error mt-1">{manualIdError}</p>
            ) : (
              <p className="text-xs text-text-muted mt-1">
                Enter a Discord User ID (17-19 digits) or internal user ID (UUID).
              </p>
            )}
          </div>
        )}

        {/* Non-member warning and membership creation */}
        {isNonMember && !useManualInput && (
          <div className="p-3 bg-status-warning/10 border border-status-warning/20 rounded-lg space-y-3">
            <p className="text-sm text-status-warning">
              <strong>Not a member:</strong> This user is not currently a member of this static.
            </p>

            <Checkbox
              id="create-membership"
              checked={createMembership}
              onChange={setCreateMembership}
              label="Add them to this static"
              disabled={isSubmitting}
            />

            {createMembership && (
              <div>
                <Label>Role</Label>
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

      {/* Reassignment confirmation modal */}
      <ConfirmModal
        isOpen={showReassignConfirm}
        onCancel={handleCancelReassign}
        onConfirm={handleConfirmReassign}
        title="Reassign User?"
        icon={<AlertTriangle className="w-5 h-5 text-status-warning" />}
        message={
          <div className="space-y-2">
            <p>
              <strong>{pendingReassignUserName}</strong> is currently assigned to{' '}
              <strong>{pendingReassignPlayerName}</strong>.
            </p>
            <p>
              Assigning them to <strong>{player.name}</strong> will release their ownership
              of {pendingReassignPlayerName}.
            </p>
          </div>
        }
        confirmLabel="Reassign"
        variant="warning"
      />
    </Modal>
  );
}
