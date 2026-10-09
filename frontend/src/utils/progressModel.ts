/**
 * progressModel — the Progress matrix's one model (S2a-2·F2 Task TF4; R-S2-6,
 * R-S2-7, R-S2-8, Q3). It decides the columns, each cell, the farm-row order, the
 * "n of m have it" tally and the cell text, so the matrix render (F3) and S2a-4's
 * TrackCard read the same answers. Pure: callers pass the store's data and the
 * reader in; nothing here reads a store or React. `utils/` is not ring-typed, so
 * Ring 0's TrackCard may import it (R-S2-5, vet I-5).
 */
import type {
  CollectionGoal,
  ParticipantRecordView,
  ParticipantState,
  ParticipantStateEntry,
  RecordOnlyCell,
} from '../stores/collectionGoalStore';
import type { MemberRole, SnapshotPlayer, SortPreset } from '../types';
import { boardSections, sortPlayersByRole } from './calculations';
import { DEFAULT_SETTINGS, SORT_PRESETS } from './constants';

// ── Inputs ──────────────────────────────────────────────────────────────────

/** The store's goals and cells, as `useCollectionGoalStore` holds them (keyed by goal id). */
export interface ProgressData {
  goals: readonly CollectionGoal[];
  participants: Readonly<Record<string, readonly ParticipantStateEntry[] | undefined>>;
  recordOnly: Readonly<Record<string, readonly RecordOnlyCell[] | undefined>>;
}

/** Who is looking: the effective user and role (View As aware, as NewShell passes them). */
export interface ProgressReader {
  currentUserId: string | null;
  userRole: MemberRole | null | undefined;
}

/** One goal's cells. */
export interface GoalCells {
  participants?: readonly ParticipantStateEntry[];
  recordOnly?: readonly RecordOnlyCell[];
}

// ── Columns (R-S2-6) ────────────────────────────────────────────────────────

/**
 * A matrix column. `claimed`: a configured player with a user. `unclaimed`: a
 * configured player with none (dim, "Claim to track", no cells). `notOnRoster`: a
 * member with a farm row and no column in this tier (trailing). Its `reason` is
 * `unconfigured` when the member holds a claimed card in this tier that is not set
 * up yet ("Card not set up"), else `notOnRoster` ("Not on the roster").
 */
export type ProgressColumn =
  | { kind: 'claimed'; key: string; name: string; userId: string; player: SnapshotPlayer }
  | { kind: 'unclaimed'; key: string; name: string; userId: null; player: SnapshotPlayer }
  | {
      kind: 'notOnRoster';
      key: string;
      name: string;
      userId: string;
      player: null;
      reason: 'unconfigured' | 'notOnRoster';
    };

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The matrix's columns: the roster in Board order (`boardSections` over the
 * preset's sort, flattened: Light Party 1 · 2 · Unassigned · Substitutes, vet M-6),
 * then one "Not on the roster" column per member who holds a row on one of
 * `data.goals` but has no column, by display name. A row whose `memberRole` is
 * null (a former member) or `viewer` adds none, and record-only cells never do.
 * Pass the ACTIVE goals only, so expanding Finished never adds or shifts a column
 * (TF5 ruling 2): `participants` is keyed across statics, and a finished-goal row
 * whose member has no column is simply not shown. A member whose claimed card in
 * these `players` is not configured trails with reason `unconfigured`.
 */
export function buildColumns(
  players: readonly SnapshotPlayer[],
  sortPreset: SortPreset,
  data: ProgressData,
): ProgressColumn[] {
  const order = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
  const sorted = sortPlayersByRole([...players], order, sortPreset);
  const columns: ProgressColumn[] = boardSections(sorted)
    .flatMap((section) => section.players)
    .map((player): ProgressColumn =>
      player.userId
        ? { kind: 'claimed', key: player.id, name: player.name, userId: player.userId, player }
        : { kind: 'unclaimed', key: player.id, name: player.name, userId: null, player },
    );

  const placed = new Set(columns.flatMap((c) => (c.userId ? [c.userId] : [])));
  const unconfigured = new Set(players.flatMap((p) => (!p.configured && p.userId ? [p.userId] : [])));
  const offRoster = new Map<string, string | null>();
  for (const goal of data.goals) {
    for (const row of data.participants[goal.id] ?? []) {
      if (placed.has(row.userId) || row.memberRole == null || row.memberRole === 'viewer') continue;
      // The first row's name, unless a later row has one where it had none.
      if (offRoster.get(row.userId) == null) offRoster.set(row.userId, row.displayName);
    }
  }
  const trailing = [...offRoster]
    .map(([userId, displayName]) => ({ userId, name: displayName ?? 'Unknown' }))
    .sort((a, b) => byText(a.name, b.name) || byId(a.userId, b.userId))
    .map(({ userId, name }): ProgressColumn => ({
      kind: 'notOnRoster',
      key: `user:${userId}`,
      name,
      userId,
      player: null,
      reason: unconfigured.has(userId) ? 'unconfigured' : 'notOnRoster',
    }));

  return [...columns, ...trailing];
}

