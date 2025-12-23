import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlayerCard } from './PlayerCard';
import type { Player, StaticSettings, ViewMode } from '../../types';

interface SortablePlayerCardProps {
  player: Player;
  settings: StaticSettings;
  viewMode: ViewMode;
  clipboardPlayer: Player | null;
  initialExpanded?: boolean;
  isDragEnabled: boolean;
  onUpdate: (updates: Partial<Player>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: (expanded: boolean) => void;
  onMounted?: () => void;
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
    <div ref={setNodeRef} style={style} {...attributes} className="relative group/drag">
      {/* Drag handle - only shown on hover when drag is enabled */}
      {isDragEnabled && (
        <div
          {...listeners}
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-50 cursor-grab active:cursor-grabbing px-3 py-1 rounded-t-md bg-bg-secondary border border-b-0 border-border-default opacity-0 group-hover/drag:opacity-100 transition-opacity text-text-muted hover:text-accent"
          title="Drag to reorder"
        >
          <svg
            className="w-4 h-2"
            fill="currentColor"
            viewBox="0 0 16 8"
          >
            <circle cx="2" cy="4" r="1.5" />
            <circle cx="8" cy="4" r="1.5" />
            <circle cx="14" cy="4" r="1.5" />
          </svg>
        </div>
      )}
      <PlayerCard player={player} {...props} />
    </div>
  );
}
