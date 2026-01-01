import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { PlayerCard } from './PlayerCard';
import type { DragState } from '../dnd/useDragAndDrop';
import type { SnapshotPlayer, StaticSettings, ViewMode, ContentType, ResetMode } from '../../types';
import type { MemberRole } from '../../utils/permissions';

// Export types for drag handle
export type DragListeners = SyntheticListenerMap | undefined;
export type DragAttributes = DraggableAttributes;

interface DroppablePlayerCardProps {
  player: SnapshotPlayer;
  settings: StaticSettings;
  viewMode: ViewMode;
  contentType: ContentType;
  clipboardPlayer: SnapshotPlayer | null;
  dragState: DragState;
  canEdit: boolean;
  currentUserId?: string;
  isGroupOwner?: boolean;
  userRole?: MemberRole | null;
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onResetGear?: (mode: ResetMode) => void;
  onClaimPlayer?: () => void;
  onReleasePlayer?: () => void;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}

export function DroppablePlayerCard({
  player,
  dragState,
  canEdit,
  contentType,
  ...props
}: DroppablePlayerCardProps) {
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

  // Determine visual state
  const isBeingDragged = dragState.activeId === player.id;
  const isDropTarget = dragState.overId === player.id && !isBeingDragged;
  const dropMode = isDropTarget ? dragState.dropMode : null;

  // Visual feedback classes
  const showSwapHighlight = isDropTarget && dropMode === 'swap';
  const showInsertBefore = isDropTarget && dropMode === 'insert-before';
  const showInsertAfter = isDropTarget && dropMode === 'insert-after';

  return (
    <div
      ref={setNodeRef}
      data-droppable-id={player.id}
      style={{
        opacity: isBeingDragged ? 0.3 : 1,
      }}
      className={`
        relative
        ${showSwapHighlight ? 'ring-2 ring-accent shadow-lg shadow-accent/20 rounded-lg' : ''}
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
