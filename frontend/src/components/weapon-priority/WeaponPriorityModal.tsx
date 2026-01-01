/**
 * Weapon Priority Modal
 *
 * Modal for setting a player's weapon priority list.
 * Players can reorder jobs to indicate which weapons they want first.
 */

import { useState, useEffect } from 'react';
import type { SnapshotPlayer, WeaponPriority } from '../../types';
import { Modal } from '../ui/Modal';
import { WeaponPriorityEditor } from './WeaponPriorityEditor';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore } from '../../stores/authStore';
import { canEditPlayer } from '../../utils/permissions';

interface WeaponPriorityModalProps {
  player: SnapshotPlayer;
  groupId: string;
  tierId: string;
  userRole: string;
  isOpen: boolean;
  onClose: () => void;
}

export function WeaponPriorityModal({
  player,
  groupId,
  tierId,
  userRole,
  isOpen,
  onClose,
}: WeaponPriorityModalProps) {
  const currentUser = useAuthStore((state) => state.user);
  const updateWeaponPriorities = useTierStore((state) => state.updateWeaponPriorities);
  const currentTier = useTierStore((state) => state.currentTier);

  const [weaponPriorities, setWeaponPriorities] = useState<WeaponPriority[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize weapon priorities from player
  useEffect(() => {
    if (isOpen) {
      setWeaponPriorities(player.weaponPriorities || []);
    }
  }, [isOpen, player.weaponPriorities]);

  // Check permissions
  const permission = canEditPlayer(userRole, player, currentUser?.id);

  // Check if locked
  const isGlobalLocked = currentTier?.weaponPrioritiesGlobalLock || false;
  const isPlayerLocked = player.weaponPrioritiesLocked || false;
  const isAutoLocked = currentTier?.weaponPrioritiesAutoLockDate
    ? new Date() >= new Date(currentTier.weaponPrioritiesAutoLockDate)
    : false;

  const isLocked = isGlobalLocked || isPlayerLocked || isAutoLocked;
  const canEdit = permission.allowed && (!isLocked || ['owner', 'lead'].includes(userRole));

  const lockReason = isGlobalLocked
    ? 'Weapon priorities are globally locked'
    : isPlayerLocked
    ? 'This player\'s weapon priorities are locked'
    : isAutoLocked
    ? 'Weapon priorities have been auto-locked'
    : undefined;

  const handleSave = async () => {
    if (!canEdit) return;

    setIsSaving(true);
    try {
      await updateWeaponPriorities(groupId, tierId, player.id, weaponPriorities);
      onClose();
    } catch (error) {
      console.error('Failed to save weapon priorities:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${player.name || 'Player'} - Weapon Priorities`}
    >
      <div className="space-y-4">
        {/* Lock warning */}
        {isLocked && (
          <div className="bg-status-warning/10 border border-status-warning/30 rounded p-3 text-sm text-status-warning">
            {lockReason}
            {!canEdit && (
              <div className="mt-1 text-xs opacity-80">
                Only Owner/Lead can edit when locked
              </div>
            )}
          </div>
        )}

        {/* Permission denied */}
        {!permission.allowed && (
          <div className="bg-status-error/10 border border-status-error/30 rounded p-3 text-sm text-status-error">
            {permission.reason}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-text-secondary">
          Drag and drop to reorder. Jobs at the top will receive weapons first.
          {player.weaponPriorities.length === 0 && (
            <span className="block mt-1 text-text-muted">
              Click "Add Job" to start building your weapon priority list.
            </span>
          )}
        </p>

        {/* Editor */}
        <WeaponPriorityEditor
          weaponPriorities={weaponPriorities}
          onChange={setWeaponPriorities}
          disabled={!canEdit}
          mainJob={player.job}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit || isSaving}
            className="px-4 py-2 rounded bg-accent text-white hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