// ── Cells (R-S2-8) ──────────────────────────────────────────────────────────

/** One cell of the matrix: what the render, the tally, the order and the pickers read. */
export interface ProgressCell {
  column: ProgressColumn;
  /** The cell's state; null is blank, and an unclaimed column's cell is always blank. */
  state: ParticipantState | null;
  /**
   * The count this reader may see, on any state (the text shows it on Need and
   * Want only). Null when there is none yet or it is withheld (`countHidden`).
   */
  count: number | null;
  /**
   * A count is withheld from this reader: the server's `countHidden` (a member's
   * privacy flag, or the caller's own gate), or a viewer reading someone else's
   * cell. Never inferred from `tokenCount === null`, which also means "no count
   * yet" (vet I-1).
   */
  countHidden: boolean;
  /** The column is the reader's own (R-S2-10). */
  own: boolean;
  /** The member's merged row for the goal, if any. */
  entry: ParticipantStateEntry | null;
  /** The member's record-only cell (Q1), used only when there is no row. */
  recordOnly: RecordOnlyCell | null;
  /** The character record behind the cell: the row's merged record, else the record-only cell's. */
  record: ParticipantRecordView | null;
}

/**
 * The cell at one column of one goal: the row's merged entry; else a record-only
 * cell (Have, or blank when its state is null); else blank. Others' counts are
 * withheld from a viewer, as the server withholds them; the server already gates
 * every read for the real caller, so this matters under View As, where reads stay
 * gated as the admin (R-S2-10). One's own count is never withheld by role.
 */
export function cellFor(column: ProgressColumn, cells: GoalCells, reader: ProgressReader): ProgressCell {
  const userId = column.userId;
  if (userId === null) {
    return { column, state: null, count: null, countHidden: false, own: false, entry: null, recordOnly: null, record: null };
  }
  const own = userId === reader.currentUserId;
  const entry = cells.participants?.find((p) => p.userId === userId) ?? null;
  const recordOnly = entry ? null : (cells.recordOnly?.find((c) => c.userId === userId) ?? null);

  const state = entry ? entry.state : (recordOnly?.state ?? null);
  const serverHidden = entry ? entry.countHidden === true : recordOnly?.countHidden === true;
  // A blank cell has nothing to withhold (TF5 ruling 5).
  const countHidden = state !== null && (serverHidden || (!own && reader.userRole === 'viewer'));
  const count = entry ? entry.tokenCount : (recordOnly?.tokenCount ?? null);

  return {
    column,
    state,
    count: countHidden ? null : count,
    countHidden,
    own,
    entry,
    recordOnly,
    record: entry ? (entry.record ?? null) : (recordOnly?.record ?? null),
  };
}

// ── Tally (R-S2-7's status column; vet M12) ─────────────────────────────────

/** "{n} of {m} have it": m = claimed columns not on Pass, n = those on Have. */
export interface HaveTally {
  n: number;
  m: number;
  /** n = m > 0: leads read "Everyone has it". */
  everyone: boolean;
}

/** Tallies one row. Unclaimed and Not-on-the-roster cells count in neither n nor m. */
export function haveTally(cells: readonly ProgressCell[]): HaveTally {
  let n = 0;
  let m = 0;
  for (const cell of cells) {
    if (cell.column.kind !== 'claimed' || cell.state === 'pass') continue;
    m += 1;
    if (cell.state === 'have') n += 1;
  }
  return { n, m, everyone: m > 0 && n === m };
}

// ── Rows (R-S2-7, Q3) ───────────────────────────────────────────────────────

/** One farm row: a goal with one cell per column. */
export interface FarmRow {
  goal: CollectionGoal;
  /** One cell per column, in column order. */
  cells: ProgressCell[];
  /** Claimed columns whose cell is Need (the order's first key). */
  need: number;
  /** Claimed columns whose cell is Want (the order's second key). */
  want: number;
  tally: HaveTally;
}

