/**
 * Weapon Priority Modal
 *
 * Modal for setting a player's weapon priority list.
 * Players can reorder jobs to indicate which weapons they want first.
 */

import { useState, useEffect, useRef } from 'react';
import type { SnapshotPlayer, WeaponPriority, MemberRole } from '../../types';
import { Modal } from '../ui/Modal';
import { WeaponPriorityEditor } from './WeaponPriorityEditor';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore } from '../../stores/authStore';
import { canEditPlayer } from '../../utils/permissions';

interface WeaponPriorityModalProps {
  player: SnapshotPlayer;
  groupId: string;
  tierId: string;
  userRole: MemberRole | null | undefined;
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
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [selectedJobsCount, setSelectedJobsCount] = useState(0);
  const addSelectedJobsRef = useRef<(() => void) | null>(null);
  const [showMainJobWarning, setShowMainJobWarning] = useState(false);
  const [mainJobAction, setMainJobAction] = useState<'move' | 'remove' | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Initialize weapon priorities from player
  useEffect(() => {
    if (isOpen) {
      const priorities = player.weaponPriorities || [];

      // Check if player has raid weapon marked as "Have"
      const raidWeapon = player.gear.find(
        (g) => g.slot === 'weapon' && g.bisSource === 'raid'
      );
      const hasRaidWeapon = raidWeapon?.hasItem || false;

      // If empty and player has a main job, add it as the first priority
      if (priorities.length === 0 && player.job) {
        setWeaponPriorities([{
          job: player.job,
          received: hasRaidWeapon,
          receivedDate: hasRaidWeapon ? new Date().toISOString() : undefined,
        }]);
      } else {
        // Backfill missing receivedDate for old data and sync with raid weapon
        const backfilled = priorities.map((wp) => {
          // Sync main job's received status with raid weapon (both directions)
          if (wp.job === player.job && wp.received !== hasRaidWeapon) {
            return {
              ...wp,
              received: hasRaidWeapon,
              receivedDate: hasRaidWeapon ? new Date().toISOString() : undefined,
            };
          }
          // Backfill missing receivedDate
          if (wp.received && !wp.receivedDate) {
            return { ...wp, receivedDate: new Date().toISOString() };
          }
          return wp;
        });
        setWeaponPriorities(backfilled);
      }
    }
  }, [isOpen, player.weaponPriorities, player.job, player.gear]);

  // Check permissions
  const permission = canEditPlayer(userRole, player, currentUser?.id);

  // Check if locked
  const isGlobalLocked = currentTier?.weaponPrioritiesGlobalLock || false;
  const isPlayerLocked = player.weaponPrioritiesLocked || false;
  const isAutoLocked = currentTier?.weaponPrioritiesAutoLockDate
    ? new Date() >= new Date(currentTier.weaponPrioritiesAutoLockDate)
    : false;

  const isLocked = isGlobalLocked || isPlayerLocked || isAutoLocked;
  const canEdit = permission.allowed && (!isLocked || (userRole && ['owner', 'lead'].includes(userRole)));

  const lockReason = isGlobalLocked
    ? 'Weapon priorities are globally locked'
    : isPlayerLocked
    ? 'This player\'s weapon priorities are locked'
    : isAutoLocked
    ? 'Weapon priorities have been auto-locked'
    : undefined;

