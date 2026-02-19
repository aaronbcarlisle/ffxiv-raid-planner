/**
 * PlayerGrid Component
 *
 * Renders the grid of player cards in either group view (G1/G2) or standard view.
 * Handles both main roster and substitutes sections.
 */

import { memo, useMemo, useCallback } from 'react';
import { DroppablePlayerCard } from './DroppablePlayerCard';
import { EmptySlotCard } from './EmptySlotCard';
import { InlinePlayerEdit } from './InlinePlayerEdit';
import { LightPartyHeader } from './LightPartyHeader';
import { Tooltip } from '../primitives/Tooltip';
import { toast } from '../../stores/toastStore';
import { canResetGear } from '../../utils/permissions';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, ViewMode, ResetMode, GearSlot, MemberRole, ContentType, AssignPlayerRequest } from '../../types';
import type { DragState } from '../dnd/useDragAndDrop';

// Memoized player card renderer to prevent unnecessary re-renders
interface PlayerCardRendererProps {
  player: SnapshotPlayer;
  allPlayers: SnapshotPlayer[];
  editingPlayerId: string | null;
  viewMode: ViewMode;
  contentType: ContentType;
  clipboardPlayer: SnapshotPlayer | null;
  dragState: DragState;
  canEdit: boolean;
  effectiveUserId: string | undefined;
  userRole: MemberRole | null | undefined;
  userHasClaimedPlayer: boolean;
  isAdminAccess: boolean;
  isAdmin: boolean;
  viewAsUserId?: string;
  /** Hide "Unclaimed" banners (group setting) */
  hideSetupBanners?: boolean;
  /** Hide "No BiS configured" banners (group setting) */
  hideBisBanners?: boolean;
  groupId: string;
  tierId: string;
  highlightedPlayerId: string | null;
  playerSlotsWithLootEntries: Set<GearSlot> | undefined;
  playerSlotsWithMaterialEntries?: Set<GearSlot | 'tome_weapon'>;
  onUpdatePlayer: (playerId: string, updates: Partial<SnapshotPlayer>) => Promise<void>;
  onRemovePlayer: (playerId: string) => Promise<void>;
  onConfigurePlayer: (playerId: string, name: string, job: string, role: string) => Promise<void>;
  onDuplicatePlayer: (player: SnapshotPlayer) => Promise<void>;
  onResetGear: (playerId: string, mode: ResetMode) => Promise<void>;
  onClaimPlayer: (playerId: string) => Promise<void>;
  onReleasePlayer: (playerId: string) => Promise<void>;
  onAdminAssignPlayer: (playerId: string, data: AssignPlayerRequest) => Promise<void>;
  onOwnerAssignPlayer: (playerId: string, data: AssignPlayerRequest) => Promise<void>;
  onCopyPlayer: (player: SnapshotPlayer) => void;
  onPastePlayer: (playerId: string, clipboardPlayer: SnapshotPlayer) => void;
  onCopyUrl: (playerId: string) => void;
  onNavigateToLootEntry: (playerId: string, slot: GearSlot) => void;
  onNavigateToMaterialEntry?: (playerId: string, slot: string) => void;
  onNavigateToBooksPanel: (playerId: string) => void;
  onModalOpen: () => void;
  onModalClose: () => void;
  onEditPlayer: (playerId: string) => void;
  onCancelEdit: () => void;
}

