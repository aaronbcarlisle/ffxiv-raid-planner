import type { CollisionDetection, DroppableContainer } from '@dnd-kit/core';
import { pointerWithin, rectIntersection } from '@dnd-kit/core';

export type DropMode = 'swap' | 'insert-before' | 'insert-after';

export interface EnhancedCollision {
  id: string;
  dropMode: DropMode;
}

/**
 * Calculate the drop mode based on pointer position within a droppable element.
 * - Left 20% = insert-before
 * - Right 20% = insert-after
 * - Center 60% = swap
 */
export function calculateDropMode(
  pointerX: number,
  rect: DOMRect,
  edgeThreshold: number = 0.2
): DropMode {
  const relativeX = pointerX - rect.left;
  const percentage = relativeX / rect.width;

  if (percentage < edgeThreshold) return 'insert-before';
  if (percentage > 1 - edgeThreshold) return 'insert-after';
  return 'swap';
}

/**
 * Custom collision detection that uses pointerWithin for accuracy,
 * then falls back to rect intersection.
 */
export function createSwapInsertCollision(): CollisionDetection {
  return (args) => {
    // Use pointerWithin as the primary collision detection
    const pointerCollisions = pointerWithin(args);

    // If no pointer collision, fall back to rect intersection
    if (pointerCollisions.length === 0) {
      return rectIntersection(args);
    }

    return pointerCollisions;
  };
}

/**
 * Get the drop mode for a specific droppable given the current pointer position.
 * This is called separately from collision detection to determine swap vs insert.
 */
export function getDropModeForDroppable(
  droppableId: string,
  droppableContainers: Map<string, DroppableContainer>,
  pointerX: number,
  edgeThreshold: number = 0.2
): DropMode | null {
  const container = droppableContainers.get(droppableId);
  if (!container?.node?.current) return null;

  const rect = container.node.current.getBoundingClientRect();
  return calculateDropMode(pointerX, rect, edgeThreshold);
}
