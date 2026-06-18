import { describe, expect, it } from 'vitest';
import type { SnapshotPlayer, SplitClearAssignment } from '../types';
import { getSplitClearReadiness, getSplitClearWarnings } from './splitClear';

function player(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'player-1',
    name: 'Main Player',
    job: 'DRG',
    configured: true,
    isSubstitute: false,
    ...overrides,
  } as SnapshotPlayer;
}

function assignment(overrides: Partial<SplitClearAssignment> = {}): SplitClearAssignment {
  return {
    id: 'assignment-1',
    snapshotPlayerId: 'player-1',
    mainCharacterName: 'Main Character',
    mainCharacterWorld: 'Tonberry',
    altCharacterName: 'Alt Character',
    altCharacterWorld: 'Kujata',
    runACharacter: 'main',
    runBCharacter: 'alt',
    lootTarget: 'funnel_main',
    lootTargetJob: null,
    runACleared: false,
    runBCleared: false,
    notes: null,
    updatedAt: '2026-06-18T00:00:00Z',
    ...overrides,
  };
}

describe('split-clear warnings', () => {
  it('reports a missing alt', () => {
    expect(getSplitClearWarnings(player(), assignment({ altCharacterName: null })))
      .toContain('No alt character assigned');
  });

  it('reports the same character slot in both runs', () => {
    expect(getSplitClearWarnings(player(), assignment({ runBCharacter: 'main' })))
      .toContain('The same character is assigned to both runs');
  });

  it('reports duplicate main and alt identities case-insensitively', () => {
    expect(getSplitClearWarnings(player(), assignment({
      altCharacterName: 'main character',
      altCharacterWorld: 'TONBERRY',
    }))).toContain('Main and alt resolve to the same character');
  });

  it('reports an incomplete job funnel target', () => {
    expect(getSplitClearWarnings(player(), assignment({ lootTarget: 'funnel_job' })))
      .toContain('Loot target job is not selected');
  });

  it('returns no warnings for a complete split assignment', () => {
    expect(getSplitClearWarnings(player(), assignment())).toEqual([]);
  });
});

describe('split-clear readiness', () => {
  it('counts assigned alts and affected members', () => {
    const players = [player(), player({ id: 'player-2', name: 'Second Player' })];
    const assignments = [
      assignment(),
      assignment({
        id: 'assignment-2',
        snapshotPlayerId: 'player-2',
        altCharacterName: null,
        runBCharacter: null,
      }),
    ];

    expect(getSplitClearReadiness(players, assignments)).toEqual({
      altCount: 1,
      memberCount: 2,
      issueCount: 2,
      issueMemberCount: 1,
    });
  });
});