const PlayerCardRenderer = memo(function PlayerCardRenderer({
  player,
  allPlayers,
  editingPlayerId,
  viewMode,
  contentType,
  clipboardPlayer,
  dragState,
  canEdit,
  effectiveUserId,
  userRole,
  userHasClaimedPlayer,
  isAdminAccess,
  isAdmin,
  viewAsUserId,
  hideSetupBanners,
  hideBisBanners,
  groupId,
  tierId,
  highlightedPlayerId,
  playerSlotsWithLootEntries,
  playerSlotsWithMaterialEntries,
  onUpdatePlayer,
  onRemovePlayer,
  onConfigurePlayer,
  onDuplicatePlayer,
  onResetGear,
  onClaimPlayer,
  onReleasePlayer,
  onAdminAssignPlayer,
  onOwnerAssignPlayer,
  onCopyPlayer,
  onPastePlayer,
  onCopyUrl,
  onNavigateToLootEntry,
  onNavigateToMaterialEntry,
  onNavigateToBooksPanel,
  onModalOpen,
  onModalClose,
  onEditPlayer,
  onCancelEdit,
}: PlayerCardRendererProps) {
  // Stable callbacks that use player.id
  const handleSave = useCallback((name: string, job: string, role: string) => {
    onConfigurePlayer(player.id, name, job, role);
  }, [onConfigurePlayer, player.id]);

  const handleUpdate = useCallback((updates: Partial<SnapshotPlayer>) => {
    onUpdatePlayer(player.id, updates);
  }, [onUpdatePlayer, player.id]);

  const handleRemove = useCallback(() => {
    onRemovePlayer(player.id);
  }, [onRemovePlayer, player.id]);

  const handleCopy = useCallback(() => {
    onCopyPlayer(player);
    toast.info(`Copied ${player.name}`);
  }, [onCopyPlayer, player, toast]);

  const handlePaste = useCallback(() => {
    if (clipboardPlayer) {
      onPastePlayer(player.id, clipboardPlayer);
      toast.success(`Pasted ${clipboardPlayer.name}'s data`);
    }
  }, [onPastePlayer, player.id, clipboardPlayer, toast]);

  const handleDuplicate = useCallback(() => {
    onDuplicatePlayer(player);
  }, [onDuplicatePlayer, player]);

  const handleResetGear = useCallback((mode: ResetMode) => {
    onResetGear(player.id, mode);
  }, [onResetGear, player.id]);

  const handleClaimPlayer = useCallback(() => {
    onClaimPlayer(player.id);
  }, [onClaimPlayer, player.id]);

  const handleReleasePlayer = useCallback(() => {
    onReleasePlayer(player.id);
  }, [onReleasePlayer, player.id]);

  const handleAdminAssignPlayer = useCallback((data: AssignPlayerRequest) => {
    onAdminAssignPlayer(player.id, data);
  }, [onAdminAssignPlayer, player.id]);

  const handleOwnerAssignPlayer = useCallback((data: AssignPlayerRequest) => {
    onOwnerAssignPlayer(player.id, data);
  }, [onOwnerAssignPlayer, player.id]);

  const handleCopyUrl = useCallback(() => {
    onCopyUrl(player.id);
  }, [onCopyUrl, player.id]);

  const handleNavigateToLootEntry = useCallback((slot: GearSlot) => {
    onNavigateToLootEntry(player.id, slot);
  }, [onNavigateToLootEntry, player.id]);

  const handleNavigateToMaterialEntry = useCallback((slot: string) => {
    onNavigateToMaterialEntry?.(player.id, slot);
  }, [onNavigateToMaterialEntry, player.id]);

  const handleNavigateToBooksPanel = useCallback(() => {
    onNavigateToBooksPanel(player.id);
  }, [onNavigateToBooksPanel, player.id]);

  const handleStartEdit = useCallback(() => {
    onEditPlayer(player.id);
  }, [onEditPlayer, player.id]);

  // If editing this player, show inline edit form
  if (editingPlayerId === player.id) {
    return (
      <InlinePlayerEdit
        player={player}
        userRole={userRole}
        onSave={handleSave}
        onCancel={onCancelEdit}
      />
    );
  }

  // If player is configured, show droppable player card
  if (player.configured) {
    // Check if user can reset this player's gear
    const resetPermission = canResetGear(userRole, player, effectiveUserId, isAdminAccess);

    return (
      <DroppablePlayerCard
        player={player}
        allPlayers={allPlayers}
        settings={DEFAULT_SETTINGS}
        viewMode={viewMode}
        contentType={contentType}
        clipboardPlayer={clipboardPlayer}
        dragState={dragState}
        canEdit={canEdit}
        currentUserId={effectiveUserId}
        isGroupOwner={userRole === 'owner'}
        userRole={userRole}
        userHasClaimedPlayer={userHasClaimedPlayer}
        isAdmin={isAdmin}
        isAdminAccess={isAdminAccess}
        viewAsUserId={viewAsUserId}
        hideSetupBanners={hideSetupBanners}
        hideBisBanners={hideBisBanners}
        groupId={groupId}
        tierId={tierId}
        isHighlighted={highlightedPlayerId === player.id}
        onUpdate={handleUpdate}
        onRemove={handleRemove}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDuplicate={handleDuplicate}
        onResetGear={resetPermission.allowed ? handleResetGear : undefined}
        onClaimPlayer={handleClaimPlayer}
        onReleasePlayer={handleReleasePlayer}
        onAdminAssignPlayer={handleAdminAssignPlayer}
        onOwnerAssignPlayer={handleOwnerAssignPlayer}
        onModalOpen={onModalOpen}
        onModalClose={onModalClose}
        onCopyUrl={handleCopyUrl}
        slotsWithLootEntries={playerSlotsWithLootEntries}
        slotsWithMaterialEntries={playerSlotsWithMaterialEntries}
        onNavigateToLootEntry={handleNavigateToLootEntry}
        onNavigateToMaterialEntry={handleNavigateToMaterialEntry}
        onNavigateToBooksPanel={handleNavigateToBooksPanel}
      />
    );
  }

  // Otherwise show empty slot
  return (
    <EmptySlotCard
      templateRole={player.templateRole}
      position={player.position}
      onStartEdit={handleStartEdit}
      onRemove={canEdit ? handleRemove : undefined}
    />
  );
});

