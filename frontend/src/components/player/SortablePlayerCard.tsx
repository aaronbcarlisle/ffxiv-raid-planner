import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlayerCard } from './PlayerCard';
import type { SnapshotPlayer, StaticSettings, ViewMode } from '../../types';

interface SortablePlayerCardProps {
  player: SnapshotPlayer;
  settings: StaticSettings;
  viewMode: ViewMode;
  clipboardPlayer: SnapshotPlayer | null;
  isDragEnabled: boolean;
  isDropTarget?: boolean;
  insertBefore?: boolean;  // Show vertical line on left (insert before this card)
  insertAfter?: boolean;   // Show vertical line on right (insert after this card)
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onResetGear?: () => void;
}

export function SortablePlayerCard({
  player,
  isDragEnabled,
  isDropTarget = false,
  insertBefore = false,
  insertAfter = false,
  ...props
}: SortablePlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: player.id,
    disabled: !isDragEnabled,
  });

  // Only apply transform to the dragged item - other cards stay in place
  // This prevents the confusing "shifting" preview and matches swap behavior
  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? transition : undefined,
    opacity: isDragging ? 0.3 : 1,
  };

  // Determine if we're in insert mode (shows line) vs swap mode (shows ring)
  const isInsertMode = insertBefore || insertAfter;
  const showSwapHighlight = isDropTarget && !isInsertMode;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-player-id={player.id}
      {...attributes}
      {...(isDragEnabled ? listeners : {})}
      className={`
        relative
        ${isDragEnabled ? 'cursor-grab active:cursor-grabbing' : ''}
        ${showSwapHighlight ? 'ring-2 ring-accent shadow-lg shadow-accent/20 rounded-lg' : ''}
        transition-shadow duration-150
      `}
    >
      {/* Insert indicator - vertical line on left */}
      {insertBefore && (
        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}

      <PlayerCard player={player} {...props} />

      {/* Insert indicator - vertical line on right */}
      {insertAfter && (
        <div className="absolute -right-2 top-0 bottom-0 w-1 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}
    </div>
  );
}
