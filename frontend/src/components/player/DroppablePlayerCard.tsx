import { memo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { PlayerCard } from './PlayerCard';
import { useDragStore } from '../../stores/dragStore';
import type { SnapshotPlayer, StaticSettings, ViewMode, ContentType, ResetMode, GearSlot, AssignPlayerRequest } from '../../types';
import type { MemberRole } from '../../utils/permissions';

// Export types for drag handle
export type DragListeners = SyntheticListenerMap | undefined;
export type DragAttributes = DraggableAttributes;

interface DroppablePlayerCardProps {
  player: SnapshotPlayer;
  /** All players in the tier (for assignment modal) */
  allPlayers?: SnapshotPlayer[];
  settings: StaticSettings;
  viewMode: ViewMode;
  contentType: ContentType;
  clipboardPlayer: SnapshotPlayer | null;
  canEdit: boolean;
  currentUserId?: string;
  isGroupOwner?: boolean;
  userRole?: MemberRole | null;
  userHasClaimedPlayer?: boolean;
  isAdmin?: boolean;
  isAdminAccess?: boolean;
  viewAsUserId?: string;
  /** Hide "Unclaimed" banners (group setting) */
  hideSetupBanners?: boolean;
  /** Hide "No BiS configured" banners (group setting) */
  hideBisBanners?: boolean;
  groupId: string;
  tierId: string;
  isHighlighted?: boolean;
  highlightedSlot?: string | null;
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onResetGear?: (mode: ResetMode) => void;
  onClaimPlayer?: () => void;
  onReleasePlayer?: () => void;
  onAdminAssignPlayer?: (data: AssignPlayerRequest) => Promise<void>;
  onOwnerAssignPlayer?: (data: AssignPlayerRequest) => Promise<void>;
  onModalOpen?: () => void;
  onModalClose?: () => void;
  onCopyUrl?: () => void;
  /** Slots that have loot entries (for "Go to Loot Entry" feature) */
  slotsWithLootEntries?: Set<GearSlot>;
  /** Slots that have material entries (for "Go to Material Entry" feature) */
  slotsWithMaterialEntries?: Set<GearSlot | 'tome_weapon'>;
  /** Navigate to loot entry for a slot */
  onNavigateToLootEntry?: (slot: GearSlot) => void;
  /** Navigate to material entry for a slot */
  onNavigateToMaterialEntry?: (slot: string) => void;
  /** Navigate to Books panel and highlight this player's row */
  onNavigateToBooksPanel?: (playerId: string) => void;
}

function DroppablePlayerCardImpl({
  player,
  canEdit,
  contentType,
  ...props
}: DroppablePlayerCardProps) {
  // Subscribe to just this card's slice of the drag state, so only the dragged
  // card and the current drop target re-render during a drag — not the grid.
  const isBeingDragged = useDragStore((s) => s.activeId === player.id);
  const dropTargetMode = useDragStore((s) =>
    s.overId === player.id && s.activeId !== player.id ? s.dropMode : null,
  );
  // Make this card a drop target
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: player.id,
    disabled: !canEdit,
  });

  // Make this card draggable
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
  } = useDraggable({
    id: player.id,
    disabled: !canEdit,
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setDraggableRef(node);
  };

  // Visual feedback classes (derived from this card's drag-store slice)
  const showSwapHighlight = dropTargetMode === 'swap';
  const showInsertBefore = dropTargetMode === 'insert-before';
  const showInsertAfter = dropTargetMode === 'insert-after';

  return (
    <div
      ref={setNodeRef}
      data-droppable-id={player.id}
      style={{
        opacity: isBeingDragged ? 0.3 : 1,
      }}
      className={`
        relative card-glow rounded-lg
        ${showSwapHighlight ? 'ring-2 ring-accent shadow-lg shadow-accent/20' : ''}
        transition-all duration-150
      `}
    >
      {/* Insert indicator - vertical line on left */}
      {showInsertBefore && (
        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}

      <PlayerCard
        player={player}
        contentType={contentType}
        dragListeners={canEdit ? listeners : undefined}
        dragAttributes={canEdit ? attributes : undefined}
        {...props}
      />

      {/* Insert indicator - vertical line on right */}
      {showInsertAfter && (
        <div className="absolute -right-2 top-0 bottom-0 w-1 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}
    </div>
  );
}

// Memoized so it bails when the grid re-renders for reasons unrelated to this
// card. It still updates during a drag (it reads the dragState prop and the
// @dnd-kit context), but unrelated grid re-renders no longer drag the whole
// PlayerCard subtree along.
export const DroppablePlayerCard = memo(DroppablePlayerCardImpl);
