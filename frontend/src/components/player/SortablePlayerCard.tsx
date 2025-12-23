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
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      {/* Drag handle - only shown when drag is enabled */}
      {isDragEnabled && (
        <div
          {...listeners}
          className="absolute top-3 left-3 z-20 cursor-grab active:cursor-grabbing p-1.5 rounded bg-bg-secondary/80 hover:bg-bg-hover text-text-muted hover:text-text-primary border border-border-default/50"
          title="Drag to reorder"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
      )}
      <PlayerCard player={player} {...props} />
    </div>
  );
}
