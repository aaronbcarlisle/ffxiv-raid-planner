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

interface DeepLinkHighlight {
  id: string;
  type: 'loot' | 'material';
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
  // there's nothing to desync. The effect below only owns the side effects:
  // the scroll-into-view and the 2.5s param-clearing timer.
  const highlight: DeepLinkHighlight | null = (() => {
    const entryParam = searchParams.get('entry');
    if (!entryParam) return null;
    const entryType: 'loot' | 'material' = searchParams.get('entryType') === 'material' ? 'material' : 'loot';
    const entryId = parseInt(entryParam, 10);
    const found =
      entryType === 'material'
        ? materialLog.some((e) => e.id === entryId)
        : lootLog.some((e) => e.id === entryId);
    return found ? { id: entryParam, type: entryType } : null;
  })();

  useEffect(() => {
    if (!highlight) return;

    const elementId =
      highlight.type === 'material' ? `material-entry-${highlight.id}` : `loot-entry-${highlight.id}`;
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
  }, [highlight?.id, highlight?.type, setSearchParams]);

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
            const isHighlighted = highlight?.type === item.kind && highlight.id === String(item.entry.id);
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