interface GroupedPlayers {
  group1: SnapshotPlayer[];
  group2: SnapshotPlayer[];
  unassigned: SnapshotPlayer[];
  substitutes: SnapshotPlayer[];
}

export interface PlayerGridProps {
  players: SnapshotPlayer[];
  groupedPlayers: GroupedPlayers | null;
  groupView: boolean;
  subsView: boolean;
  viewMode: ViewMode;
  contentType: ContentType;
  editingPlayerId: string | null;
  clipboardPlayer: SnapshotPlayer | null;
  highlightedPlayerId: string | null;
  dragState: DragState;
  canEdit: boolean;
  effectiveUserId: string | undefined;
  userRole: MemberRole | null | undefined;
  userHasClaimedPlayer: boolean;
  isAdminAccess: boolean;
  isAdmin: boolean;
  viewAsUserId?: string;
  /** Hide "Unclaimed" banners (group setting) */
  hideSetupBanners?: boolean;
  /** Hide "No BiS configured" banners (group setting) */
  hideBisBanners?: boolean;
  groupId: string;
  tierId: string;
  playerSlotsWithLootEntries: Map<string, Set<GearSlot>>;
  playerSlotsWithMaterialEntries?: Map<string, Set<GearSlot | 'tome_weapon'>>;
  // Callbacks
  onUpdatePlayer: (playerId: string, updates: Partial<SnapshotPlayer>) => Promise<void>;
  onRemovePlayer: (playerId: string) => Promise<void>;
  onConfigurePlayer: (playerId: string, name: string, job: string, role: string) => Promise<void>;
  onDuplicatePlayer: (player: SnapshotPlayer) => Promise<void>;
  onResetGear: (playerId: string, mode: ResetMode) => Promise<void>;
  onClaimPlayer: (playerId: string) => Promise<void>;
  onReleasePlayer: (playerId: string) => Promise<void>;
  onAdminAssignPlayer: (playerId: string, data: AssignPlayerRequest) => Promise<void>;
  onOwnerAssignPlayer: (playerId: string, data: AssignPlayerRequest) => Promise<void>;
  onCopyPlayer: (player: SnapshotPlayer) => void;
  onPastePlayer: (playerId: string, clipboardPlayer: SnapshotPlayer) => void;
  onCopyUrl: (playerId: string) => void;
  onNavigateToLootEntry: (playerId: string, slot: GearSlot) => void;
  onNavigateToMaterialEntry?: (playerId: string, slot: string) => void;
  onNavigateToBooksPanel: (playerId: string) => void;
  onModalOpen: () => void;
  onModalClose: () => void;
  onEditPlayer: (playerId: string) => void;
  onCancelEdit: () => void;
}

