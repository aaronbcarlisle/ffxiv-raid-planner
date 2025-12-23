import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlayerCard } from './PlayerCard';
import type { Player, StaticSettings, ViewMode } from '../../types';

interface SortablePlayerCardProps {
  player: Player;
  settings: StaticSettings;
  viewMode: ViewMode;
  clipboardPlayer: Player | null;
  isDragEnabled: boolean;
  onUpdate: (updates: Partial<Player>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
}

export function SortablePlayerCard({
  player,
  isDragEnabled,
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
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isDragEnabled ? listeners : {})}
      className={isDragEnabled ? 'cursor-grab active:cursor-grabbing' : ''}
    >
      <PlayerCard player={player} {...props} />
    </div>
  );
}