/**
 * The active farm order (Q3, owner 2026-10-08): more Need first, then more Want,
 * then title (base sensitivity), then id so the order is total. TrackCard reuses
 * it, so the card and the first farm row always agree (S2-12).
 */
export function compareFarmRows(
  a: Pick<FarmRow, 'goal' | 'need' | 'want'>,
  b: Pick<FarmRow, 'goal' | 'need' | 'want'>,
): number {
  return b.need - a.need || b.want - a.want || byText(a.goal.title, b.goal.title) || byId(a.goal.id, b.goal.id);
}

function completedTime(goal: CollectionGoal): number {
  const time = goal.completedAt ? Date.parse(goal.completedAt) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Finished order: most recently completed first; an undated one last; then title, then id. */
function compareFinishedRows(a: FarmRow, b: FarmRow): number {
  const ta = completedTime(a.goal);
  const tb = completedTime(b.goal);
  if (ta !== tb) return tb > ta ? 1 : -1;
  return byText(a.goal.title, b.goal.title) || byId(a.goal.id, b.goal.id);
}

function farmRow(goal: CollectionGoal, columns: readonly ProgressColumn[], data: ProgressData, reader: ProgressReader): FarmRow {
  const goalCells: GoalCells = { participants: data.participants[goal.id], recordOnly: data.recordOnly[goal.id] };
  const cells = columns.map((column) => cellFor(column, goalCells, reader));
  const claimed = cells.filter((c) => c.column.kind === 'claimed');
  return {
    goal,
    cells,
    need: claimed.filter((c) => c.state === 'need').length,
    want: claimed.filter((c) => c.state === 'want').length,
    tally: haveTally(cells),
  };
}

/**
 * Every goal in `data.goals` as a row. Active farms (`wanted`, `farming`,
 * `scheduled`) in `compareFarmRows` order; `complete` ones in `finished`, most
 * recently completed first.
 */
export function splitFarmRows(
  data: ProgressData,
  columns: readonly ProgressColumn[],
  reader: ProgressReader,
): { active: FarmRow[]; finished: FarmRow[] } {
  const rows = data.goals.map((goal) => farmRow(goal, columns, data, reader));
  return {
    active: rows.filter((r) => r.goal.status !== 'complete').sort(compareFarmRows),
    finished: rows.filter((r) => r.goal.status === 'complete').sort(compareFinishedRows),
  };
}

// ── Text (R-S2-8) ───────────────────────────────────────────────────────────

/** Glyph plus word in every state; no state is told by colour alone. */
const STATE_TEXT: Record<ParticipantState, string> = {
  have: '✓ Have',
  need: 'Need',
  want: '★ Want',
  pass: '– Pass',
};

const STATE_NAME: Record<ParticipantState, string> = {
  have: 'Have',
  need: 'Need',
  want: 'Want',
  pass: 'Pass',
};

/** The count a cell's text shows: Need and Want only, when the reader may see one. */
function shownCount(cell: ProgressCell): number | null {
  return cell.state === 'need' || cell.state === 'want' ? cell.count : null;
}

/** "✓ Have", "Need 62/99", "Need 62" (no cost), "★ Want", "★ Want 30/99", "– Pass", or "" when blank. */
export function cellText(cell: ProgressCell, goal: Pick<CollectionGoal, 'tokenCost'>): string {
  if (cell.state === null) return '';
  const count = shownCount(cell);
  if (count === null) return STATE_TEXT[cell.state];
  const amount = goal.tokenCost != null ? `${count}/${goal.tokenCost}` : `${count}`;
  return `${STATE_TEXT[cell.state]} ${amount}`;
}

/**
 * "{player}, {track}, {state}[, {count} of {cost} {tokenName}]"; a blank cell
 * reads "no status" and an unclaimed column's cell "unclaimed".
 */
export function cellAccessibleName(
  cell: ProgressCell,
  goal: Pick<CollectionGoal, 'title' | 'tokenCost' | 'tokenName'>,
): string {
  const head = `${cell.column.name}, ${goal.title}`;
  if (cell.column.kind === 'unclaimed') return `${head}, unclaimed`;
  if (cell.state === null) return `${head}, no status`;
  const count = shownCount(cell);
  if (count === null) return `${head}, ${STATE_NAME[cell.state]}`;
  const amount = goal.tokenCost != null ? `${count} of ${goal.tokenCost}` : `${count}`;
  return `${head}, ${STATE_NAME[cell.state]}, ${goal.tokenName ? `${amount} ${goal.tokenName}` : amount}`;
}
