/**
 * Store-shaped fixtures shared by the Progress component tests: a goal and a
 * participant row, with every field set and the usual ones overridable.
 */
import type { CollectionGoal, ParticipantStateEntry } from '../../../stores/collectionGoalStore';
import type { MemberRole, SnapshotPlayer } from '../../../types';
import { cellFor, type FarmRow, type ProgressColumn } from '../../../utils/progressModel';

export function goal(id: string, overrides: Partial<CollectionGoal> = {}): CollectionGoal {
  return {
    id, staticGroupId: 'g1', createdById: null, goalType: 'mount', contentType: null, contentKey: null,
    title: id, status: 'farming', priorityMode: null, summary: null, linkedDutyId: null, linkedRewardId: null,
    targetCount: null, currentCount: null, note: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    completedAt: null, catalogItemId: null, tokenName: 'Tokens', tokenCost: 99, participantSummary: null, ...overrides,
  };
}

export function row(goalId: string, userId: string, overrides: Partial<ParticipantStateEntry> = {}): ParticipantStateEntry {
  return {
    id: `${goalId}:${userId}`, goalId, userId, staticGroupId: 'g1', state: 'need', tokenCount: null, priorityRank: null,
    source: 'manual', lastSyncedAt: null, notes: null, updatedAt: '2026-10-01T00:00:00Z', displayName: userId,
    memberRole: 'member', countHidden: false, record: null, ...overrides,
  };
}

type ColumnKind = 'claimed' | 'unclaimed' | 'unconfigured' | 'notOnRoster';

/** A drop as the server sends it (snake_case), for a mocked `api`. */
export function apiDrop(id: string, recipient: string | null, extra: Record<string, unknown> = {}) {
  return {
    id, goal_id: 'wings', static_group_id: 'g1', recipient_user_id: recipient, created_by_id: recipient, quantity: 1,
    dropped_at: '2026-10-01T00:00:00Z', notes: null, created_at: '2026-10-01T00:00:00Z', recipient_display_name: recipient,
    recipient_prior_state: null, ...extra,
  };
}

/** A column of the given kind; `userId` is the id unless the kind has none. */
function columnOf(id: string, kind: ColumnKind): ProgressColumn {
  if (kind === 'claimed') return { kind, key: id, name: id, userId: id, player: {} as SnapshotPlayer };
  if (kind === 'unclaimed') return { kind, key: id, name: id, userId: null, player: {} as SnapshotPlayer };
  return { kind: 'notOnRoster', key: `user:${id}`, name: id, userId: id, player: null, reason: kind };
}

export interface ColumnSpec {
  id: string;
  kind?: ColumnKind;
  /** The participant row; null or absent is a blank cell. */
  cell?: Partial<ParticipantStateEntry> | null;
}

/** A farm row built the way the matrix builds it: `cellFor` over store-shaped participant rows. */
export function farmRowOf(columns: ColumnSpec[], g: CollectionGoal, userRole: MemberRole = 'lead'): FarmRow {
  const participants = columns.flatMap((c) => (c.cell ? [row(g.id, c.id, c.cell)] : []));
  const cells = columns.map((c) =>
    cellFor(columnOf(c.id, c.kind ?? 'claimed'), { participants }, { currentUserId: 'me', userRole }),
  );
  return { goal: g, cells, need: 0, want: 0, tally: { n: 0, m: 0, everyone: false } };
}
