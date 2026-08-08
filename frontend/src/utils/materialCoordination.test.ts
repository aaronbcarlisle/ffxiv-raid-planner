/**
 * Unit tests for material coordination utilities
 *
 * Tests the pure utility functions for material eligibility calculations
 * (no store mocks needed — they never touch the stores), plus
 * `updateMaterialAndReconcileGear`, which coordinates the material-log PUT
 * with gear reconciliation via `useLootTrackingStore`/`useTierStore` and so
 * needs module-level store mocks (see the bottom `describe` block).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponItem,
  needsTomeWeaponAugmentation,
  hasTomeWeaponItem,
  getAugmentedSlotsForMaterial,
  isTomeWeaponAugmented,
  updateMaterialAndReconcileGear,
} from './materialCoordination';
import type { UpdateMaterialOptions } from './materialCoordination';
import type {
  SnapshotPlayer,
  GearSlotStatus,
  MaterialLogEntry,
  MaterialType,
  LootMethod,
  TierSnapshot,
} from '../types';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useTierStore } from '../stores/tierStore';

vi.mock('../stores/lootTrackingStore', () => ({
  useLootTrackingStore: { getState: vi.fn() },
}));
vi.mock('../stores/tierStore', () => ({
  useTierStore: { getState: vi.fn() },
}));

// Helper to create a minimal gear slot
function createGearSlot(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return {
    slot: 'body',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  };
}

// Helper to create a minimal player
function createPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'player-1',
    tierSnapshotId: 'tier-1',
    name: 'Test Player',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [
      createGearSlot({ slot: 'weapon', bisSource: 'raid' }),
      createGearSlot({ slot: 'head', bisSource: 'raid' }),
      createGearSlot({ slot: 'body', bisSource: 'raid' }),
      createGearSlot({ slot: 'hands', bisSource: 'raid' }),
      createGearSlot({ slot: 'legs', bisSource: 'raid' }),
      createGearSlot({ slot: 'feet', bisSource: 'raid' }),
      createGearSlot({ slot: 'earring', bisSource: 'raid' }),
      createGearSlot({ slot: 'necklace', bisSource: 'raid' }),
      createGearSlot({ slot: 'bracelet', bisSource: 'raid' }),
      createGearSlot({ slot: 'ring1', bisSource: 'raid' }),
      createGearSlot({ slot: 'ring2', bisSource: 'raid' }),
    ],
    tomeWeapon: {
      pursuing: false,
      hasItem: false,
      isAugmented: false,
    },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
    ...overrides,
  };
}

describe('getEligibleSlotsForAugmentation', () => {
  describe('twine (armor)', () => {
    it('returns armor slots with bisSource=tome, hasItem=true, isAugmented=false', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'hands', bisSource: 'tome', hasItem: true, isAugmented: true }), // already augmented
          createGearSlot({ slot: 'legs', bisSource: 'tome', hasItem: false, isAugmented: false }), // doesn't have item
          createGearSlot({ slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false }), // raid BiS
          createGearSlot({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }), // wrong material type
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'twine');
      expect(eligible).toEqual(['head', 'body']);
    });

    it('returns empty array when no armor slots need augmentation', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'raid' }),
          createGearSlot({ slot: 'body', bisSource: 'raid' }),
          createGearSlot({ slot: 'hands', bisSource: 'raid' }),
          createGearSlot({ slot: 'legs', bisSource: 'raid' }),
          createGearSlot({ slot: 'feet', bisSource: 'raid' }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'twine');
      expect(eligible).toEqual([]);
    });

    it('excludes slots already augmented', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: true }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'twine');
      expect(eligible).toEqual([]);
    });
  });

  describe('glaze (accessories)', () => {
    it('returns accessory slots with bisSource=tome, hasItem=true, isAugmented=false', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'necklace', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'bracelet', bisSource: 'raid', hasItem: true, isAugmented: false }), // raid BiS
          createGearSlot({ slot: 'ring1', bisSource: 'tome', hasItem: false, isAugmented: false }), // doesn't have item
          createGearSlot({ slot: 'ring2', bisSource: 'tome', hasItem: true, isAugmented: true }), // already augmented
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }), // wrong material type
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'glaze');
      expect(eligible).toEqual(['earring', 'necklace']);
    });

    it('returns both ring slots if both need augmentation', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'ring1', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'ring2', bisSource: 'tome', hasItem: true, isAugmented: false }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'glaze');
      expect(eligible).toContain('ring1');
      expect(eligible).toContain('ring2');
    });
  });

  describe('solvent (weapon)', () => {
    it('returns weapon slot when it needs augmentation', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'solvent');
      expect(eligible).toEqual(['weapon']);
    });

    it('returns empty array when weapon is raid BiS', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', bisSource: 'raid', hasItem: true, isAugmented: false }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'solvent');
      expect(eligible).toEqual([]);
    });

    it('returns empty array when weapon already augmented', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: true }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'solvent');
      expect(eligible).toEqual([]);
    });
  });

  describe('universal_tomestone', () => {
    it('returns empty array (universal_tomestone uses needsTomeWeaponAugmentation instead)', () => {
      const player = createPlayer({
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'universal_tomestone');
      expect(eligible).toEqual([]);
    });
  });
});

describe('needsTomeWeaponItem', () => {
  it('returns true when pursuing and does not have item', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponItem(player)).toBe(true);
  });

  it('returns false when not pursuing tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponItem(player)).toBe(false);
  });

  it('returns false when already has tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponItem(player)).toBe(false);
  });
});

describe('hasTomeWeaponItem', () => {
  it('returns true when pursuing and has item', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(hasTomeWeaponItem(player)).toBe(true);
  });

  it('returns false when not pursuing', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(hasTomeWeaponItem(player)).toBe(false);
  });

  it('returns false when does not have item', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(hasTomeWeaponItem(player)).toBe(false);
  });
});

describe('needsTomeWeaponAugmentation', () => {
  it('returns true when pursuing, has item, and not augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(true);
  });

  it('returns false when not pursuing tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });

  it('returns false when does not have tome weapon yet', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });

  it('returns false when tome weapon already augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: true,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });

  it('returns false when all conditions are false', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });
});

describe('getAugmentedSlotsForMaterial', () => {
  describe('twine (armor)', () => {
    it('returns armor slots with bisSource=tome, hasItem=true, isAugmented=true', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'hands', bisSource: 'tome', hasItem: true, isAugmented: false }), // not augmented
          createGearSlot({ slot: 'legs', bisSource: 'tome', hasItem: false, isAugmented: true }), // doesn't have item
          createGearSlot({ slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: true }), // raid BiS
        ],
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'twine');
      expect(augmented).toEqual(['head', 'body']);
    });

    it('returns empty array when no armor slots are augmented', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }),
        ],
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'twine');
      expect(augmented).toEqual([]);
    });
  });

  describe('glaze (accessories)', () => {
    it('returns accessory slots with bisSource=tome, hasItem=true, isAugmented=true', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'necklace', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'bracelet', bisSource: 'tome', hasItem: true, isAugmented: true }),
        ],
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'glaze');
      expect(augmented).toEqual(['earring', 'bracelet']);
    });
  });

  describe('universal_tomestone', () => {
    it('returns empty array (universal_tomestone uses isTomeWeaponAugmented instead)', () => {
      const player = createPlayer({
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: true },
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'universal_tomestone');
      expect(augmented).toEqual([]);
    });
  });
});

describe('isTomeWeaponAugmented', () => {
  it('returns true when pursuing, has item, and is augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: true,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(true);
  });

  it('returns false when not pursuing tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: true,
        isAugmented: true,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(false);
  });

  it('returns false when does not have tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: true,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(false);
  });

  it('returns false when not augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(false);
  });
});

// ==================== updateMaterialAndReconcileGear ====================

function createMaterialLogEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1,
    tierSnapshotId: 'tier-1',
    weekNumber: 1,
    floor: 'M9S',
    materialType: 'twine',
    recipientPlayerId: 'player-1',
    recipientPlayerName: 'Player One',
    method: 'drop',
    slotAugmented: null,
    createdAt: '2026-01-09T00:00:00Z',
    createdByUserId: 'user-1',
    createdByUsername: 'tester',
    ...overrides,
  };
}

interface NewMaterialData {
  weekNumber: number;
  floor: string;
  materialType: MaterialType;
  recipientPlayerId: string;
  method: LootMethod;
  notes: string;
}

function createNewData(overrides: Partial<NewMaterialData> = {}): NewMaterialData {
  return {
    weekNumber: 1,
    floor: 'M9S',
    materialType: 'twine',
    recipientPlayerId: 'player-1',
    method: 'drop',
    notes: '',
    ...overrides,
  };
}

function createTierSnapshot(players: SnapshotPlayer[]): TierSnapshot {
  return {
    id: 'tier-snap-1',
    staticGroupId: 'group-1',
    tierId: 'tier-1',
    contentType: 'savage',
    isActive: true,
    players,
    weaponPrioritiesGlobalLock: false,
    currentWeek: 1,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
  };
}

describe('updateMaterialAndReconcileGear', () => {
  const groupId = 'group-1';
  const tierId = 'tier-1';

  let currentTier: TierSnapshot;
  let updateMaterialEntry: ReturnType<typeof vi.fn>;
  let fetchWeekDataTypes: ReturnType<typeof vi.fn>;
  let updatePlayer: ReturnType<typeof vi.fn>;
  let fetchTier: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentTier = createTierSnapshot([
      createPlayer({ id: 'player-1', name: 'Player One' }),
      createPlayer({ id: 'player-2', name: 'Player Two' }),
    ]);

    updateMaterialEntry = vi.fn().mockResolvedValue(undefined);
    fetchWeekDataTypes = vi.fn().mockResolvedValue(undefined);
    fetchTier = vi.fn().mockResolvedValue(undefined);

    // Stateful: merges gear/tomeWeapon updates into the fixture player so a
    // revert -> apply pair reads the revert's result, the way the real
    // store would (director M5's "fresh getState() between" requirement).
    updatePlayer = vi.fn().mockImplementation(
      async (_g: string, _t: string, playerId: string, data: Partial<SnapshotPlayer>) => {
        currentTier = {
          ...currentTier,
          players: currentTier.players?.map((p) => {
            if (p.id !== playerId) return p;
            return {
              ...p,
              ...data,
              gear: data.gear ?? p.gear,
              tomeWeapon: data.tomeWeapon ? { ...p.tomeWeapon, ...data.tomeWeapon } : p.tomeWeapon,
            };
          }),
        };
      }
    );

    vi.mocked(useLootTrackingStore.getState).mockReturnValue({
      updateMaterialEntry,
      fetchWeekDataTypes,
    } as unknown as ReturnType<typeof useLootTrackingStore.getState>);

    vi.mocked(useTierStore.getState).mockImplementation(
      () =>
        ({
          currentTier,
          updatePlayer,
          fetchTier,
        }) as unknown as ReturnType<typeof useTierStore.getState>
    );
  });

  /** The (groupId, tierId, playerId, data) args of the Nth updatePlayer call. */
  function updatePlayerCall(index: number) {
    const call = updatePlayer.mock.calls[index];
    return { groupId: call[0], tierId: call[1], playerId: call[2], data: call[3] as Partial<SnapshotPlayer> };
  }

  it('moves a slotted material from one slot to another (head -> body): reverts head, applies body', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }),
        ],
      }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'twine', slotAugmented: 'head' });
    const newData = createNewData({ materialType: 'twine' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'body' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updateMaterialEntry).toHaveBeenCalledWith(groupId, tierId, oldEntry.id, {
      weekNumber: newData.weekNumber,
      floor: newData.floor,
      materialType: 'twine',
      recipientPlayerId: 'player-1',
      method: newData.method,
      slotAugmented: 'body',
      notes: '',
    });

    expect(updatePlayer).toHaveBeenCalledTimes(2);

    const revertCall = updatePlayerCall(0);
    expect(revertCall.playerId).toBe('player-1');
    expect((revertCall.data.gear ?? []).find((g) => g.slot === 'head')?.isAugmented).toBe(false);

    const applyCall = updatePlayerCall(1);
    expect(applyCall.playerId).toBe('player-1');
    expect((applyCall.data.gear ?? []).find((g) => g.slot === 'body')?.isAugmented).toBe(true);
    // The apply step must read post-revert state: if it reused the stale
    // pre-revert player, this wholesale gear-array replace would re-augment
    // the just-reverted head slot. The stateful updatePlayer mock only
    // catches that if something actually asserts on it here.
    expect((applyCall.data.gear ?? []).find((g) => g.slot === 'head')?.isAugmented).toBe(false);
  });

  it('slot -> none (updateGear: false): payload slotAugmented is "" and the old slot is reverted', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true })],
      }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'twine', slotAugmented: 'head' });
    const newData = createNewData({ materialType: 'twine' });

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, { updateGear: false });

    expect(updateMaterialEntry).toHaveBeenCalledWith(
      groupId,
      tierId,
      oldEntry.id,
      expect.objectContaining({ slotAugmented: '' })
    );

    expect(updatePlayer).toHaveBeenCalledTimes(1);
    const revertCall = updatePlayerCall(0);
    expect((revertCall.data.gear ?? []).find((g) => g.slot === 'head')?.isAugmented).toBe(false);
  });

  it('none -> slot: no prior effect, applies the new slot with no revert call', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false })],
      }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'twine', slotAugmented: null });
    const newData = createNewData({ materialType: 'twine' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'body' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updateMaterialEntry).toHaveBeenCalledWith(
      groupId,
      tierId,
      oldEntry.id,
      expect.objectContaining({ slotAugmented: 'body' })
    );

    expect(updatePlayer).toHaveBeenCalledTimes(1);
    const applyCall = updatePlayerCall(0);
    expect((applyCall.data.gear ?? []).find((g) => g.slot === 'body')?.isAugmented).toBe(true);
  });

  it('solvent tome_aug -> weapon slot: reverts tome weapon augmentation, applies the weapon slot', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [createGearSlot({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false })],
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: true },
      }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'solvent', slotAugmented: 'tome_weapon' });
    const newData = createNewData({ materialType: 'solvent' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'weapon', augmentTomeWeapon: false };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updateMaterialEntry).toHaveBeenCalledWith(
      groupId,
      tierId,
      oldEntry.id,
      expect.objectContaining({ slotAugmented: 'weapon' })
    );

    expect(updatePlayer).toHaveBeenCalledTimes(2);

    const revertCall = updatePlayerCall(0);
    expect(revertCall.data.tomeWeapon?.isAugmented).toBe(false);

    const applyCall = updatePlayerCall(1);
    expect((applyCall.data.gear ?? []).find((g) => g.slot === 'weapon')?.isAugmented).toBe(true);
  });

  it('recipient change: old recipient gets zero gear calls; only the new recipient is updated', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true })],
      }),
      createPlayer({
        id: 'player-2',
        gear: [createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false })],
      }),
    ];

    const oldEntry = createMaterialLogEntry({
      materialType: 'twine',
      slotAugmented: 'head',
      recipientPlayerId: 'player-1',
    });
    const newData = createNewData({ materialType: 'twine', recipientPlayerId: 'player-2' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'head' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    const playerIdsTouched = updatePlayer.mock.calls.map((call) => call[2]);
    expect(playerIdsTouched).not.toContain('player-1');
    expect(playerIdsTouched).toEqual(['player-2']);

    const applyCall = updatePlayerCall(0);
    expect((applyCall.data.gear ?? []).find((g) => g.slot === 'head')?.isAugmented).toBe(true);
  });

  it('recipient changed to a missing player: PUT and week refresh land, zero updatePlayer calls', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true })],
      }),
      // 'player-2' deliberately absent - simulates picking a recipient no longer on the roster.
    ];

    const oldEntry = createMaterialLogEntry({
      materialType: 'twine',
      slotAugmented: 'head',
      recipientPlayerId: 'player-1',
    });
    const newData = createNewData({ materialType: 'twine', recipientPlayerId: 'player-2' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'head' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updateMaterialEntry).toHaveBeenCalledTimes(1);
    expect(fetchWeekDataTypes).toHaveBeenCalledTimes(1);
    expect(updatePlayer).not.toHaveBeenCalled();
  });

  it('UT kept (idempotent): effect unchanged for the same recipient fires zero gear calls', async () => {
    currentTier.players = [
      createPlayer({ id: 'player-1', tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false } }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'universal_tomestone', slotAugmented: null });
    const newData = createNewData({ materialType: 'universal_tomestone' });
    const options: UpdateMaterialOptions = { updateGear: true };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updateMaterialEntry).toHaveBeenCalledWith(
      groupId,
      tierId,
      oldEntry.id,
      expect.objectContaining({ slotAugmented: '' })
    );
    expect(updatePlayer).not.toHaveBeenCalled();
  });

  it('UT unchecked: reverts hasItem only, never isAugmented (unlike the delete path)', async () => {
    currentTier.players = [
      createPlayer({ id: 'player-1', tomeWeapon: { pursuing: true, hasItem: true, isAugmented: true } }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'universal_tomestone', slotAugmented: null });
    const newData = createNewData({ materialType: 'universal_tomestone' });

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, { updateGear: false });

    expect(updatePlayer).toHaveBeenCalledTimes(1);
    const revertCall = updatePlayerCall(0);
    expect(revertCall.data.tomeWeapon).toEqual({ pursuing: true, hasItem: false, isAugmented: true });
  });

  it('UT -> twine material change: reverts the UT grant AND applies the new slot (legacy skipped this)', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false })],
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'universal_tomestone', slotAugmented: null });
    const newData = createNewData({ materialType: 'twine' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'body' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updatePlayer).toHaveBeenCalledTimes(2);

    const revertCall = updatePlayerCall(0);
    expect(revertCall.data.tomeWeapon?.hasItem).toBe(false);

    const applyCall = updatePlayerCall(1);
    expect((applyCall.data.gear ?? []).find((g) => g.slot === 'body')?.isAugmented).toBe(true);
  });

  it('passes notes through untouched: "" clears, a value passes as-is', async () => {
    const oldEntry = createMaterialLogEntry({ materialType: 'twine', slotAugmented: 'head' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'head' };

    await updateMaterialAndReconcileGear(
      groupId,
      tierId,
      oldEntry,
      createNewData({ materialType: 'twine', notes: '' }),
      options
    );
    await updateMaterialAndReconcileGear(
      groupId,
      tierId,
      oldEntry,
      createNewData({ materialType: 'twine', notes: 'Got some extra twine' }),
      options
    );

    expect(updateMaterialEntry.mock.calls[0][3]).toEqual(expect.objectContaining({ notes: '' }));
    expect(updateMaterialEntry.mock.calls[1][3]).toEqual(
      expect.objectContaining({ notes: 'Got some extra twine' })
    );
    // Same recipient + unchanged effect both times: notes-only edits are silent.
    expect(updatePlayer).not.toHaveBeenCalled();
  });

  it('week-only edit: PUT carries the new week and week data refreshes, zero gear calls', async () => {
    const oldEntry = createMaterialLogEntry({ materialType: 'twine', slotAugmented: 'head', weekNumber: 1 });
    const newData = createNewData({ materialType: 'twine', weekNumber: 5 });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'head' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updateMaterialEntry).toHaveBeenCalledWith(
      groupId,
      tierId,
      oldEntry.id,
      expect.objectContaining({ weekNumber: 5 })
    );
    expect(fetchWeekDataTypes).toHaveBeenCalledTimes(1);
    expect(fetchWeekDataTypes).toHaveBeenCalledWith(groupId, tierId);
    expect(updatePlayer).not.toHaveBeenCalled();
  });

  it('week-data refresh fires after every PUT, before any gear reconciliation', async () => {
    currentTier.players = [
      createPlayer({
        id: 'player-1',
        gear: [createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false })],
      }),
    ];

    const oldEntry = createMaterialLogEntry({ materialType: 'twine', slotAugmented: null });
    const newData = createNewData({ materialType: 'twine' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'body' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(fetchWeekDataTypes).toHaveBeenCalledTimes(1);
    expect(updateMaterialEntry.mock.invocationCallOrder[0]).toBeLessThan(
      fetchWeekDataTypes.mock.invocationCallOrder[0]
    );
    expect(fetchWeekDataTypes.mock.invocationCallOrder[0]).toBeLessThan(
      updatePlayer.mock.invocationCallOrder[0]
    );
  });

  it('missing player: PUT and week refresh still land, gear step returns early with zero calls', async () => {
    // Neither fixture player is "ghost" - simulates a recipient no longer on the roster.
    const oldEntry = createMaterialLogEntry({
      materialType: 'twine',
      slotAugmented: 'head',
      recipientPlayerId: 'ghost',
    });
    const newData = createNewData({ materialType: 'twine', recipientPlayerId: 'ghost' });
    const options: UpdateMaterialOptions = { updateGear: true, slotToAugment: 'body' };

    await updateMaterialAndReconcileGear(groupId, tierId, oldEntry, newData, options);

    expect(updateMaterialEntry).toHaveBeenCalledTimes(1);
    expect(fetchWeekDataTypes).toHaveBeenCalledTimes(1);
    expect(updatePlayer).not.toHaveBeenCalled();
  });
});
