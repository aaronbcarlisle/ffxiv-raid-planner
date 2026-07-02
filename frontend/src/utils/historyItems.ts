/**
 * historyItems — pure merge/sort/filter helpers behind the v2 Loot History
 * table (spec §5.6). Kept storeless/hookless so the semantics are testable
 * without a render.
 *
 * Source-filter semantics (deliberate, matches Task 6's badge mapping except
 * `book`): `raid` = loot with `method === 'drop'`; `tome` = loot with
 * `method === 'tome' || method === 'purchase'`; `book` = loot with
 * `method === 'book'` (badges as R — raid gear bought with books — but
 * filters separately); `material` = material log items.
 */
import type { HistoryItem } from '../components/loot/LootEntryRow';
import type { LootLogEntry, MaterialLogEntry } from '../types';

export type HistorySource = 'all' | 'raid' | 'tome' | 'book' | 'material';

export interface HistoryFilterState {
  week: number | 'all';
  playerId: string | 'all';
  source: HistorySource;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  week: 'all',
  playerId: 'all',
  source: 'all',
};

function weekOf(item: HistoryItem): number {
  return item.entry.weekNumber;
}

function createdAtOf(item: HistoryItem): number {
  return new Date(item.entry.createdAt).getTime();
}

/** Merge + sort: weeks desc, then createdAt desc within a week. */
export function buildHistoryItems(
  lootLog: LootLogEntry[],
  materialLog: MaterialLogEntry[],
): HistoryItem[] {
  const items: HistoryItem[] = [
    ...lootLog.map((entry): HistoryItem => ({ kind: 'loot', entry })),
    ...materialLog.map((entry): HistoryItem => ({ kind: 'material', entry })),
  ];

  return items.sort((a, b) => {
    const weekDiff = weekOf(b) - weekOf(a);
    if (weekDiff !== 0) return weekDiff;
    return createdAtOf(b) - createdAtOf(a);
  });
}

function matchesSource(item: HistoryItem, source: HistorySource): boolean {
  if (source === 'all') return true;
  if (source === 'material') return item.kind === 'material';
  if (item.kind !== 'loot') return false;
  const { method } = item.entry;
  if (source === 'raid') return method === 'drop';
  if (source === 'tome') return method === 'tome' || method === 'purchase';
  if (source === 'book') return method === 'book';
  return true;
}

export function filterHistoryItems(items: HistoryItem[], f: HistoryFilterState): HistoryItem[] {
  return items.filter((item) => {
    if (f.week !== 'all' && weekOf(item) !== f.week) return false;
    if (f.playerId !== 'all' && item.entry.recipientPlayerId !== f.playerId) return false;
    if (!matchesSource(item, f.source)) return false;
    return true;
  });
}

/** Distinct weeks present in the merged log, desc — feeds the week filter pill. */
export function historyWeeks(items: HistoryItem[]): number[] {
  return Array.from(new Set(items.map(weekOf))).sort((a, b) => b - a);
}
