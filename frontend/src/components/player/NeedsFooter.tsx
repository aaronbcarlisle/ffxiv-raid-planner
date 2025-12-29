import type { PlayerNeeds } from '../../types';

interface NeedsFooterProps {
  needs: PlayerNeeds;
}

export function NeedsFooter({ needs }: NeedsFooterProps) {
  return (
    <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-surface-raised/50 border-t border-border-default text-xs">
      <div className="text-center">
        <div className="text-source-raid font-bold">{needs.raidNeed}</div>
        <div className="text-text-muted">Raid</div>
      </div>
      <div className="text-center">
        <div className="text-source-tome font-bold">{needs.tomeNeed}</div>
        <div className="text-text-muted">Tome</div>
      </div>
      <div className="text-center">
        <div className="text-status-warning font-bold">{needs.upgrades}</div>
        <div className="text-text-muted">Aug</div>
      </div>
      <div className="text-center">
        <div className="text-text-primary font-bold">{needs.tomeWeeks}</div>
        <div className="text-text-muted">Wks</div>
      </div>
    </div>
  );
}
