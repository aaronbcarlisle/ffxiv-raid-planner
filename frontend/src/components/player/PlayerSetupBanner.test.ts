/**
 * Unit tests for PlayerSetupBanner visibility logic
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { getBannerState } from './playerSetupBannerUtils';
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

describe('PlayerSetupBanner - banner hiding options', () => {
  describe('hideSetupBanners option', () => {
    it('shows needs-bis for owner on unclaimed card without BiS when hideSetupBanners is enabled', () => {
      // When hiding setup banners, owner should still see BiS status for unclaimed cards
      const player = createPlayer({ userId: undefined, bisLink: undefined });
      const result = getBannerState(player, 'user-1', 'owner', false, { hideSetupBanners: true });
      expect(result).toBe('needs-bis');
    });

    it('shows needs-bis for lead on unclaimed card without BiS when hideSetupBanners is enabled', () => {
      const player = createPlayer({ userId: undefined, bisLink: undefined });
      const result = getBannerState(player, 'user-1', 'lead', false, { hideSetupBanners: true });
      expect(result).toBe('needs-bis');
    });

    it('hides banner for owner on unclaimed card WITH BiS when hideSetupBanners is enabled', () => {
      // Card has BiS, no banner needed
      const player = createPlayer({ userId: undefined, bisLink: 'etro-uuid-123' });
      const result = getBannerState(player, 'user-1', 'owner', false, { hideSetupBanners: true });
      expect(result).toBe('hidden');
    });

    it('hides unclaimed-member banner when enabled (member cant see BiS status of others)', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'member', false, { hideSetupBanners: true });
      expect(result).toBe('hidden');
    });

    it('still shows needs-bis banner for claimed cards when hideSetupBanners is enabled', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: undefined,
      });
      const result = getBannerState(player, 'user-1', 'member', true, { hideSetupBanners: true });
      expect(result).toBe('needs-bis');
    });

    it('shows unclaimed-owner banner when hideSetupBanners is false', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'owner', false, { hideSetupBanners: false });
      expect(result).toBe('unclaimed-owner');
    });
  });

  describe('hideBisBanners option', () => {
    it('hides needs-bis banner when enabled', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: undefined,
      });
      const result = getBannerState(player, 'user-1', 'member', true, { hideBisBanners: true });
      expect(result).toBe('hidden');
    });

    it('still shows unclaimed-owner banner when hideBisBanners is enabled', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'owner', false, { hideBisBanners: true });
      expect(result).toBe('unclaimed-owner');
    });

    it('still shows unclaimed-member banner when hideBisBanners is enabled', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'member', false, { hideBisBanners: true });
      expect(result).toBe('unclaimed-member');
    });

    it('shows needs-bis banner when hideBisBanners is false', () => {
      const player = createPlayer({
        userId: 'user-1',
        bisLink: undefined,
      });
      const result = getBannerState(player, 'user-1', 'member', true, { hideBisBanners: false });
      expect(result).toBe('needs-bis');
    });
  });

  describe('combined options', () => {
    it('hides all banners when both options are enabled', () => {
      const unclaimedPlayer = createPlayer({ userId: undefined, bisLink: undefined });
      const noBisPlayer = createPlayer({ userId: 'user-1', bisLink: undefined });
      const options = { hideSetupBanners: true, hideBisBanners: true };

      // Unclaimed cards for owner/lead - both setup AND bis banners hidden
      expect(getBannerState(unclaimedPlayer, 'user-1', 'owner', false, options)).toBe('hidden');
      expect(getBannerState(unclaimedPlayer, 'user-1', 'lead', false, options)).toBe('hidden');

      // Unclaimed for member - hidden (member cant see BiS of others anyway)
      expect(getBannerState(unclaimedPlayer, 'user-1', 'member', false, options)).toBe('hidden');

      // Claimed card without BiS - hidden
      expect(getBannerState(noBisPlayer, 'user-1', 'member', true, options)).toBe('hidden');
    });

    it('owner sees needs-bis for unclaimed cards when only hideSetupBanners is enabled', () => {
      const player = createPlayer({ userId: undefined, bisLink: undefined });
      const options = { hideSetupBanners: true, hideBisBanners: false };
      expect(getBannerState(player, 'user-1', 'owner', false, options)).toBe('needs-bis');
    });

    it('works with empty options object (backwards compatible)', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'owner', false, {});
      expect(result).toBe('unclaimed-owner');
    });

    it('works without options parameter (backwards compatible)', () => {
      const player = createPlayer({ userId: undefined });
      const result = getBannerState(player, 'user-1', 'owner', false);
      expect(result).toBe('unclaimed-owner');
    });
  });
});
