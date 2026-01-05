/**
 * Weapon Priority Modal
 *
 * Modal for setting a player's weapon priority list.
 * Fixed 3-column grid layout with inline job selector that replaces the grid view.
 * Players can drag to reorder jobs to indicate which weapons they want first.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SnapshotPlayer, WeaponPriority, MemberRole } from '../../types';
import { Modal } from '../ui/Modal';
import { WeaponPriorityGrid } from './WeaponPriorityGrid';
import { JobSelectorPanel } from './JobSelectorPanel';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore } from '../../stores/authStore';
import { canEditPlayer } from '../../utils/permissions';

const ITEMS_PER_COLUMN = 8;

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
  const [showMainJobWarning, setShowMainJobWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showJobSelector, setShowJobSelector] = useState(false);

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

      // Reset job selector view when modal opens
      setShowJobSelector(false);
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

  // Calculate modal size based on number of columns needed
  const modalSize = useMemo(() => {
    const numColumns = Math.ceil(weaponPriorities.length / ITEMS_PER_COLUMN) || 1;
    // When showing job selector, use lg for the 5-column job grid
    if (showJobSelector) return 'lg';
    // Size based on columns: 1 col = 2xl, 2 cols = 3xl, 3+ cols = 5xl
    if (numColumns <= 1) return '2xl';
    if (numColumns <= 2) return '3xl';
    return '5xl';
  }, [weaponPriorities.length, showJobSelector]) as 'lg' | '2xl' | '3xl' | '5xl';

  // Add jobs from the selector
  const handleAddJobs = useCallback((jobs: string[]) => {
    const newPriorities = jobs
      .filter((job) => !weaponPriorities.some((wp) => wp.job === job))
      .map((job) => ({
        job,
        received: false,
      } as WeaponPriority));

    if (newPriorities.length > 0) {
      setWeaponPriorities([...weaponPriorities, ...newPriorities]);
    }
    setShowJobSelector(false);
  }, [weaponPriorities]);

  // Handle main job move attempt
  const handleMainJobMoveAttempt = useCallback((action: () => void) => {
    setPendingAction(() => action);
    setShowMainJobWarning(true);
  }, []);

  // Save handler
  const handleSave = async () => {
    if (!canEdit) return;

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
    } catch (error: unknown) {
      // Extract actual error message
      let errorMessage = 'Failed to save weapon priorities';
      if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as { message?: string; detail?: string }).message ||
                       (error as { detail?: string }).detail ||
                       errorMessage;
      }

      // Show error to user via toast
      const { toast } = await import('../../stores/toastStore');
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

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
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setShowMainJobWarning(false);
  };

  const handleCancelMainJobAction = () => {
    setPendingAction(null);
    setShowMainJobWarning(false);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${player.name || 'Player'} - Weapon Priorities`}
        size={modalSize}
      >
        <div className="flex flex-col max-h-[70vh] overflow-hidden">
          {/* Header warnings - only show in priority view */}
          {!showJobSelector && (
            <div className="flex-shrink-0 space-y-3 pb-4">
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
              <div className="text-sm text-text-secondary">
                <p>Drag and drop to reorder. Jobs at the top will receive weapons first.</p>
              </div>
            </div>
          )}

          {/* Main content area - either Priority Grid or Job Selector */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {showJobSelector ? (
              <JobSelectorPanel
                existingJobs={weaponPriorities.map((wp) => wp.job)}
                onAddJobs={handleAddJobs}
                onCancel={() => setShowJobSelector(false)}
                disabled={!canEdit}
              />
            ) : (
              <WeaponPriorityGrid
                weaponPriorities={weaponPriorities}
                onChange={setWeaponPriorities}
                disabled={!canEdit}
                mainJob={player.job}
                onMainJobMoveAttempt={handleMainJobMoveAttempt}
                onAddJobsClick={() => setShowJobSelector(true)}
              />
            )}
          </div>

          {/* Footer - only show in priority view */}
          {!showJobSelector && (
            <div className="flex-shrink-0 flex justify-between gap-3 pt-4 border-t border-border-default mt-4">
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
                  onClick={handleSave}
                  disabled={!canEdit || isSaving}
                  className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
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
              You're about to move your main job ({player.job}) out of the #1 priority position.
              This means you may receive a different weapon first.
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
                className="px-4 py-2 rounded bg-status-warning text-status-warning-contrast font-bold hover:brightness-110 transition-colors"
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
                className="px-4 py-2 rounded bg-status-warning text-status-warning-contrast font-bold hover:brightness-110 transition-colors"
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
