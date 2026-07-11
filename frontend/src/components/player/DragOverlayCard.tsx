import { PlayerCard } from './PlayerCard';
import type { SnapshotPlayer, StaticSettings, ViewMode, ContentType } from '../../types';

interface DragOverlayCardProps {
  player: SnapshotPlayer;
  settings: StaticSettings;
  viewMode: ViewMode;
  contentType: ContentType;
  groupId: string;
  tierId: string;
}

/**
 * Lightweight version of PlayerCard for the drag overlay (ghost card).
 * All handlers are no-ops since this is just a visual representation.
 */
export function DragOverlayCard({ player, settings, viewMode, contentType, groupId, tierId }: DragOverlayCardProps) {
  return (
    <div className="opacity-90 shadow-2xl pointer-events-none">
      <PlayerCard
        player={player}
        settings={settings}
        viewMode={viewMode}
        contentType={contentType}
        clipboardPlayer={null}
        groupId={groupId}
        tierId={tierId}
        onUpdate={() => {}}
        onRemove={() => {}}
        onCopy={() => {}}
        onPaste={() => {}}
        onDuplicate={() => {}}
      />
    </div>
  );
}
