/**
 * LootHistoryTable — the week-grouped transparent record (spec §5.6).
 * Merges + filters the loot/material logs, groups by week desc, and hosts
 * the deep-link highlight effect (legacy parity, `SectionedLogView.tsx:628-680`):
 * `?entry=&entryType=` scrolls to and pulses the matching row, then clears
 * itself after 2.5s.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LootEntryRow, type HistoryItem } from './LootEntryRow';
import { WeekGroupHeader } from './WeekGroupHeader';
import { buildHistoryItems, filterHistoryItems, type HistoryFilterState } from '../../utils/historyItems';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';
import type { WeekRange } from '../../hooks/useWeekClock';

export interface LootHistoryTableProps {
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  players: SnapshotPlayer[];
  floors: string[];
  filters: HistoryFilterState;
  currentWeek: number;
  /** pass clock.rangeOfWeek. */
  rangeOfWeek: (week: number) => WeekRange | null;
  canEdit: boolean;
  onEdit: (entry: LootLogEntry) => void;
  onCopyLink: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
}

function groupByWeek(items: HistoryItem[]): Array<{ week: number; items: HistoryItem[] }> {
  const order: number[] = [];
  const groups = new Map<number, HistoryItem[]>();
  for (const item of items) {
    const week = item.entry.weekNumber;
    const existing = groups.get(week);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(week, [item]);
      order.push(week);
    }
  }
  return order.map((week) => ({ week, items: groups.get(week)! }));
}

export function LootHistoryTable({
  lootLog,
  materialLog,
  players,
  floors,
  filters,
  currentWeek,
  rangeOfWeek,
  canEdit,
  onEdit,
  onCopyLink,
  onDelete,
}: LootHistoryTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derived (not stored) — the highlight tracks the URL param directly, so
  // there's nothing to desync. Two primitives (not an object) so the effect's
  // dep array can name them directly — an object identity would either
  // re-fire every render (new object each time) or need a memo keyed on the
  // stores, which would re-fire the scroll on unrelated store refetches.
  // `null` when the param is absent OR the id isn't found in the *unfiltered*
  // logs (matches the brief).
  const entryParam = searchParams.get('entry');
  const entryType: 'loot' | 'material' = searchParams.get('entryType') === 'material' ? 'material' : 'loot';
  const parsedEntryId = entryParam ? parseInt(entryParam, 10) : null;
  const entryFound =
    parsedEntryId != null &&
    !Number.isNaN(parsedEntryId) &&
    (entryType === 'material'
      ? materialLog.some((e) => e.id === parsedEntryId)
      : lootLog.some((e) => e.id === parsedEntryId));
  const highlightId: number | null = entryFound ? parsedEntryId : null;
  const highlightType: 'loot' | 'material' | null = entryFound ? entryType : null;

  useEffect(() => {
    if (highlightId == null || highlightType == null) return;

    const elementId =
      highlightType === 'material' ? `material-entry-${highlightId}` : `loot-entry-${highlightId}`;
    setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    const clearTimer = setTimeout(() => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('entry');
        params.delete('entryType');
        return params;
      }, { replace: true });
    }, 2500);

    return () => clearTimeout(clearTimer);
  }, [highlightId, highlightType, setSearchParams]);

  const playersById = new Map(players.map((p) => [p.id, p]));
  const allItems = buildHistoryItems(lootLog, materialLog);
  const filtered = filterHistoryItems(allItems, filters);
  const groups = groupByWeek(filtered);

  if (groups.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-text-tertiary">
        No entries match — log a drop from the Priority view.
      </p>
    );
  }

  return (
    <div className="grid gap-3.5">
      {groups.map(({ week, items }) => (
        <div key={week} className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <WeekGroupHeader
            week={week}
            isCurrent={week === currentWeek}
            range={rangeOfWeek(week)}
            count={items.length}
          />
          {items.map((item) => {
            const isHighlighted = highlightType === item.kind && highlightId === item.entry.id;
            return (
              <LootEntryRow
                key={`${item.kind}-${item.entry.id}`}
                item={item}
                playersById={playersById}
                floors={floors}
                canEdit={canEdit}
                highlighted={isHighlighted}
                onEdit={onEdit}
                onCopyLink={onCopyLink}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