// Grid classes - responsive from 1 column (mobile) to max 4 columns (wide screens)
const gridClasses = 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-4xl';

export function PlayerGrid({
  players,
  groupedPlayers,
  groupView,
  subsView,
  viewMode,
  contentType,
  editingPlayerId,
  clipboardPlayer,
  highlightedPlayerId,
  dragState,
  canEdit,
  effectiveUserId,
  userRole,
  userHasClaimedPlayer,
  isAdminAccess,
  isAdmin,
  viewAsUserId,
  hideSetupBanners,
  hideBisBanners,
  groupId,
  tierId,
  playerSlotsWithLootEntries,
  playerSlotsWithMaterialEntries,
  onUpdatePlayer,
  onRemovePlayer,
  onConfigurePlayer,
  onDuplicatePlayer,
  onResetGear,
  onClaimPlayer,
  onReleasePlayer,
  onAdminAssignPlayer,
  onOwnerAssignPlayer,
  onCopyPlayer,
  onPastePlayer,
  onCopyUrl,
  onNavigateToLootEntry,
  onNavigateToMaterialEntry,
  onNavigateToBooksPanel,
  onModalOpen,
  onModalClose,
  onEditPlayer,
  onCancelEdit,
}: PlayerGridProps) {
  // Memoize common props for PlayerCardRenderer to prevent unnecessary re-renders
  const renderCardProps = useMemo(() => ({
    allPlayers: players,
    editingPlayerId,
    viewMode,
    contentType,
    clipboardPlayer,
    dragState,
    canEdit,
    effectiveUserId,
    userRole,
    userHasClaimedPlayer,
    isAdminAccess,
    isAdmin,
    viewAsUserId,
    hideSetupBanners,
    hideBisBanners,
    groupId,
    tierId,
    highlightedPlayerId,
    onUpdatePlayer,
    onRemovePlayer,
    onConfigurePlayer,
    onDuplicatePlayer,
    onResetGear,
    onClaimPlayer,
    onReleasePlayer,
    onAdminAssignPlayer,
    onOwnerAssignPlayer,
    onCopyPlayer,
    onPastePlayer,
    onCopyUrl,
    onNavigateToLootEntry,
    onNavigateToMaterialEntry,
    onNavigateToBooksPanel,
    onModalOpen,
    onModalClose,
    onEditPlayer,
    onCancelEdit,
  }), [
    players,
    editingPlayerId,
    viewMode,
    contentType,
    clipboardPlayer,
    dragState,
    canEdit,
    effectiveUserId,
    userRole,
    userHasClaimedPlayer,
    isAdminAccess,
    isAdmin,
    viewAsUserId,
    hideSetupBanners,
    hideBisBanners,
    groupId,
    tierId,
    highlightedPlayerId,
    onUpdatePlayer,
    onRemovePlayer,
    onConfigurePlayer,
    onDuplicatePlayer,
    onResetGear,
    onClaimPlayer,
    onReleasePlayer,
    onAdminAssignPlayer,
    onOwnerAssignPlayer,
    onCopyPlayer,
    onPastePlayer,
    onCopyUrl,
    onNavigateToLootEntry,
    onNavigateToMaterialEntry,
    onNavigateToBooksPanel,
    onModalOpen,
    onModalClose,
    onEditPlayer,
    onCancelEdit,
  ]);

  // Grouped View (G1/G2) - G1 on top, G2 below
  if (groupView && groupedPlayers) {
    return (
      <div className="space-y-3 mb-3">
        {/* Group 1 */}
        {groupedPlayers.group1.length > 0 && (
          <div>
            <LightPartyHeader groupNumber={1} players={groupedPlayers.group1} />
            <div className={gridClasses}>
              {groupedPlayers.group1.map((player) => (
                <PlayerCardRenderer
                  key={player.id}
                  player={player}
                  playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
                  playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
                  {...renderCardProps}
                />
              ))}
            </div>
          </div>
        )}

        {/* Group 2 */}
        {groupedPlayers.group2.length > 0 && (
          <div>
            <LightPartyHeader groupNumber={2} players={groupedPlayers.group2} />
            <div className={gridClasses}>
              {groupedPlayers.group2.map((player) => (
                <PlayerCardRenderer
                  key={player.id}
                  player={player}
                  playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
                  playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
                  {...renderCardProps}
                />
              ))}
            </div>
          </div>
        )}

        {/* Unassigned */}
        {groupedPlayers.unassigned.length > 0 && (
          <div className="opacity-75">
            <h3 className="text-text-muted text-sm font-medium mb-3">
              Unassigned Positions
            </h3>
            <div className={gridClasses}>
              {groupedPlayers.unassigned.map((player) => (
                <PlayerCardRenderer
                  key={player.id}
                  player={player}
                  playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
                  playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
                  {...renderCardProps}
                />
              ))}
            </div>
          </div>
        )}

        {/* Substitutes - shown when subsView is enabled */}
        {subsView && groupedPlayers.substitutes.length > 0 && (
          <div className="opacity-75">
            <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
              <Tooltip
                content={
                  <div>
                    <div className="font-medium">Substitutes</div>
                    <div className="text-text-secondary text-xs mt-0.5">Backup players not in the main roster</div>
                  </div>
                }
              >
                <span className="bg-surface-interactive text-text-muted px-2 py-0.5 rounded text-xs font-bold border border-border-subtle cursor-help">SUB</span>
              </Tooltip>
              Substitutes
            </h3>
            <div className={gridClasses}>
              {groupedPlayers.substitutes.map((player) => (
                <PlayerCardRenderer
                  key={player.id}
                  player={player}
                  playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
                  playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
                  {...renderCardProps}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard View - with optional subs section
  return (
    <div className="space-y-3 mb-3">
      <div className={gridClasses}>
        {subsView
          ? players.filter(p => !p.isSubstitute).map((player) => (
              <PlayerCardRenderer
                key={player.id}
                player={player}
                playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
                playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
                {...renderCardProps}
              />
            ))
          : players.map((player) => (
              <PlayerCardRenderer
                key={player.id}
                player={player}
                playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
                playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
                {...renderCardProps}
              />
            ))
        }
      </div>
      {/* Substitutes section - shown in standard view when subsView is enabled */}
      {subsView && players.some(p => p.isSubstitute) && (
        <div className="opacity-75">
          <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
            <Tooltip
              content={
                <div>
                  <div className="font-medium">Substitutes</div>
                  <div className="text-text-secondary text-xs mt-0.5">Backup players not in the main roster</div>
                </div>
              }
            >
              <span className="bg-surface-interactive text-text-muted px-2 py-0.5 rounded text-xs font-bold border border-border-subtle cursor-help">SUB</span>
            </Tooltip>
            Substitutes
          </h3>
          <div className={gridClasses}>
            {players.filter(p => p.isSubstitute).map((player) => (
              <PlayerCardRenderer
                key={player.id}
                player={player}
                playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
                playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
                {...renderCardProps}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
