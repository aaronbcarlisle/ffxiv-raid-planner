/**
 * progressProvenance — where a Progress cell's value came from (S2a-2·F4 Task TF6,
 * R-S2-9). Pure: the matrix passes the reader and a name lookup in, and the cell's
 * tooltip prints what comes back. The side that supplied the state is the character
 * record when `stateFromRecord`, else the member's row; the count has its own side.
 */
import type { ParticipantRecordView } from '../../stores/collectionGoalStore';
import { relativeTime } from '../../utils/staticActivity';
import type { ProgressCell } from '../../utils/progressModel';

export interface ProvenanceContext {
  /** The effective viewer (View As aware): "you" is this user. */
  viewerUserId: string | null;
  /** A user's display name, or null when unknown (a former member, say). */
  nameOf: (userId: string) => string | null;
}

interface CellProvenance {
  /** Who set the state, and when for a plugin write. */
  state: string;
  /** A second line, only when the count came from the other side than the state. */
  count: string | null;
}

/** What one side (the row, or the record) knows about its last write. */
interface Side {
  writer: string | null;
  channel: string | null;
  source: string | null;
  /** When its state last changed. */
  stateAt: string | null;
  /** When its count last changed. */
  countAt: string | null;
}

function rowSide(cell: ProgressCell): Side | null {
  const entry = cell.entry;
  if (entry === null) return null;
  return {
    writer: entry.updatedByUserId ?? null,
    channel: entry.updatedVia ?? null,
    source: entry.source,
    stateAt: entry.stateChangedAt ?? null,
    countAt: entry.tokenCountUpdatedAt ?? null,
  };
}

function recordSide(record: ParticipantRecordView): Side {
  return {
    writer: record.updatedByUserId,
    channel: record.updatedVia,
    source: record.source,
    // The record's own sync stamp stands in when it has no state change time (R-S2-9).
    stateAt: record.stateChangedAt ?? record.lastSyncedAt,
    countAt: record.tokenCountUpdatedAt,
  };
}

const SOURCE_LABEL: Record<string, string> = {
  plugin: 'plugin',
  player_hub: 'from the Hub',
  manual: 'recorded earlier',
};

/** One side's label, from R-S2-9's table; `at` times a plugin label only. */
function labelFor(side: Side, at: string | null, memberId: string, ctx: ProvenanceContext): string {
  if (side.channel === 'api_key') return at !== null ? `plugin, ${relativeTime(at)}` : 'plugin';
  if (side.writer !== null) {
    if (side.writer === ctx.viewerUserId) return 'you';
    if (side.writer === memberId) return 'self-reported';
    return `set by ${ctx.nameOf(side.writer) ?? 'another member'}`;
  }
  if (side.channel !== null) return 'added when tracked';
  return SOURCE_LABEL[side.source ?? ''] ?? 'recorded earlier';
}

/**
 * The provenance of one cell, or null when it has none to tell: a blank cell, or an
 * unclaimed column's. The count line appears only where the cell shows a count and it
 * came from the other side; a hidden count gets no line and no time.
 */
export function cellProvenance(cell: ProgressCell, ctx: ProvenanceContext): CellProvenance | null {
  const memberId = cell.column.userId;
  if (memberId === null || cell.state === null) return null;

  const row = rowSide(cell);
  const record = cell.record !== null ? recordSide(cell.record) : null;
  const entry = cell.entry;

  // A record-only cell has no row: its one side is the record.
  const stateSide = entry === null ? record : entry.stateFromRecord ? (record ?? row) : row;
  if (stateSide === null) return null;
  const state = labelFor(stateSide, stateSide.stateAt, memberId, ctx);

  const countShown = (cell.state === 'need' || cell.state === 'want') && !cell.countHidden && cell.count !== null;
  if (entry === null || !countShown || (entry.countFromRecord ?? false) === (entry.stateFromRecord ?? false)) {
    return { state, count: null };
  }
  const countSide = entry.countFromRecord ? (record ?? row) : row;
  return { state, count: countSide === null ? null : labelFor(countSide, countSide.countAt, memberId, ctx) };
}
