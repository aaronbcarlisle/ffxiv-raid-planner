/**
 * historyItems — pure merge/sort/filter helpers behind the v2 Loot History
 * table (spec §5.6). Kept storeless/hookless so the semantics are testable
 * without a render.
 *
 * Source-filter semantics (deliberate): `raid` = loot with
 * `method === 'drop'`; `tome` = loot with `method === 'tome' || method ===
 * 'purchase'`; `book` = loot with `method === 'book'`, filtered separately
 * from raid even though books buy raid gear; `material` = material log
 * items.
 */
import type { HistoryItem } from '../components/loot/logWeekGridData';
import { METHOD_INFO } from '../components/history/lootMethodDisplay';
import { GEAR_SLOT_NAMES, type LootLogEntry, type MaterialLogEntry } from '../types';
import { UPGRADE_MATERIAL_DISPLAY_NAMES } from '../gamedata/loot-tables';

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

/** Merge only — ordering is `sortHistoryItems`'s job. */
export function buildHistoryItems(
  lootLog: LootLogEntry[],
  materialLog: MaterialLogEntry[],
): HistoryItem[] {
  return [
    ...lootLog.map((entry): HistoryItem => ({ kind: 'loot', entry })),
    ...materialLog.map((entry): HistoryItem => ({ kind: 'material', entry })),
  ];
}

export type HistorySortField = 'week' | 'floor' | 'slot' | 'player' | 'method' | 'date' | 'type';
export type HistorySortDirection = 'asc' | 'desc'; // = ui/SortableHeader's SortDirection

export interface HistorySortState {
  field: HistorySortField;
  direction: HistorySortDirection;
}

export const HISTORY_SORT_FIELDS: readonly HistorySortField[] = [
  'week',
  'floor',
  'slot',
  'player',
  'method',
  'date',
  'type',
];

export const DEFAULT_HISTORY_SORT: HistorySortState = { field: 'week', direction: 'desc' };

const NATURAL_DIRECTION: Record<HistorySortField, HistorySortDirection> = {
  week: 'desc',
  date: 'desc',
  floor: 'asc',
  slot: 'asc',
  player: 'asc',
  method: 'asc',
  type: 'asc',
};

/** R-D9a-C: same field flips; a new field starts on its natural direction. */
export function nextHistorySort(field: HistorySortField, current: HistorySortState): HistorySortState {
  if (current.field === field) {
    return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: NATURAL_DIRECTION[field] };
}

export interface HistorySortContext {
  floors: string[];
  /** recipient display name; the caller resolves roster name ?? recipientPlayerName. */
  playerNameOf: (item: HistoryItem) => string;
}

type MethodInfoLike = (typeof METHOD_INFO)[string] | undefined; // D9a-s: the frozen file doesn't export MethodInfo

/** The Method cell's text AND the method sort key — one author (D9a-s). */
export function methodLabelOf(item: HistoryItem): string {
  const info = METHOD_INFO[item.entry.method] as MethodInfoLike;
  return info?.label ?? item.entry.method;
}

/** The Slot cell's text AND the slot sort key — one author (D9a-g). */
export function slotNameOf(item: HistoryItem): string {
  if (item.kind === 'material') {
    return UPGRADE_MATERIAL_DISPLAY_NAMES[item.entry.materialType] ?? item.entry.materialType;
  }
  const { itemSlot } = item.entry;
  return (
    GEAR_SLOT_NAMES[itemSlot as keyof typeof GEAR_SLOT_NAMES] ?? (itemSlot === 'ring' ? 'Ring' : itemSlot)
  );
}

type Key = number | string;

const KEY: Record<HistorySortField, (item: HistoryItem, ctx: HistorySortContext) => Key> = {
  week: (i) => i.entry.weekNumber,
  floor: (i, c) => {
    const n = c.floors.indexOf(i.entry.floor);
    return n < 0 ? Number.MAX_SAFE_INTEGER : n;
  },
  slot: (i) => slotNameOf(i),
  player: (i, c) => c.playerNameOf(i),
  method: (i) => methodLabelOf(i),
  date: (i) => createdAtOf(i),
  type: (i) => (i.kind === 'material' ? 2 : i.entry.isExtra ? 1 : 0),
};

function compareKeys(a: Key, b: Key): number {
  return typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : (a as number) - (b as number);
}

/** R-D9a-B — never direction-aware. */
function tiebreak(a: HistoryItem, b: HistoryItem): number {
  return (
    createdAtOf(b) - createdAtOf(a) ||
    (a.kind === b.kind ? 0 : a.kind === 'loot' ? -1 : 1) ||
    b.entry.id - a.entry.id
  );
}

/** Pure; returns a NEW array. Primary per `sort`; ties createdAt desc → kind → id desc (R-D9a-B). */
export function sortHistoryItems(
  items: HistoryItem[],
  sort: HistorySortState,
  ctx: HistorySortContext,
): HistoryItem[] {
  const key = KEY[sort.field];
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => sign * compareKeys(key(a, ctx), key(b, ctx)) || tiebreak(a, b));
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
