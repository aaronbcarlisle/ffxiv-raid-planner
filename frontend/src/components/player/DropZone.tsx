import { useDroppable } from '@dnd-kit/core';

interface DropZoneProps {
  id: string;  // e.g., "drop-start", "drop-end", "drop-start-g1"
  isActive: boolean;  // True when this zone is being hovered during drag
}

export function DropZone({ id, isActive }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  // Only show when dragging is active and hovering over this zone
  const showIndicator = isActive && isOver;

  return (
    <div
      ref={setNodeRef}
      data-drop-zone={id}
      className={`
        relative h-full min-h-[100px]
        ${showIndicator ? 'bg-accent/10 rounded-lg' : ''}
        transition-colors duration-150
      `}
    >
      {/* Vertical line indicator */}
      {showIndicator && (
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-accent rounded-full shadow-lg shadow-accent/50" />
      )}
    </div>
  );
}
