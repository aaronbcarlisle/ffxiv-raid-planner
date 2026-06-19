/**
 * splitClearSuggestionService — unit tests
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { priorityToSplitLootTarget, buildSplitClearDraft } from './splitClearSuggestionService';
import type { SnapshotPlayer, SplitClearAssignment } from '../types';

function player(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Test Player',
    job: 'DRG',
    role: 'melee',
    position: 'M1',
    configured: true,
    sortOrder: 0,
    gear: [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    isSubstitute: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function assignment(overrides: Partial<SplitClearAssignment> = {}): SplitClearAssignment {
  return {
    id: 'a1',
    snapshotPlayerId: 'p1',
    runACharacterLinkId: null,
    runBCharacterLinkId: null,
    mainCharacterName: null,
    mainCharacterWorld: null,
    altCharacterName: null,
    altCharacterWorld: null,
    runACharacter: null,
    runBCharacter: null,
    lootTarget: 'normal',
    lootTargetJob: null,
    runACleared: false,
    runBCleared: false,
    notes: null,
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

// ── priorityToSplitLootTarget ─────────────────────────────────────────────────

describe('priorityToSplitLootTarget', () => {
  it('returns normal when weaponPriorities is empty', () => {
    const result = priorityToSplitLootTarget(player({ weaponPriorities: [] }));
    expect(result.lootTarget).toBe('normal');
    expect(result.reason).toContain('Priority missing');
  });

  it('returns normal when weapon already received', () => {
    const result = priorityToSplitLootTarget(
      player({ job: 'DRG', weaponPriorities: [{ job: 'DRG', received: true }] }),
    );
    expect(result.lootTarget).toBe('normal');
    expect(result.reason).toContain('already received');
  });

  it('returns funnel_main when weapon not yet received', () => {
    const result = priorityToSplitLootTarget(
      player({ job: 'DRG', weaponPriorities: [{ job: 'DRG', received: false }] }),
    );
    expect(result.lootTarget).toBe('funnel_main');
    expect(result.reason).toContain('funneling');
  });

  it('returns normal when no entry matches the current job', () => {
    const result = priorityToSplitLootTarget(
      player({ job: 'DRG', weaponPriorities: [{ job: 'WHM', received: false }] }),
    );
    expect(result.lootTarget).toBe('normal');
    expect(result.reason).toContain('No weapon priority entry for current job');
  });

  it('is case-insensitive when matching job to weaponPriorities', () => {
    const result = priorityToSplitLootTarget(
      player({ job: 'drg', weaponPriorities: [{ job: 'DRG', received: false }] }),
    );
    expect(result.lootTarget).toBe('funnel_main');
  });

  it('always returns null for lootTargetJob', () => {
    const result = priorityToSplitLootTarget(
      player({ job: 'DRG', weaponPriorities: [{ job: 'DRG', received: false }] }),
    );
    expect(result.lootTargetJob).toBeNull();
  });
});

// ── buildSplitClearDraft ──────────────────────────────────────────────────────

describe('buildSplitClearDraft', () => {
  it('generates one assignment per player', () => {
    const players = [player({ id: 'p1' }), player({ id: 'p2', name: 'Player Two' })];
    const draft = buildSplitClearDraft(players, []);
    expect(draft.assignments).toHaveLength(2);
    expect(draft.assignments[0].playerId).toBe('p1');
    expect(draft.assignments[1].playerId).toBe('p2');
  });

  it('sets generatedAt to a non-empty ISO string', () => {
    const draft = buildSplitClearDraft([player()], []);
    expect(draft.generatedAt).toBeTruthy();
    expect(new Date(draft.generatedAt).toISOString()).toBe(draft.generatedAt);
  });

  it('uses lodestoneName as main character when available', () => {
    const p = player({ lodestoneName: 'Kaito Nakamura', lodestoneServer: 'Tonberry' });
    const draft = buildSplitClearDraft([p], []);
    const a = draft.assignments[0];
    expect(a.runACharacterName).toBe('Kaito Nakamura');
    expect(a.runACharacterWorld).toBe('Tonberry');
    expect(a.reasons.some(r => r.includes('lodestone') || r.includes('Lodestone'))).toBe(true);
  });

  it('falls back to existing assignment main when no lodestone data', () => {
    const p = player({ lodestoneName: undefined });
    const existing = assignment({
      snapshotPlayerId: 'p1',
      mainCharacterName: 'FallbackMain',
      mainCharacterWorld: 'Moogle',
    });
    const draft = buildSplitClearDraft([p], [existing]);
    expect(draft.assignments[0].runACharacterName).toBe('FallbackMain');
    expect(draft.assignments[0].runACharacterWorld).toBe('Moogle');
  });

  it('sets runA=main when main character is known', () => {
    const p = player({ lodestoneName: 'My Main', lodestoneServer: 'Tonberry' });
    const draft = buildSplitClearDraft([p], []);
    expect(draft.assignments[0].runACharacter).toBe('main');
  });

  it('sets runA=null when no main character can be determined', () => {
    const p = player({ lodestoneName: undefined });
    const draft = buildSplitClearDraft([p], []);
    expect(draft.assignments[0].runACharacter).toBeNull();
  });

  it('carries alt character from existing assignment and sets runB=alt', () => {
    const p = player({ id: 'p1', lodestoneName: undefined });
    const existing = assignment({
      snapshotPlayerId: 'p1',
      altCharacterName: 'AltChar',
      altCharacterWorld: 'Moogle',
    });
    const draft = buildSplitClearDraft([p], [existing]);
    expect(draft.assignments[0].runBCharacterName).toBe('AltChar');
    expect(draft.assignments[0].runBCharacterWorld).toBe('Moogle');
    expect(draft.assignments[0].runBCharacter).toBe('alt');
  });

  it('sets runB=null when no alt character is available', () => {
    const p = player({ lodestoneName: 'MainOnly' });
    const draft = buildSplitClearDraft([p], []);
    expect(draft.assignments[0].runBCharacter).toBeNull();
  });

  it('applies funnel_main loot target from weapon priority', () => {
    const p = player({ job: 'DRG', weaponPriorities: [{ job: 'DRG', received: false }] });
    const draft = buildSplitClearDraft([p], []);
    expect(draft.assignments[0].lootTarget).toBe('funnel_main');
  });

  it('applies normal loot target when weapon already received', () => {
    const p = player({ job: 'DRG', weaponPriorities: [{ job: 'DRG', received: true }] });
    const draft = buildSplitClearDraft([p], []);
    expect(draft.assignments[0].lootTarget).toBe('normal');
  });

  it('includes at least one reason string per player', () => {
    const draft = buildSplitClearDraft([player()], []);
    expect(draft.assignments[0].reasons.length).toBeGreaterThan(0);
  });

  it('is deterministic — same input produces same output structure', () => {
    const p = player({ lodestoneName: 'Same', lodestoneServer: 'Tonberry' });
    const d1 = buildSplitClearDraft([p], []);
    const d2 = buildSplitClearDraft([p], []);
    expect(d1.assignments[0].runACharacterName).toBe(d2.assignments[0].runACharacterName);
    expect(d1.assignments[0].lootTarget).toBe(d2.assignments[0].lootTarget);
  });
});
