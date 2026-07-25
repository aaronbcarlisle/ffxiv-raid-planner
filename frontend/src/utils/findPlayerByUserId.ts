import type { SnapshotPlayer } from '../types';

/** Resolve a userId (e.g. from a ScheduleRsvp) to the tier player who owns it. */
export function findPlayerByUserId(
  players: SnapshotPlayer[],
  userId: string | null | undefined,
): SnapshotPlayer | undefined {
  if (!userId) return undefined;
  return players.find((p) => p.userId === userId);
}
