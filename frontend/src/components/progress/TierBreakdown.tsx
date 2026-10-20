/**
 * TierBreakdown — the body of the tier cell's popover (S2a-3b·H3b, D-5, D-8, design §3.4): the
 * card's "{done}/{total} done", then the slots in each class ("Done", "Needs augment", "To go",
 * by `GEAR_SLOT_NAMES`, in gear order, a class omitted when empty) and **Open on board**. A card
 * with no BiS targets reads "No BiS set." and keeps the link, since the jump needs no BiS.
 * Read-only: no other control. `tierBisBreakdown` and `tierBisCell` are the selectors the cell
 * itself reads, so the popover cannot disagree with the number on the cell.
 *
 * Open on board takes focus as the content mounts (the `Popover` primitive suppresses Radix's
 * auto-focus, and the content is portalled, so Tab from the cell would not reach it); Escape
 * returns focus to the cell.
 */
import type { ReactNode } from 'react';
import { Button } from '../primitives/Button';
import { GEAR_SLOT_NAMES, type GearSlot, type SnapshotPlayer } from '../../types';
import { tierBisBreakdown, type TierBisCell } from '../../utils/tierBis';

const focusOnMount = (el: HTMLButtonElement | null) => el?.focus();

interface TierBreakdownProps {
  player: Pick<SnapshotPlayer, 'job' | 'gear'>;
  cell: TierBisCell;
  /** Absent when the page offers no jump: the link is then not drawn. */
  onOpenBoard?: () => void;
}

function Group({ label, slots }: { label: string; slots: GearSlot[] }): ReactNode {
  if (slots.length === 0) return null;
  return (
    <>
      <dt className="mt-1.5 text-xs font-medium text-text-secondary first:mt-0">{label}</dt>
      <dd className="text-sm text-text-primary">{slots.map((slot) => GEAR_SLOT_NAMES[slot]).join(', ')}</dd>
    </>
  );
}

export function TierBreakdown({ player, cell, onOpenBoard }: TierBreakdownProps) {
  const breakdown = tierBisBreakdown(player);
  return (
    <div className="flex max-w-72 min-w-48 flex-col gap-2 p-3">
      {cell.hasTargets ? (
        <>
          <p className="text-sm font-medium tabular-nums text-text-primary">{`${cell.done}/${cell.total} done`}</p>
          <dl>
            <Group label="Done" slots={breakdown.done} />
            <Group label="Needs augment" slots={breakdown.needsAugment} />
            <Group label="To go" slots={breakdown.toGo} />
          </dl>
        </>
      ) : (
        <p className="text-sm text-text-secondary">No BiS set.</p>
      )}
      {onOpenBoard !== undefined && (
        <Button ref={focusOnMount} type="button" variant="link" className="self-start" onClick={onOpenBoard}>
          Open on board
        </Button>
      )}
    </div>
  );
}
