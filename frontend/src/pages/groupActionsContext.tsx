/**
 * GroupActions context + shared GroupActionModals (F6a, Task 8)
 *
 * Unifies the 5 chrome-triggered GroupView actions (tier-change, add-player,
 * new/rollover/delete tier) behind a typed React context that BOTH chromes
 * (legacy GroupView, v2 NewShell), the keyboard-shortcut hook, and the v2 TopBar
 * (Task 9) consume — and owns the add-player + create/rollover/delete-tier modal
 * STATE in one place so neither chrome duplicates it.
 *
 * Two contexts on purpose:
 *   - a STABLE "dispatch" context (`actions` + `openAddPlayerForRequest`) so
 *     pure-action consumers (the legacy Header→GroupView bridge, the keyboard
 *     hook) don't re-render when a modal toggles;
 *   - a VOLATILE "state" context (`isActionModalOpen` + `addedPlayer`) that the
 *     content reads to (a) fold modal-open into its `isAnyModalOpen` gate and
 *     (b) scroll-to + highlight a freshly added player.
 *
 * This is the same modal behavior GroupView had pre-split; `GroupActionModals`
 * is just the single owner both chromes render. The legacy `HEADER_EVENTS` bus
 * is untouched — it remains the legacy Header→GroupView bridge (GroupView's
 * listener now calls these context handlers).
 */
/* eslint-disable react-refresh/only-export-components -- Intentionally co-locates the GroupActionModals provider with its consumer hooks (one context module). */

import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useJoinRequestStore } from '../stores/joinRequestStore';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import { toast } from '../stores/toastStore';
import { getTierById } from '../gamedata';
import { AddPlayerModal, type AddPlayerData } from '../components/player/AddPlayerModal';
import { RolloverDialog, CreateTierModal, DeleteTierModal } from '../components/static-group';
import type { JoinRequest } from '../types';
import type { GroupActions } from './GroupViewContent';

/** A freshly added player to scroll-to + highlight. `nonce` re-fires the effect
 *  even if the same id is added twice. Replaces the old `Events.PLAYER_ADDED`. */
export interface AddedPlayerSignal {
  playerId: string;
  nonce: number;
}

/** Stable dispatch surface — identity only changes when the group/tier changes. */
interface GroupActionsDispatch {
  actions: GroupActions;
  /** Open the add-player modal pre-filled from an accepted join request. */
  openAddPlayerForRequest: (request: JoinRequest) => void;
}

/** Volatile modal/highlight state — identity changes when a modal toggles or a
 *  player is added. */
interface GroupActionsState {
  isActionModalOpen: boolean;
  addedPlayer: AddedPlayerSignal | null;
}

const GroupActionsDispatchContext = createContext<GroupActionsDispatch | null>(null);
const GroupActionsStateContext = createContext<GroupActionsState | null>(null);

/** The 5 typed action callbacks. Throws outside a `GroupActionModals` provider. */
export function useGroupActions(): GroupActions {
  const ctx = useContext(GroupActionsDispatchContext);
  if (!ctx) throw new Error('useGroupActions must be used within a <GroupActionModals> provider');
  return ctx.actions;
}

/** Open the add-player modal from an accepted join request (settings panel). */
export function useGroupAddToRoster(): (request: JoinRequest) => void {
  const ctx = useContext(GroupActionsDispatchContext);
  if (!ctx) throw new Error('useGroupAddToRoster must be used within a <GroupActionModals> provider');
  return ctx.openAddPlayerForRequest;
}

/** True while any chrome-owned action modal is open. `false` outside a provider
 *  (so the content's modal gate degrades safely when rendered in isolation). */
export function useGroupActionModalOpen(): boolean {
  return useContext(GroupActionsStateContext)?.isActionModalOpen ?? false;
}

/** The most-recently-added player to scroll-to + highlight, or `null`. */
export function useGroupAddedPlayer(): AddedPlayerSignal | null {
  return useContext(GroupActionsStateContext)?.addedPlayer ?? null;
}

