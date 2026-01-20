/**
 * usePlayerActions Hook
 *
 * Provides all player CRUD operations for GroupView.
 * Extracts callbacks that were previously defined inline in GroupView.tsx.
 */

import { useCallback } from 'react';
import { useTierStore } from '../stores/tierStore';
import type { SnapshotPlayer, ResetMode, SortPreset, AssignPlayerRequest } from '../types';
import { resetGearProgress, unlinkBisData, resetGearCompletely } from '../utils/gearDefaults';

interface UsePlayerActionsParams {
  groupId: string | undefined;
  tierId: string | undefined;
  players: SnapshotPlayer[] | undefined;
  setEditingPlayerId: (id: string | null) => void;
  setSortPreset: (preset: SortPreset, tierId?: string) => void;
}

export interface UsePlayerActionsReturn {
  handleUpdatePlayer: (playerId: string, updates: Partial<SnapshotPlayer>) => Promise<void>;
  handleRemovePlayer: (playerId: string) => Promise<void>;
  handleClaimPlayer: (playerId: string) => Promise<void>;
  handleReleasePlayer: (playerId: string) => Promise<void>;
  handleAdminAssignPlayer: (playerId: string, data: AssignPlayerRequest) => Promise<void>;
  handleOwnerAssignPlayer: (playerId: string, data: AssignPlayerRequest) => Promise<void>;
  handleConfigurePlayer: (playerId: string, name: string, job: string, role: string) => Promise<void>;
  handleAddPlayer: () => Promise<void>;
  handleDuplicatePlayer: (sourcePlayer: SnapshotPlayer) => Promise<void>;
  handleResetGear: (playerId: string, mode: ResetMode) => Promise<void>;
  handleReorder: (updates: Array<{ playerId: string; data: Partial<SnapshotPlayer> }>) => Promise<void>;
}

export function usePlayerActions({
  groupId,
  tierId,
  players,
  setEditingPlayerId,
  setSortPreset,
}: UsePlayerActionsParams): UsePlayerActionsReturn {
  const {
    updatePlayer,
    addPlayer,
    removePlayer,
    reorderPlayers,
    claimPlayer,
    releasePlayer,
    adminAssignPlayer,
    ownerAssignPlayer,
  } = useTierStore();

  // Player update handler
  const handleUpdatePlayer = useCallback(async (playerId: string, updates: Partial<SnapshotPlayer>) => {
    if (!groupId || !tierId) return;
    await updatePlayer(groupId, tierId, playerId, updates);
  }, [groupId, tierId, updatePlayer]);

  // Player remove handler
  const handleRemovePlayer = useCallback(async (playerId: string) => {
    if (!groupId || !tierId) return;
    await removePlayer(groupId, tierId, playerId);
  }, [groupId, tierId, removePlayer]);

  // Claim player handler (take ownership)
  const handleClaimPlayer = useCallback(async (playerId: string) => {
    if (!groupId || !tierId) return;
    await claimPlayer(groupId, tierId, playerId);
  }, [groupId, tierId, claimPlayer]);

  // Release player handler (remove ownership)
  const handleReleasePlayer = useCallback(async (playerId: string) => {
    if (!groupId || !tierId) return;
    await releasePlayer(groupId, tierId, playerId);
  }, [groupId, tierId, releasePlayer]);

  // Admin assign player handler (admin-only)
  const handleAdminAssignPlayer = useCallback(async (playerId: string, data: AssignPlayerRequest) => {
    if (!groupId || !tierId) return;
    await adminAssignPlayer(groupId, tierId, playerId, data);
  }, [groupId, tierId, adminAssignPlayer]);

  // Owner assign player handler (owner-only)
  const handleOwnerAssignPlayer = useCallback(async (playerId: string, data: AssignPlayerRequest) => {
    if (!groupId || !tierId) return;
    await ownerAssignPlayer(groupId, tierId, playerId, data);
  }, [groupId, tierId, ownerAssignPlayer]);

  // Configure player (set name, job, role)
  const handleConfigurePlayer = useCallback(async (playerId: string, name: string, job: string, role: string) => {
    if (!groupId || !tierId) return;
    await updatePlayer(groupId, tierId, playerId, {
      name,
      job,
      role,
      configured: true,
    });
    setEditingPlayerId(null);
  }, [groupId, tierId, updatePlayer, setEditingPlayerId]);

  // Add player handler
  const handleAddPlayer = useCallback(async () => {
    if (!groupId || !tierId) return;
    await addPlayer(groupId, tierId);
  }, [groupId, tierId, addPlayer]);

  // Duplicate player handler - creates a copy of the player
  const handleDuplicatePlayer = useCallback(async (sourcePlayer: SnapshotPlayer) => {
    if (!groupId || !tierId) return;
    try {
      // Create a new player slot
      const newPlayer = await addPlayer(groupId, tierId);
      // Update the new player with the source player's data
      await updatePlayer(groupId, tierId, newPlayer.id, {
        name: `${sourcePlayer.name} (Copy)`,
        job: sourcePlayer.job,
        role: sourcePlayer.role,
        position: sourcePlayer.position,
        tankRole: sourcePlayer.tankRole,
        templateRole: sourcePlayer.templateRole,
        configured: true,
        gear: sourcePlayer.gear,
        tomeWeapon: sourcePlayer.tomeWeapon,
        isSubstitute: sourcePlayer.isSubstitute,
        notes: sourcePlayer.notes,
        bisLink: sourcePlayer.bisLink,
      });
    } catch {
      // Error handled in store
    }
  }, [groupId, tierId, addPlayer, updatePlayer]);

  // Reset gear handler - handles three reset modes
  const handleResetGear = useCallback(async (playerId: string, mode: ResetMode) => {
    if (!groupId || !tierId || !players) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    let updates: Partial<SnapshotPlayer>;

    switch (mode) {
      case 'progress': {
        // Reset progress only (keep BiS config)
        updates = {
          gear: resetGearProgress(player.gear),
          tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
        };
        break;
      }

      case 'unlink': {
        // Unlink BiS (keep progress and sources)
        updates = {
          gear: unlinkBisData(player.gear),
          bisLink: '',
        };
        break;
      }

      case 'all': {
        // Reset everything to smart defaults
        updates = {
          gear: resetGearCompletely(),
          tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
          bisLink: '',
        };
        break;
      }
    }

    await updatePlayer(groupId, tierId, playerId, updates);
  }, [groupId, tierId, players, updatePlayer]);

  // Reorder handler for DnD
  const handleReorder = useCallback(async (updates: Array<{ playerId: string; data: Partial<SnapshotPlayer> }>) => {
    if (!groupId || !tierId) return;
    await reorderPlayers(groupId, tierId, updates);
    setSortPreset('custom', tierId);
  }, [groupId, tierId, reorderPlayers, setSortPreset]);

  return {
    handleUpdatePlayer,
    handleRemovePlayer,
    handleClaimPlayer,
    handleReleasePlayer,
    handleAdminAssignPlayer,
    handleOwnerAssignPlayer,
    handleConfigurePlayer,
    handleAddPlayer,
    handleDuplicatePlayer,
    handleResetGear,
    handleReorder,
  };
}
