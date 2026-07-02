/**
 * RosterDragOverlay — the dnd-kit drag ghost for the roster. It subscribes to
 * just `activeId` from the drag store, so it re-renders only on drag start/end
 * (never on over-transitions). Kept as its own component so the surrounding
 * memoized grid element doesn't have to re-render to update the overlay.
 */
import { DragOverlay } from '@dnd-kit/core';
import { DragOverlayCard } from './DragOverlayCard';
import { useDragStore } from '../../stores/dragStore';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, ViewMode, ContentType } from '../../types';

interface RosterDragOverlayProps {
  players: SnapshotPlayer[];
  viewMode: ViewMode;
  contentType: ContentType;
  groupId: string;
  tierId: string;
}

export function RosterDragOverlay({ players, viewMode, contentType, groupId, tierId }: RosterDragOverlayProps) {
  const activeId = useDragStore((s) => s.activeId);
  const dragged = activeId ? players.find((p) => p.id === activeId) : null;

  return (
    <DragOverlay dropAnimation={null}>
      {dragged && dragged.configured && (
        <DragOverlayCard
          player={dragged}
          settings={DEFAULT_SETTINGS}
          viewMode={viewMode}
          contentType={contentType}
          groupId={groupId}
          tierId={tierId}
        />
      )}
    </DragOverlay>
  );
}