export interface GroupActionModalsProps {
  children?: React.ReactNode;
  /** Navigate to the roster tab after a tier is created (chrome-specific, since
   *  `setPageMode` lives in each chrome's `useGroupViewState` instance). */
  onTierCreated?: () => void;
}

/**
 * Owns the chrome-triggered modal STATE (add-player + create/rollover/delete
 * tier), renders those modals, and provides the GroupActions context. Both
 * chromes render exactly one of these, wrapping the content that consumes it.
 */
export function GroupActionModals({ children, onTierCreated }: GroupActionModalsProps) {
  const { currentGroup } = useStaticGroupStore();
  const { tiers, currentTier, addPlayer, updatePlayer, fetchTier } = useTierStore();
  const { linkRoster } = useJoinRequestStore();
  const [, setSearchParams] = useSearchParams();

  // ── Modal state (moved verbatim out of GroupView) ──
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [rosteringRequest, setRosteringRequest] = useState<JoinRequest | null>(null);
  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [showDeleteTierConfirm, setShowDeleteTierConfirm] = useState(false);

  // Add-player highlight bridge (replaces Events.PLAYER_ADDED).
  const [addedPlayer, setAddedPlayer] = useState<AddedPlayerSignal | null>(null);
  const addedNonceRef = useRef(0);

  // ── Action handlers ──
  // onTierChange: byte-for-byte from GroupView.handleTierChange (uses the raw
  // useSearchParams setter — identical to useGroupViewState's setSearchParams —
  // so no extra useGroupViewState instance / duplicate effects are introduced).
  const onTierChange = useCallback((tierId: string) => {
    if (currentGroup?.id) {
      try {
        localStorage.setItem(`selected-tier-${currentGroup.id}`, tierId);
      } catch {
        // Ignore localStorage errors
      }
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('tier', tierId);
        return params;
      }, { replace: true });
      fetchTier(currentGroup.id, tierId);
    }
  }, [currentGroup?.id, fetchTier, setSearchParams]);

  const onAddPlayer = useCallback(() => setShowAddPlayerModal(true), []);
  const onNewTier = useCallback(() => setShowCreateTierModal(true), []);
  const onRollover = useCallback(() => setShowRolloverDialog(true), []);
  const onDeleteTier = useCallback(() => setShowDeleteTierConfirm(true), []);

  // Accepted join request → roster (moved verbatim from GroupView.handleAddToRoster).
  const openAddPlayerForRequest = useCallback((request: JoinRequest) => {
    if (request.rosterPlayerId) {
      toast.info('Already added to roster');
      return;
    }
    if (!currentTier?.tierId) {
      toast.error('Create a tier first before adding to roster.');
      return;
    }
    useSettingsPanelStore.getState().close();
    setRosteringRequest(request);
    setShowAddPlayerModal(true);
  }, [currentTier?.tierId]);

  // Add-player submit (moved verbatim from GroupView.handleAddPlayerSubmit; the
  // only change is the highlight signal — Events.PLAYER_ADDED → addedPlayer state).
  const handleAddPlayerSubmit = useCallback(async (data: AddPlayerData) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;

    setIsAddingPlayer(true);
    try {
      const newPlayer = await addPlayer(currentGroup.id, currentTier.tierId);

      const updatePayload: Record<string, unknown> = {
        name: data.name,
        job: data.job,
        role: data.role,
        position: data.position,
        tankRole: data.tankRole,
        configured: true,
      };

      const req = rosteringRequest;
      if (req) {
        if (req.characterNameAtApply) updatePayload.lodestoneName = req.characterNameAtApply;
        if (req.characterWorldAtApply) updatePayload.lodestoneServer = req.characterWorldAtApply;
        if (req.characterAvatarUrlAtApply) updatePayload.lodestoneAvatarUrl = req.characterAvatarUrlAtApply;
        if (req.characterLodestoneIdAtApply) updatePayload.lodestoneId = req.characterLodestoneIdAtApply;
      }

      await updatePlayer(currentGroup.id, currentTier.tierId, newPlayer.id, updatePayload);

      if (req) {
        try {
          await linkRoster(req.id, newPlayer.id);
        } catch {
          toast.warning('Roster entry created, but the request was not linked. You can retry linking from the Requests tab.');
        }
        setRosteringRequest(null);
      }

      // Signal the content (which owns the highlight state) to scroll-to +
      // highlight the new card. Replaces the eventBus PLAYER_ADDED hop.
      addedNonceRef.current += 1;
      setAddedPlayer({ playerId: newPlayer.id, nonce: addedNonceRef.current });

      toast.success(`Added ${data.name} to the roster`);
    } catch {
      // Error handled in store
    } finally {
      setIsAddingPlayer(false);
    }
  }, [currentGroup?.id, currentTier?.tierId, addPlayer, updatePlayer, rosteringRequest, linkRoster]);

  // Post-delete refetch (moved verbatim from GroupView.handleTierDeleted).
  const handleTierDeleted = useCallback(async () => {
    if (!currentGroup?.id) return;
    const { tiers: freshTiers } = useTierStore.getState();
    if (freshTiers.length > 0) {
      const nextTier = freshTiers.find(t => t.isActive) || freshTiers[0];
      if (nextTier) {
        await fetchTier(currentGroup.id, nextTier.tierId);
      }
    }
  }, [currentGroup?.id, fetchTier]);

  const existingTierIds = tiers.map(t => t.tierId);

  const isActionModalOpen = showAddPlayerModal || showCreateTierModal || showRolloverDialog || showDeleteTierConfirm;

  const actions = useMemo<GroupActions>(() => ({
    onTierChange,
    onAddPlayer,
    onNewTier,
    onRollover,
    onDeleteTier,
  }), [onTierChange, onAddPlayer, onNewTier, onRollover, onDeleteTier]);

  const dispatchValue = useMemo<GroupActionsDispatch>(() => ({
    actions,
    openAddPlayerForRequest,
  }), [actions, openAddPlayerForRequest]);

  const stateValue = useMemo<GroupActionsState>(() => ({
    isActionModalOpen,
    addedPlayer,
  }), [isActionModalOpen, addedPlayer]);

  return (
    <GroupActionsDispatchContext.Provider value={dispatchValue}>
      <GroupActionsStateContext.Provider value={stateValue}>
        {children}

        {/* Create Tier Modal */}
        {showCreateTierModal && currentGroup && (
          <CreateTierModal
            groupId={currentGroup.id}
            existingTierIds={existingTierIds}
            onClose={() => setShowCreateTierModal(false)}
            onCreate={() => onTierCreated?.()}
          />
        )}

        {/* Add Player Modal */}
        <AddPlayerModal
          isOpen={showAddPlayerModal}
          onClose={() => { setShowAddPlayerModal(false); setRosteringRequest(null); }}
          onAdd={handleAddPlayerSubmit}
          isLoading={isAddingPlayer}
          initialName={rosteringRequest?.characterNameAtApply || rosteringRequest?.requester?.displayName}
          initialJob={rosteringRequest?.selectedJob?.toUpperCase()}
          contextLabel={rosteringRequest ? 'Adding from application' : undefined}
          tierName={currentTier?.tierId ? getTierById(currentTier.tierId)?.name : undefined}
        />

        {/* Rollover Dialog */}
        {showRolloverDialog && currentGroup && currentTier && (
          <RolloverDialog
            groupId={currentGroup.id}
            currentTier={currentTier}
            existingTierIds={existingTierIds}
            onClose={() => setShowRolloverDialog(false)}
          />
        )}

        {/* Delete Tier Confirmation */}
        {showDeleteTierConfirm && currentGroup && currentTier && (
          <DeleteTierModal
            groupId={currentGroup.id}
            tierSnapshotId={currentTier.id}
            tierId={currentTier.tierId}
            onClose={() => setShowDeleteTierConfirm(false)}
            onDeleted={handleTierDeleted}
          />
        )}
      </GroupActionsStateContext.Provider>
    </GroupActionsDispatchContext.Provider>
  );
}
