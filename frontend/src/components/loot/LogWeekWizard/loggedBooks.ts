import type { PageLedgerEntry } from '../../../types';
import type { FloorNumber } from './types';

/**
 * Issue #326: the players whose books for a floor are already credited this
 * week, per floor. A player is credited when the page ledger holds an `earned`
 * entry for the tier, the week and the floor. `spent` / `missed` rows never
 * count. `tierIds` is every id the tier answers to (its slug and its snapshot
 * id): the ledger carries the snapshot id, the wizard is handed the slug.
 */
export function loggedBooksForWeek({
  floors,
  week,
  tierIds,
  pageLedger,
}: {
  floors: string[];
  week: number;
  tierIds: ReadonlySet<string>;
  pageLedger: PageLedgerEntry[];
}): Record<FloorNumber, ReadonlySet<string>> {
  const out = {} as Record<FloorNumber, Set<string>>;
  for (let i = 1; i <= 4; i++) out[i as FloorNumber] = new Set<string>();
  for (const entry of pageLedger) {
    if (entry.transactionType !== 'earned' || entry.weekNumber !== week) continue;
    if (!tierIds.has(entry.tierSnapshotId)) continue;
    const index = floors.indexOf(entry.floor);
    if (index < 0 || index > 3) continue;
    out[(index + 1) as FloorNumber].add(entry.playerId);
  }
  return out;
}
