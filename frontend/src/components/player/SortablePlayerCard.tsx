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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isDragEnabled ? listeners : {})}
      className={`
        ${isDragEnabled ? 'cursor-grab active:cursor-grabbing' : ''}
        ${isDropTarget ? 'ring-2 ring-accent shadow-lg shadow-accent/20 rounded-lg' : ''}
        transition-shadow duration-150
      `}
    >
      <PlayerCard player={player} {...props} />
    </div>
  );
}
