/**
 * dragStore — transient roster drag-and-drop visual state (which card is being
 * dragged, which card is the drop target, and the drop mode under the cursor).
 *
 * This lives in a store so each player card can subscribe with a *selector* and
 * re-render only when ITS own drag/over state changes. Previously this state was
 * a single `dragState` object threaded as a prop to all 8 cards, so every
 * over-transition (which fires on each card the cursor crosses) re-rendered the
 * whole grid — ~120ms per crossing. With per-card selectors only the 1-2 cards
 * whose state actually changed re-render; the grid/DndContext don't re-render at
 * all during a drag.
 */
import { create } from 'zustand';
import type { DropMode } from '../components/dnd/collisionDetection';

interface DragStoreState {
  activeId: string | null;
  overId: string | null;
  dropMode: DropMode | null;
  startDrag: (activeId: string) => void;
  setOver: (overId: string | null, dropMode: DropMode | null) => void;
  setDropMode: (dropMode: DropMode | null) => void;
  endDrag: () => void;
}

export const useDragStore = create<DragStoreState>((set) => ({
  activeId: null,
  overId: null,
  dropMode: null,
  startDrag: (activeId) => set({ activeId, overId: null, dropMode: null }),
  setOver: (overId, dropMode) => set({ overId, dropMode }),
  setDropMode: (dropMode) => set({ dropMode }),
  endDrag: () => set({ activeId: null, overId: null, dropMode: null }),
}));
