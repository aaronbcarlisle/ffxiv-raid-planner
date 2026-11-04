/**
 * progressView — which farms are active and which columns they make (S2a-4b·B1 Task TB1; R-F-9,
 * D-11, S-9). Progress and Home's TrackCard both build their columns here, so the card's pips and
 * its top farm's queue can't drift from the matrix. Pure, and `utils/` isn't ring-typed, so Ring 0's
 * card may import it.
 */
import type { CollectionGoal } from '../stores/collectionGoalStore';
import type { SnapshotPlayer, SortPreset } from '../types';
import { buildColumns, type ProgressColumn, type ProgressData } from './progressModel';

interface ProgressInputsArgs {
  /** The store's goals, across statics. */
  goals: readonly CollectionGoal[];
  groupId: string;
  players: readonly SnapshotPlayer[];
  sortPreset: SortPreset;
  /** The cells behind the columns. Empty ones give the roster alone (Progress, until its farms show). */
  data: Pick<ProgressData, 'participants' | 'recordOnly'>;
}

/**
 * This static's goals that aren't finished, and the columns those goals make. Only they make
 * columns, so a finished farm's member never adds or shifts one (`buildColumns`), and `participants`
 * is keyed across statics, so another static's member can't either.
 */
export function progressInputs({ goals, groupId, players, sortPreset, data }: ProgressInputsArgs): {
  activeGoals: CollectionGoal[];
  columns: ProgressColumn[];
} {
  const activeGoals = goals.filter((g) => g.staticGroupId === groupId && g.status !== 'complete');
  const { participants, recordOnly } = data;
  return { activeGoals, columns: buildColumns(players, sortPreset, { goals: activeGoals, participants, recordOnly }) };
}
