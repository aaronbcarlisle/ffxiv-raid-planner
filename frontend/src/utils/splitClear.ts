import type { SnapshotPlayer, SplitClearAssignment } from '../types';

export interface SplitClearReadiness {
  altCount: number;
  memberCount: number;
  issueCount: number;
  issueMemberCount: number;
}

function sameCharacter(
  firstName: string | null | undefined,
  firstWorld: string | null | undefined,
  secondName: string | null | undefined,
  secondWorld: string | null | undefined,
): boolean {
  if (!firstName || !secondName) return false;
  return firstName.trim().toLowerCase() === secondName.trim().toLowerCase()
    && (firstWorld ?? '').trim().toLowerCase() === (secondWorld ?? '').trim().toLowerCase();
}

export function getSplitClearWarnings(
  player: SnapshotPlayer,
  assignment: SplitClearAssignment | undefined,
): string[] {
  const warnings: string[] = [];

  if (!assignment?.mainCharacterName) warnings.push('No main character set');
  if (!assignment?.altCharacterName) warnings.push('No alt character assigned');
  if (!player.job) warnings.push('No main job assigned');

  if (!assignment?.runACharacter) warnings.push('Run A is unassigned');
  if (!assignment?.runBCharacter) warnings.push('Run B is unassigned');
  if (
    assignment?.runACharacter
    && assignment.runACharacter === assignment.runBCharacter
  ) {
    warnings.push('The same character is assigned to both runs');
  }
  if (sameCharacter(
    assignment?.mainCharacterName,
    assignment?.mainCharacterWorld,
    assignment?.altCharacterName,
    assignment?.altCharacterWorld,
  )) {
    warnings.push('Main and alt resolve to the same character');
  }
  if (assignment?.lootTarget === 'funnel_job' && !assignment.lootTargetJob) {
    warnings.push('Loot target job is not selected');
  }

  return warnings;
}

export function getSplitClearReadiness(
  players: SnapshotPlayer[],
  assignments: SplitClearAssignment[],
): SplitClearReadiness {
  const assignmentByPlayer = new Map(assignments.map((assignment) => [assignment.snapshotPlayerId, assignment]));
  let altCount = 0;
  let issueCount = 0;
  let issueMemberCount = 0;

  for (const player of players) {
    const assignment = assignmentByPlayer.get(player.id);
    if (assignment?.altCharacterName) altCount += 1;
    const warnings = getSplitClearWarnings(player, assignment);
    if (warnings.length > 0) {
      issueMemberCount += 1;
      issueCount += warnings.length;
    }
  }

  return { altCount, memberCount: players.length, issueCount, issueMemberCount };
}
