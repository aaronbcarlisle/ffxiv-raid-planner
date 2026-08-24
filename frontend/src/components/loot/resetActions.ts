/**
 * D7 (R-16): the one place a ResetConfig's blast radius is computed.
 * Re-expresses the frozen legacy semantics (SectionedLogView.tsx:450-538 —
 * reference, not a dependency) as a pure planner so every scope combination
 * is unit-provable before anything destructive runs. Book-op precedence is
 * legacy's exactly: playerId beats floor beats week beats all. One deliberate
 * hardening: a floor-scoped loot config with no week filters by floor across
 * all weeks (legacy fell through to EVERYTHING); no UI emits that config.
 */
import type { ResetConfig } from '../ui/ResetConfirmModal';
import type { LootLogEntry, MaterialLogEntry } from '../../types';

export type BookResetOp =
  | { kind: 'none' }
  | { kind: 'player-all'; playerId: string }
  | { kind: 'player-week'; playerId: string; week: number }
  | { kind: 'floor-all'; floor: number }
  | { kind: 'floor-week'; floor: number; week: number }
  | { kind: 'week'; week: number }
  | { kind: 'all' };

export interface ResetActionPlan {
  lootEntries: LootLogEntry[];
  materialEntries: MaterialLogEntry[];
  bookOp: BookResetOp;
}

export function resolveResetActions(
  config: ResetConfig,
  input: { lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; floors: string[] },
): ResetActionPlan {
  const { scope, target, week, floor, playerId } = config;
  const wantsLoot = target === 'loot' || target === 'data';
  const wantsBooks = target === 'books' || target === 'data';

  let lootEntries: LootLogEntry[] = [];
  let materialEntries: MaterialLogEntry[] = [];
  if (wantsLoot) {
    // Floor numbers map to tier floor NAMES ('M9S'…) — entries carry the name.
    const floorName = scope === 'floor' && floor != null ? input.floors[floor - 1] : null;
    const matches = (e: { weekNumber: number; floor: string }) => {
      if (scope === 'floor' && floorName == null) return false; // out-of-range floor: fail closed
      if (floorName != null && e.floor !== floorName) return false;
      if (scope !== 'all' && week != null && e.weekNumber !== week) return false;
      return true;
    };
    lootEntries = input.lootLog.filter(matches);
    materialEntries = input.materialLog.filter(matches);
  }

  let bookOp: BookResetOp = { kind: 'none' };
  if (wantsBooks) {
    if (playerId && week == null) bookOp = { kind: 'player-all', playerId };
    else if (playerId && week != null) bookOp = { kind: 'player-week', playerId, week };
    else if (scope === 'floor' && floor != null && week == null) bookOp = { kind: 'floor-all', floor };
    else if (scope === 'floor' && floor != null && week != null) bookOp = { kind: 'floor-week', floor, week };
    else if (scope === 'week' && week != null) bookOp = { kind: 'week', week };
    else bookOp = { kind: 'all' };
  }
  return { lootEntries, materialEntries, bookOp };
}

/** Toast copy for a completed reset. Player-scoped configs always name the player. */
export function describeResetToast(config: ResetConfig): string {
  const { scope, target, week, floor, playerName } = config;

  if (playerName) {
    return week != null
      ? `Reset ${playerName}'s Week ${week} books complete`
      : `Reset ${playerName}'s books complete`;
  }
  if (scope === 'floor' && floor != null) {
    return week != null
      ? `Reset Floor ${floor} ${target} for Week ${week} complete`
      : `Reset Floor ${floor} ${target} complete`;
  }
  if (scope === 'week' && week != null) {
    return `Reset Week ${week} ${target} complete`;
  }
  return `Reset all ${target} complete`;
}
