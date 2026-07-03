import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

/** Drag-handle prop types shared by the v2 roster cards (moved verbatim from
 * the deleted legacy DroppablePlayerCard.tsx). */
export type DragListeners = SyntheticListenerMap | undefined;
export type DragAttributes = DraggableAttributes;
