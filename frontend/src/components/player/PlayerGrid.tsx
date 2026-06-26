/**
 * PlayerGrid Component
 *
 * Renders the grid of player cards in either group view (G1/G2) or standard view.
 * Handles both main roster and substitutes sections.
 */

import { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
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

// Collapsible-section state (G1 / G2 / Subs), persisted per static+tier.
// localStorage can throw (private mode / disabled / quota); the helpers swallow
// failures so a storage error never breaks rendering or a fold toggle.
type CollapsedState = { g1?: boolean; g2?: boolean; subs?: boolean };

function readCollapsedState(key: string): CollapsedState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    // Guard against a non-object value (e.g. a stale "null" / "[]" / "true")
    // that would otherwise break `collapsed.g1` reads downstream.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function writeCollapsedState(key: string, value: CollapsedState): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

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
  highlightedSlot: string | null;
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
  highlightedSlot,
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
    return onAdminAssignPlayer(player.id, data);
  }, [onAdminAssignPlayer, player.id]);

  const handleOwnerAssignPlayer = useCallback((data: AssignPlayerRequest) => {
    return onOwnerAssignPlayer(player.id, data);
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
        isHighlighted={highlightedPlayerId === player.id && (!highlightedSlot || viewMode !== 'expanded')}
        highlightedSlot={highlightedPlayerId === player.id && viewMode === 'expanded' ? highlightedSlot : null}
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
  /** Hide the substitutes section entirely (controlled by the roster toolbar) */
  subsHidden: boolean;
  /**
   * Monotonic counter bumped each time the user clicks the "Expanded" view
   * control. Lets re-clicking Expanded (even while already in Expanded view)
   * re-expand all collapsed G1/G2/Subs sections.
   */
  expandAllSignal?: number;
  viewMode: ViewMode;
  contentType: ContentType;
  editingPlayerId: string | null;
  clipboardPlayer: SnapshotPlayer | null;
  highlightedPlayerId: string | null;
  highlightedSlot: string | null;
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
const gridClasses = 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-4xl stagger-children';

export function PlayerGrid({
  players,
  groupedPlayers,
  groupView,
  subsView,
  subsHidden,
  expandAllSignal,
  viewMode,
  contentType,
  editingPlayerId,
  clipboardPlayer,
  highlightedPlayerId,
  highlightedSlot,
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
    highlightedSlot,
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
    highlightedSlot,
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

  // ── Collapsible section state (G1 / G2 / Subs) ──
  // Persisted per static+tier so the layout sticks between visits.
  // (Show/hide of the whole substitutes section is controlled by the sticky
  //  roster toolbar via the `subsHidden` prop.)
  const collapseKey = `roster-collapse-${groupId}-${tierId}`;

  const [collapsed, setCollapsed] = useState<CollapsedState>(() => readCollapsedState(collapseKey));

  const toggleCollapse = useCallback((section: 'g1' | 'g2' | 'subs') => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // The following three blocks use React's "adjust state while rendering"
  // pattern (a conditional setState during render that React applies before
  // committing) to react to prop changes. Persistence is deliberately NOT done
  // here — render stays free of side effects; a single effect below mirrors the
  // resulting state into localStorage.

  // Re-read persisted fold state when the static/tier (and thus the storage key)
  // changes. The component stays mounted across tier switches, so without this
  // the previous tier's folds would linger until the user toggled a section.
  const [lastCollapseKey, setLastCollapseKey] = useState(collapseKey);
  if (collapseKey !== lastCollapseKey) {
    setLastCollapseKey(collapseKey);
    setCollapsed(readCollapsedState(collapseKey));
  }

  // Switching card density (Compact ⇄ Expanded) auto-expands any collapsed
  // sections so the toggle reveals everything rather than fighting the folds.
  const [lastViewMode, setLastViewMode] = useState(viewMode);
  if (viewMode !== lastViewMode) {
    setLastViewMode(viewMode);
    setCollapsed({});
  }

  // Clicking "Expanded" again while already in Expanded view bumps this signal
  // (viewMode doesn't change, so the reset above wouldn't fire). Treat it as a
  // toggle across the currently-rendered sections: if every section is already
  // expanded, collapse them all; otherwise expand everything. Saves users from
  // bouncing through Compact to un-collapse folds.
  const [lastExpandSignal, setLastExpandSignal] = useState(expandAllSignal);
  if (expandAllSignal !== lastExpandSignal) {
    setLastExpandSignal(expandAllSignal);
    const sections: Array<'g1' | 'g2' | 'subs'> = [];
    if (groupView && groupedPlayers) {
      if (groupedPlayers.group1.length > 0) sections.push('g1');
      if (groupedPlayers.group2.length > 0) sections.push('g2');
    }
    const hasSubsSection = subsView && !subsHidden && (
      groupView && groupedPlayers
        ? groupedPlayers.substitutes.length > 0
        : players.some((p) => p.isSubstitute)
    );
    if (hasSubsSection) sections.push('subs');
    const everyExpanded = sections.length > 0 && sections.every((s) => !collapsed[s]);
    const next: CollapsedState = {};
    if (everyExpanded) sections.forEach((s) => { next[s] = true; });
    setCollapsed(next);
  }

  // Persist fold state for the current key. This is the single localStorage
  // write path, kept in an effect so render stays pure. Storing `{}` is
  // equivalent to clearing the key (readCollapsedState treats both as no folds).
  useEffect(() => {
    writeCollapsedState(collapseKey, collapsed);
  }, [collapseKey, collapsed]);

  // Grouped View (G1/G2) - G1 on top, G2 below
  if (groupView && groupedPlayers) {
    return (
      <div className="space-y-3 mb-3">
        {/* Group 1 */}
        {groupedPlayers.group1.length > 0 && (
          <div>
            <LightPartyHeader
              groupNumber={1}
              players={groupedPlayers.group1}
              collapsed={collapsed.g1}
              onToggleCollapse={() => toggleCollapse('g1')}
            />
            {!collapsed.g1 && (
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
            )}
          </div>
        )}

        {/* Group 2 */}
        {groupedPlayers.group2.length > 0 && (
          <div>
            <LightPartyHeader
              groupNumber={2}
              players={groupedPlayers.group2}
              collapsed={collapsed.g2}
              onToggleCollapse={() => toggleCollapse('g2')}
            />
            {!collapsed.g2 && (
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
            )}
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

        {/* Substitutes - shown when subsView is enabled and not hidden */}
        {subsView && !subsHidden && groupedPlayers.substitutes.length > 0 && (
          <div className="opacity-75">
            <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
              <SectionCollapseButton
                collapsed={collapsed.subs}
                onToggle={() => toggleCollapse('subs')}
                label="Substitutes"
              />
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
            {!collapsed.subs && (
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
            )}
          </div>
        )}
      </div>
    );
  }

  // Standard View - with optional subs section
  // When subs have their own section (subsView) OR are hidden, exclude them from the main grid.
  const mainGridPlayers = (subsView || subsHidden)
    ? players.filter(p => !p.isSubstitute)
    : players;

  return (
    <div className="space-y-3 mb-3">
      <div className={gridClasses}>
        {mainGridPlayers.map((player) => (
          <PlayerCardRenderer
            key={player.id}
            player={player}
            playerSlotsWithLootEntries={playerSlotsWithLootEntries.get(player.id)}
            playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries?.get(player.id)}
            {...renderCardProps}
          />
        ))}
      </div>
      {/* Substitutes section - shown in standard view when subsView is enabled and not hidden */}
      {subsView && !subsHidden && players.some(p => p.isSubstitute) && (
        <div className="opacity-75">
          <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
            <SectionCollapseButton
              collapsed={collapsed.subs}
              onToggle={() => toggleCollapse('subs')}
              label="Substitutes"
            />
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
          {!collapsed.subs && (
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
          )}
        </div>
      )}
    </div>
  );
}

/** Small chevron button used to collapse/expand a roster section. */
function SectionCollapseButton({
  collapsed,
  onToggle,
  label,
}: {
  collapsed?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    /* eslint-disable-next-line design-system/no-raw-button */
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      className="flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-accent hover:bg-white/[0.04] transition-colors"
    >
      <ChevronDown
        size={14}
        className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
      />
    </button>
  );
}
