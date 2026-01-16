/**
 * Unit tests for PlayerSetupBanner visibility logic
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { getBannerState } from './PlayerSetupBanner';
import type { SnapshotPlayer } from '../../types';

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
