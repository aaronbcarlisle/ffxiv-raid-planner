import { describe, it, expect } from 'vitest';
import {
  rankLootCandidates,
  recommendRecipientForDrop,
  LOOT_SCORING_WEIGHTS,
  type LootDropInput,
} from '../lootRecommendationService';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, StaticCharacterRegistration } from '../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: StaticSettings = {
  displayOrder: ['tank', 'healer', 'melee', 'ranged', 'caster'],
  lootPriority: [],
  sortPreset: 'standard',
  groupView: false,
  timezone: 'UTC',
  autoSync: false,
  syncFrequency: 'weekly',
};

function makePlayer(overrides: Partial<SnapshotPlayer> & { id: string; name: string }): SnapshotPlayer {
  return {
    id: overrides.id,
    tierSnapshotId: 'tier-1',
    name: overrides.name,
    job: overrides.job ?? 'DRG',
    role: overrides.role ?? 'melee',
    configured: true,
    isSubstitute: false,
    sortOrder: 0,
    gear: overrides.gear ?? [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: overrides.weaponPriorities ?? [],
    ...overrides,
  };
}

function makeGearSlot(slot: string, bisSource: 'raid' | 'tome', hasItem: boolean) {
  return { slot, bisSource, hasItem, isAugmented: false };
}

function makeReg(
  playerId: string,
  overrides: Partial<StaticCharacterRegistration> = {},
): StaticCharacterRegistration {
  return {
    id: `reg-${playerId}`,
    staticGroupId: 'group-1',
    snapshotPlayerId: playerId,
    roleInStatic: 'main',
    isPrimaryForStatic: true,
    source: 'manual',
    manualCharacterName: 'Test Char',
    resolvedName: null,
    job: null,
    lastSyncedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const DROP_HEAD: LootDropInput = {
  slot: 'head',
  dropType: 'direct_drop',
  week: 1,
  floor: 'M10S',
};

const DROP_WEAPON: LootDropInput = {
  slot: 'weapon',
  dropType: 'weapon_coffer',
  week: 1,
  floor: 'M12S',
};

// ---------------------------------------------------------------------------
// Tests: direct drop BiS need ranks highest
// ---------------------------------------------------------------------------

describe('rankLootCandidates — direct drop', () => {
  it('player who needs BiS head scores higher than player who already has it', () => {
    const needsHead = makePlayer({
      id: 'p1',
      name: 'Needs Head',
      gear: [makeGearSlot('head', 'raid', false)],
    });
    const hasHead = makePlayer({
      id: 'p2',
      name: 'Has Head',
      gear: [makeGearSlot('head', 'raid', true)],
    });

    const candidates = rankLootCandidates(
      DROP_HEAD,
      [needsHead, hasHead],
      DEFAULT_SETTINGS,
      {},
      [],
      1,
    );

    expect(candidates[0].rosterPlayerId).toBe('p1');
    expect(candidates[0].wouldAdvanceBis).toBe(true);
    expect(candidates[1].wouldAdvanceBis).toBe(false);
  });

  it('player who already received slot via loot log scores lower', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Already Got It', gear: [makeGearSlot('head', 'raid', false)] });
    const p2 = makePlayer({ id: 'p2', name: 'Still Needs It', gear: [makeGearSlot('head', 'raid', false)] });

    const existingEntry: LootLogEntry = {
      id: '1',
      tierSnapshotId: 'tier-1',
      weekNumber: 1,
      floor: 'M10S',
      itemSlot: 'head',
      recipientPlayerId: 'p1',
      recipientPlayerName: 'Already Got It',
      recipientCharacterRegistrationId: null,
      recipientCharacterName: null,
      method: 'drop',
      notes: null,
      weaponJob: null,
      isExtra: false,
      createdAt: '2026-01-01T00:00:00Z',
      createdByUserId: 'u1',
      createdByUsername: 'lead',
    };

    const candidates = rankLootCandidates(
      DROP_HEAD,
      [p1, p2],
      DEFAULT_SETTINGS,
      {},
      [existingEntry],
      2,
    );

    expect(candidates[0].rosterPlayerId).toBe('p2');
    expect(candidates[1].rosterPlayerId).toBe('p1');
    expect(candidates[1].alreadyReceivedRelevantLoot).toBe(true);
  });

  it('main character registration gives bonus over player-only fallback', () => {
    const withReg = makePlayer({ id: 'p1', name: 'Registered', gear: [makeGearSlot('head', 'raid', false)] });
    const noReg = makePlayer({ id: 'p2', name: 'No Reg', gear: [makeGearSlot('head', 'raid', false)] });

    const regs = { p1: [makeReg('p1', { roleInStatic: 'main', isPrimaryForStatic: true })] };

    const candidates = rankLootCandidates(
      DROP_HEAD,
      [withReg, noReg],
      DEFAULT_SETTINGS,
      regs,
      [],
      1,
    );

    // Both need the item, but p1 has a main character registration (+15 + +30 = +45 bonus)
    const p1 = candidates.find((c) => c.rosterPlayerId === 'p1')!;
    const p2 = candidates.find((c) => c.rosterPlayerId === 'p2')!;
    expect(p1.score).toBeGreaterThan(p2.score);
    expect(p1.source).toBe('character_registration');
    expect(p2.source).toBe('player_fallback');
  });

  it('player with no BiS data receives missingBisData penalty', () => {
    const noBis = makePlayer({ id: 'p1', name: 'No BiS', gear: [] });
    const hasBis = makePlayer({ id: 'p2', name: 'Has BiS', gear: [makeGearSlot('head', 'raid', false)] });

    const candidates = rankLootCandidates(DROP_HEAD, [noBis, hasBis], DEFAULT_SETTINGS, {}, [], 1);
    const noBisCandidate = candidates.find((c) => c.rosterPlayerId === 'p1')!;
    expect(noBisCandidate.warnings.some((w) => w.toLowerCase().includes('no bis data') || w.toLowerCase().includes('bis'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: weapon coffer uses weapon priority
// ---------------------------------------------------------------------------

describe('rankLootCandidates — weapon coffer', () => {
  it('weapon priority rank 1 scores highest', () => {
    const rank1 = makePlayer({
      id: 'p1', name: 'Prio 1',
      gear: [makeGearSlot('weapon', 'raid', false)],
      weaponPriorities: [{ job: 'DRG', order: 0, received: false }],
    });
    const rank2 = makePlayer({
      id: 'p2', name: 'Prio 2',
      job: 'NIN',
      gear: [makeGearSlot('weapon', 'raid', false)],
      weaponPriorities: [{ job: 'NIN', order: 1, received: false }],
    });

    const candidates = rankLootCandidates(DROP_WEAPON, [rank1, rank2], DEFAULT_SETTINGS, {}, [], 1);
    expect(candidates[0].rosterPlayerId).toBe('p1');
    expect(candidates[0].reasons).toContain('Weapon priority #1');
  });

  it('player whose weapon is already marked received scores very low', () => {
    const alreadyReceived = makePlayer({
      id: 'p1', name: 'Got Weapon',
      gear: [makeGearSlot('weapon', 'raid', false)],
      weaponPriorities: [{ job: 'DRG', order: 0, received: true }],
    });
    const stillNeeds = makePlayer({
      id: 'p2', name: 'Needs Weapon',
      job: 'NIN',
      gear: [makeGearSlot('weapon', 'raid', false)],
      weaponPriorities: [{ job: 'NIN', order: 1, received: false }],
    });

    const candidates = rankLootCandidates(DROP_WEAPON, [alreadyReceived, stillNeeds], DEFAULT_SETTINGS, {}, [], 1);
    expect(candidates[0].rosterPlayerId).toBe('p2');
    expect(candidates[1].alreadyReceivedRelevantLoot).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: recommendRecipientForDrop confidence
// ---------------------------------------------------------------------------

describe('recommendRecipientForDrop — confidence', () => {
  it('returns low confidence and no recommendedRecipient when all candidates received the loot', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Everyone Got It', gear: [makeGearSlot('head', 'raid', true)] });

    const result = recommendRecipientForDrop(DROP_HEAD, [p1], DEFAULT_SETTINGS, {}, [], 1);
    expect(result.confidence).toBe('low');
    expect(result.recommendedRecipient).toBeNull();
  });

  it('returns high confidence when top candidate clearly needs BiS and has registration', () => {
    const clear = makePlayer({ id: 'p1', name: 'Clear Winner', gear: [makeGearSlot('head', 'raid', false)] });
    const others = [
      makePlayer({ id: 'p2', name: 'Has Head', gear: [makeGearSlot('head', 'raid', true)] }),
      makePlayer({ id: 'p3', name: 'Also Has Head', gear: [makeGearSlot('head', 'raid', true)] }),
    ];
    const regs = { p1: [makeReg('p1')] };

    const result = recommendRecipientForDrop(DROP_HEAD, [clear, ...others], DEFAULT_SETTINGS, regs, [], 1);
    expect(result.confidence).toBe('high');
    expect(result.recommendedRecipient?.rosterPlayerId).toBe('p1');
  });

  it('returns global warning when no registrations exist', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Player', gear: [makeGearSlot('head', 'raid', false)] });
    const result = recommendRecipientForDrop(DROP_HEAD, [p1], DEFAULT_SETTINGS, {}, [], 1);
    expect(result.warnings.some((w) => w.toLowerCase().includes('no character registrations'))).toBe(true);
  });

  it('handles empty player list gracefully', () => {
    const result = recommendRecipientForDrop(DROP_HEAD, [], DEFAULT_SETTINGS, {}, [], 1);
    expect(result.confidence).toBe('low');
    expect(result.recommendedRecipient).toBeNull();
    expect(result.rankedCandidates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: scoring weight constants are well-defined
// ---------------------------------------------------------------------------

describe('LOOT_SCORING_WEIGHTS', () => {
  it('all positive weights are positive and all penalties are negative', () => {
    expect(LOOT_SCORING_WEIGHTS.exactBisNeed).toBeGreaterThan(0);
    expect(LOOT_SCORING_WEIGHTS.weaponPriorityFirst).toBeGreaterThan(0);
    expect(LOOT_SCORING_WEIGHTS.alreadyComplete).toBeLessThan(0);
    expect(LOOT_SCORING_WEIGHTS.alreadyReceivedLoot).toBeLessThan(0);
    expect(LOOT_SCORING_WEIGHTS.missingBisData).toBeLessThan(0);
    expect(LOOT_SCORING_WEIGHTS.playerOnlyFallback).toBeLessThan(0);
  });
});
