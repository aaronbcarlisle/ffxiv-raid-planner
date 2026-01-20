/**
 * Unit tests for PlayerSetupBanner visibility logic
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { getBannerState, needsBisUpdate } from './playerSetupBannerUtils';
import type { SnapshotPlayer, GearSlotStatus } from '../../types';

// Helper to create a minimal player for testing
function createPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'player-1',
    tierSnapshotId: 'tier-1',
    name: 'Test Player',
    job: 'DRG',
    role: 'melee',
    position: 'M1',
    configured: false,
    sortOrder: 0,
    gear: [],
    tomeWeapon: { tracking: false, hasWeapon: false },
    weaponPriorities: [],
    isSubstitute: false,
    // Test-specific overrides
    userId: undefined,
    bisLink: undefined,
    ...overrides,
  } as SnapshotPlayer;
}

describe('PlayerSetupBanner - getBannerState', () => {
  describe('returns hidden', () => {
    it('when user is not logged in', () => {
      const player = createPlayer();
      const result = getBannerState(player, null, 'member', false);
      expect(result).toBe('hidden');
    });

    it('when user is a viewer', () => {
      const player = createPlayer();
      const result = getBannerState(player, 'user-1', 'viewer', false);
      expect(result).toBe('hidden');
    });

    it('when card is fully configured (claimed + has BiS)', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: 'etro-uuid-123',
      });
      const result = getBannerState(player, 'user-1', 'member', true);
      expect(result).toBe('hidden');
    });

    it('when card is claimed by another user (member perspective)', () => {
      const player = createPlayer({
        userId: 'other-user',
        bisLink: undefined,
      });
      const result = getBannerState(player, 'user-1', 'member', false);
      expect(result).toBe('hidden');
    });

    it('when member has already claimed another card and sees unclaimed card', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'member', true); // userHasClaimedPlayer = true
      expect(result).toBe('hidden');
    });

    it('when user role is null', () => {
      const player = createPlayer();
      const result = getBannerState(player, 'user-1', null, false);
      expect(result).toBe('hidden');
    });

    it('when user role is undefined', () => {
      const player = createPlayer();
      const result = getBannerState(player, 'user-1', undefined, false);
      expect(result).toBe('hidden');
    });
  });

  describe('returns unclaimed-owner', () => {
    it('for owner viewing unclaimed card', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'owner', false);
      expect(result).toBe('unclaimed-owner');
    });

    it('for lead viewing unclaimed card', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'lead', false);
      expect(result).toBe('unclaimed-owner');
    });

    it('for owner even when they have claimed another card', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'owner', true);
      expect(result).toBe('unclaimed-owner');
    });

    it('for owner viewing unclaimed card with bisLink (someone imported BiS but didnt claim)', () => {
      const player = createPlayer({
        userId: undefined,
        bisLink: 'etro-uuid-123',
      });
      const result = getBannerState(player, 'user-1', 'owner', false);
      expect(result).toBe('unclaimed-owner');
    });
  });

  describe('returns unclaimed-member', () => {
    it('for member viewing unclaimed card when they havent claimed any card', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'member', false);
      expect(result).toBe('unclaimed-member');
    });
  });

  describe('returns needs-bis', () => {
    it('when user owns the card but has no BiS', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: undefined,
      });
      const result = getBannerState(player, 'user-1', 'member', true);
      expect(result).toBe('needs-bis');
    });

    it('when owner owns the card but has no BiS', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: undefined,
      });
      const result = getBannerState(player, 'user-1', 'owner', true);
      expect(result).toBe('needs-bis');
    });

    it('when lead owns the card but has no BiS', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: undefined,
      });
      const result = getBannerState(player, 'user-1', 'lead', true);
      expect(result).toBe('needs-bis');
    });

    it('when bisLink is empty string', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: '',
      });
      const result = getBannerState(player, 'user-1', 'member', true);
      expect(result).toBe('needs-bis');
    });
  });

  describe('priority order', () => {
    it('unclaimed-owner takes priority over needs-bis for owner on their own unclaimed card', () => {
      // Edge case: owner creates a card for themselves but hasnt claimed it yet
      const player = createPlayer({ userId: undefined, bisLink: undefined });
      const result = getBannerState(player, 'user-1', 'owner', false);
      // Should show unclaimed-owner, not needs-bis
      expect(result).toBe('unclaimed-owner');
    });
  });
});

describe('PlayerSetupBanner - state transitions', () => {
  it('transitions from unclaimed-member to needs-bis after claiming', () => {
    const userId = 'user-1';

    // Before claiming
    const unclaimedPlayer = createPlayer({ userId: undefined });
    expect(getBannerState(unclaimedPlayer, userId, 'member', false)).toBe('unclaimed-member');

    // After claiming
    const claimedPlayer = createPlayer({ userId, bisLink: undefined });
    expect(getBannerState(claimedPlayer, userId, 'member', true)).toBe('needs-bis');
  });

  it('transitions from needs-bis to hidden after importing BiS', () => {
    const userId = 'user-1';

    // Before BiS import
    const noBisPlayer = createPlayer({ userId, bisLink: undefined });
    expect(getBannerState(noBisPlayer, userId, 'member', true)).toBe('needs-bis');

    // After BiS import
    const withBisPlayer = createPlayer({ userId, bisLink: 'etro-uuid-123' });
    expect(getBannerState(withBisPlayer, userId, 'member', true)).toBe('hidden');
  });

  it('transitions from unclaimed-owner to hidden after assigning user with BiS', () => {
    // Before assigning
    const unclaimedPlayer = createPlayer({ userId: undefined });
    expect(getBannerState(unclaimedPlayer, 'owner-1', 'owner', false)).toBe('unclaimed-owner');

    // After assigning (with BiS configured by owner)
    const assignedPlayer = createPlayer({
      userId: 'member-1',
      bisLink: 'etro-uuid-123',
    });
    // From owner's perspective, card is now fully configured
    expect(getBannerState(assignedPlayer, 'owner-1', 'owner', false)).toBe('hidden');
  });
});

// Helper to create gear slots for testing
function createGearSlot(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return {
    slot: 'weapon',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  };
}

describe('needsBisUpdate', () => {
  it('returns false when player has no bisLink', () => {
    const player = createPlayer({ bisLink: undefined, gear: [] });
    expect(needsBisUpdate(player)).toBe(false);
  });

  it('returns false when player has bisLink but no item data in gear', () => {
    const player = createPlayer({
      bisLink: 'etro-uuid-123',
      gear: [
        createGearSlot({ slot: 'weapon', bisSource: 'raid' }),
        createGearSlot({ slot: 'head', bisSource: 'tome' }),
      ],
    });
    expect(needsBisUpdate(player)).toBe(false);
  });

  it('returns false when all gear is correctly categorized', () => {
    const player = createPlayer({
      bisLink: 'etro-uuid-123',
      gear: [
        // Raid gear - correctly set
        createGearSlot({ slot: 'weapon', bisSource: 'raid', itemName: 'Savage Weapon', itemLevel: 795 }),
        // Augmented tome - correctly set (has Aug. prefix)
        createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Aug. Tome Head', itemLevel: 790 }),
        // Base tome - correctly set
        createGearSlot({ slot: 'body', bisSource: 'base_tome', itemName: 'Quetzalli Body', itemLevel: 780 }),
        // Crafted - correctly set
        createGearSlot({ slot: 'ring1', bisSource: 'crafted', itemName: 'Crafted Ring', itemLevel: 770 }),
      ],
    });
    expect(needsBisUpdate(player)).toBe(false);
  });

  describe('base_tome miscategorization', () => {
    it('returns true when tome slot has item WITHOUT Aug. prefix', () => {
      const player = createPlayer({
        bisLink: 'etro-uuid-123',
        gear: [
          // This should be base_tome, not tome - item name doesn't have Aug.
          createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Quetzalli Hood', itemLevel: 780 }),
        ],
      });
      expect(needsBisUpdate(player)).toBe(true);
    });

    it('returns false when tome slot has item WITH Aug. prefix', () => {
      const player = createPlayer({
        bisLink: 'etro-uuid-123',
        gear: [
          // Correctly set - has Aug. prefix so needs augmentation
          createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Aug. Quetzalli Hood', itemLevel: 790 }),
        ],
      });
      expect(needsBisUpdate(player)).toBe(false);
    });

    it('returns false when tome slot has item WITH Augmented prefix', () => {
      const player = createPlayer({
        bisLink: 'etro-uuid-123',
        gear: [
          // Correctly set - has Augmented prefix
          createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Augmented Neo Kingdom Hood', itemLevel: 790 }),
        ],
      });
      expect(needsBisUpdate(player)).toBe(false);
    });
  });

  describe('crafted miscategorization', () => {
    it('returns true when raid slot has crafted-tier item level (770)', () => {
      const player = createPlayer({
        bisLink: 'etro-uuid-123',
        gear: [
          // This should be crafted, not raid - iLv 770 is crafted tier
          createGearSlot({ slot: 'ring1', bisSource: 'raid', itemName: 'Claro Ring', itemLevel: 770 }),
        ],
      });
      expect(needsBisUpdate(player)).toBe(true);
    });

    it('returns true when tome slot has crafted-tier item level', () => {
      const player = createPlayer({
        bisLink: 'etro-uuid-123',
        gear: [
          // This should be crafted, not tome - iLv 770 is crafted tier
          createGearSlot({ slot: 'ring1', bisSource: 'tome', itemName: 'Crafted Ring', itemLevel: 770 }),
        ],
      });
      expect(needsBisUpdate(player)).toBe(true);
    });

    it('returns false when crafted slot has crafted-tier item level', () => {
      const player = createPlayer({
        bisLink: 'etro-uuid-123',
        gear: [
          // Correctly set
          createGearSlot({ slot: 'ring1', bisSource: 'crafted', itemName: 'Claro Ring', itemLevel: 770 }),
        ],
      });
      expect(needsBisUpdate(player)).toBe(false);
    });

    it('returns false when raid slot has proper raid-tier item level', () => {
      const player = createPlayer({
        bisLink: 'etro-uuid-123',
        gear: [
          // Correctly set - iLv 790 is savage tier
          createGearSlot({ slot: 'body', bisSource: 'raid', itemName: 'Savage Body', itemLevel: 790 }),
        ],
      });
      expect(needsBisUpdate(player)).toBe(false);
    });
  });
});

describe('PlayerSetupBanner - needs-bis-update state', () => {
  it('returns needs-bis-update for owner viewing player with miscategorized base_tome', () => {
    const player = createPlayer({
      userId: 'member-1',
      bisLink: 'etro-uuid-123',
      gear: [
        // tome but no Aug. prefix = should be base_tome
        createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Quetzalli Hood', itemLevel: 780 }),
      ],
    });
    const result = getBannerState(player, 'owner-1', 'owner', false);
    expect(result).toBe('needs-bis-update');
  });

  it('returns needs-bis-update for lead viewing player with miscategorized crafted', () => {
    const player = createPlayer({
      userId: 'member-1',
      bisLink: 'etro-uuid-123',
      gear: [
        // raid but iLv 770 = should be crafted
        createGearSlot({ slot: 'ring1', bisSource: 'raid', itemName: 'Claro Ring', itemLevel: 770 }),
      ],
    });
    const result = getBannerState(player, 'lead-1', 'lead', false);
    expect(result).toBe('needs-bis-update');
  });

  it('returns needs-bis-update for member viewing their own card with miscategorized gear', () => {
    const player = createPlayer({
      userId: 'user-1',
      bisLink: 'etro-uuid-123',
      gear: [
        createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Quetzalli Hood', itemLevel: 780 }),
      ],
    });
    const result = getBannerState(player, 'user-1', 'member', true);
    expect(result).toBe('needs-bis-update');
  });

  it('returns hidden for member viewing another players card with miscategorized gear', () => {
    const player = createPlayer({
      userId: 'other-user',
      bisLink: 'etro-uuid-123',
      gear: [
        createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Quetzalli Hood', itemLevel: 780 }),
      ],
    });
    const result = getBannerState(player, 'user-1', 'member', true);
    expect(result).toBe('hidden');
  });

  it('returns hidden when all gear is correctly categorized', () => {
    const player = createPlayer({
      userId: 'user-1',
      bisLink: 'etro-uuid-123',
      gear: [
        createGearSlot({ slot: 'weapon', bisSource: 'raid', itemName: 'Savage Weapon', itemLevel: 795 }),
        createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Aug. Quetzalli Hood', itemLevel: 790 }),
        createGearSlot({ slot: 'body', bisSource: 'base_tome', itemName: 'Quetzalli Coat', itemLevel: 780 }),
        createGearSlot({ slot: 'ring1', bisSource: 'crafted', itemName: 'Claro Ring', itemLevel: 770 }),
      ],
    });
    const result = getBannerState(player, 'user-1', 'member', true);
    expect(result).toBe('hidden');
  });

  it('transitions from needs-bis-update to hidden after re-importing with correct sources', () => {
    const userId = 'user-1';

    // Before re-import (miscategorized)
    const legacyPlayer = createPlayer({
      userId,
      bisLink: 'etro-uuid-123',
      gear: [
        createGearSlot({ slot: 'weapon', bisSource: 'raid', itemName: 'Savage Weapon', itemLevel: 795 }),
        // Miscategorized: tome but no Aug. prefix
        createGearSlot({ slot: 'head', bisSource: 'tome', itemName: 'Quetzalli Hood', itemLevel: 780 }),
      ],
    });
    expect(getBannerState(legacyPlayer, userId, 'member', true)).toBe('needs-bis-update');

    // After re-import (correctly categorized)
    const updatedPlayer = createPlayer({
      userId,
      bisLink: 'etro-uuid-123',
      gear: [
        createGearSlot({ slot: 'weapon', bisSource: 'raid', itemName: 'Savage Weapon', itemLevel: 795 }),
        createGearSlot({ slot: 'head', bisSource: 'base_tome', itemName: 'Quetzalli Hood', itemLevel: 780 }),
      ],
    });
    expect(getBannerState(updatedPlayer, userId, 'member', true)).toBe('hidden');
  });
});
