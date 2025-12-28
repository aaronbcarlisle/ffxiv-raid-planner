import { useDroppable } from '@dnd-kit/core';

interface EdgeDropZoneProps {
  id: string;  // e.g., 'edge-start', 'edge-end', 'edge-start-g1', 'edge-end-g2'
  position: 'start' | 'end';
  isDragging: boolean;
}

/**
 * Drop zone for inserting cards at the start or end of a list.
 * Only visible during drag operations.
 */
export function EdgeDropZone({ id, position, isDragging }: EdgeDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  // Don't render if not dragging
  if (!isDragging) return null;

  return (
    <div
      ref={setNodeRef}
      data-droppable-id={id}
      className={`
        flex items-center justify-center
        min-h-[80px] rounded-lg border-2 border-dashed
        transition-all duration-150
        ${isOver
          ? 'border-accent bg-accent/10'
          : 'border-white/20 bg-white/5'
        }
      `}
    >
      {/* Visual indicator line */}
      {isOver && (
        <div className={`
          absolute ${position === 'start' ? 'left-0' : 'right-0'}
          top-2 bottom-2 w-1 bg-accent rounded-full shadow-lg shadow-accent/50
        `} />
      )}
    </div>
  );
}