  const handleSaveOrAddSelected = async () => {
    if (!canEdit) return;

    // If job selector is open with jobs selected, add them instead of saving
    if (showJobSelector && selectedJobsCount > 0 && addSelectedJobsRef.current) {
      addSelectedJobsRef.current();
      return;
    }

    // Otherwise, save weapon priorities
    setIsSaving(true);
    try {
      // Check if main job's received status differs from current raid weapon
      const mainJobPriority = weaponPriorities.find((wp) => wp.job === player.job);
      const raidWeapon = player.gear.find(
        (g) => g.slot === 'weapon' && g.bisSource === 'raid'
      );
      const currentRaidWeaponState = raidWeapon?.hasItem || false;
      const receivedStatusChanged =
        mainJobPriority &&
        mainJobPriority.received !== currentRaidWeaponState;

      // Batch updates if weapon needs syncing
      if (receivedStatusChanged && mainJobPriority) {
        const { useTierStore } = await import('../../stores/tierStore');
        const updatePlayer = useTierStore.getState().updatePlayer;

        // Find raid weapon in gear
        const updatedGear = player.gear.map((g) => {
          if (g.slot === 'weapon' && g.bisSource === 'raid') {
            return { ...g, hasItem: mainJobPriority.received };
          }
          return g;
        });

        // Batch both updates in single API call
        await updatePlayer(groupId, tierId, player.id, {
          weaponPriorities,
          gear: updatedGear,
        });
      } else {
        // Just save weapon priorities
        await updateWeaponPriorities(groupId, tierId, player.id, weaponPriorities);
      }

      onClose();
    } catch (error: any) {
      // Extract actual error message
      let errorMessage = 'Failed to save weapon priorities';
      if (typeof error === 'object' && error !== null) {
        errorMessage = error.message || error.detail || errorMessage;
      }

      // Show error to user via toast
      const { toast } = await import('../../stores/toastStore');
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Determine button label
  const saveButtonLabel = isSaving
    ? 'Saving...'
    : showJobSelector && selectedJobsCount > 0
    ? `Add Selected (${selectedJobsCount})`
    : 'Save';

  // Reset to main job only
  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = () => {
    if (player.job) {
      setWeaponPriorities([{ job: player.job, received: false }]);
    }
    setShowResetConfirm(false);
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
  };

  // Confirm main job action
  const handleConfirmMainJobAction = () => {
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
    setShowMainJobWarning(false);
    setMainJobAction(null);
  };

  const handleCancelMainJobAction = () => {
    pendingActionRef.current = null;
    setShowMainJobWarning(false);
    setMainJobAction(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${player.name || 'Player'} - Weapon Priorities`}
      >
        <div className="flex flex-col h-full max-h-[70vh]">
          {/* Fixed header section */}
          <div className="flex-shrink-0 space-y-4 pb-4">
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
                  Click "Add Job(s)" to start building your weapon priority list.
                </span>
              )}
            </p>
          </div>

          {/* Scrollable editor section */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <WeaponPriorityEditor
              weaponPriorities={weaponPriorities}
              onChange={setWeaponPriorities}
              disabled={!canEdit}
              mainJob={player.job}
              onShowJobSelectorChange={(show, count, addFn) => {
                setShowJobSelector(show);
                setSelectedJobsCount(count);
                addSelectedJobsRef.current = addFn;
              }}
              onMainJobMoveAttempt={(action) => {
                pendingActionRef.current = action;
                setMainJobAction('move');
                setShowMainJobWarning(true);
              }}
              onMainJobRemoveAttempt={(action) => {
                pendingActionRef.current = action;
                setMainJobAction('remove');
                setShowMainJobWarning(true);
              }}
            />
          </div>

          {/* Fixed footer section */}
          <div className="flex-shrink-0 flex justify-between gap-3 pt-4 border-t border-border-default">
            <button
              onClick={handleResetClick}
              disabled={!canEdit || weaponPriorities.length <= 1}
              className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset to main job only"
            >
              Reset
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOrAddSelected}
                disabled={!canEdit || isSaving}
                className="px-4 py-2 rounded bg-accent text-white hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveButtonLabel}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Main job warning dialog */}
      {showMainJobWarning && (
        <Modal
          isOpen={showMainJobWarning}
          onClose={handleCancelMainJobAction}
          title="Confirm Main Job Change"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {mainJobAction === 'move'
                ? `You're about to move your main job (${player.job}) out of the #1 priority position. This means you may receive a different weapon first.`
                : `You're about to remove your main job (${player.job}) from your weapon priorities. Are you sure?`}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
              <button
                onClick={handleCancelMainJobAction}
                className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMainJobAction}
                className="px-4 py-2 rounded bg-status-warning text-white hover:bg-status-warning/80 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <Modal
          isOpen={showResetConfirm}
          onClose={handleCancelReset}
          title="Confirm Reset"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Are you sure you want to reset your weapon priorities? This will remove all jobs except your main job ({player.job}).
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
              <button
                onClick={handleCancelReset}
                className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded bg-status-warning text-white hover:bg-status-warning/80 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
