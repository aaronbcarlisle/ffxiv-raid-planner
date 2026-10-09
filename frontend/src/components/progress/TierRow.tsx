/**
 * TierRow — the first row of the Progress tab, always (R-S2-7): the tier's name,
 * "Week n" (omitted while the week is unknown) and an Open board link. S2a-3b
 * adds the player cells and the status column; until then it is the bare row,
 * with no empty cells and no stub text.
 */
import { LinkText } from '../ui/LinkText';

interface TierRowProps {
  tierName: string;
  /** The shared raid week, or null while it is unknown. */
  week: number | null;
  onOpenBoard: () => void;
}

export function TierRow({ tierName, week, onOpenBoard }: TierRowProps) {
  return (
    <div
      data-testid="progress-tier-row"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border-default bg-surface-card px-4 py-3"
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="truncate text-base font-medium text-text-primary">{tierName}</span>
        {week !== null && <span className="text-sm text-text-secondary">Week {week}</span>}
      </div>
      <LinkText onClick={onOpenBoard} className="text-sm">
        Open board
      </LinkText>
    </div>
  );
}
