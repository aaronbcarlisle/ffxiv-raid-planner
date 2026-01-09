/**
 * Permission Utilities Tests
 *
 * Tests for role-based access control helpers and admin system.
 */

import { describe, it, expect } from 'vitest';
import {
  getEffectiveRole,
  canEditPlayer,
  canEditGear,
  canResetGear,
  canManageRoster,
  canManageTiers,
  canManageGroup,
  canClaimPlayer,
  canManageInvitations,
  getRoleDescription,
  getRoleDisplayName,
  getRoleColorClasses,
} from './permissions';
import type { SnapshotPlayer } from '../types';

// Helper to create a mock player
function createMockPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'player-1',
    tierSnapshotId: 'tier-1',
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
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getEffectiveRole', () => {
  describe('without admin flag', () => {
    it('returns the actual role for owner', () => {
      expect(getEffectiveRole('owner')).toBe('owner');
    });

    it('returns the actual role for lead', () => {
      expect(getEffectiveRole('lead')).toBe('lead');
    });

    it('returns the actual role for member', () => {
      expect(getEffectiveRole('member')).toBe('member');
    });

    it('returns the actual role for viewer', () => {
      expect(getEffectiveRole('viewer')).toBe('viewer');
    });

    it('returns null for null role', () => {
      expect(getEffectiveRole(null)).toBeNull();
    });

    it('returns undefined for undefined role', () => {
      expect(getEffectiveRole(undefined)).toBeUndefined();
    });
  });

  describe('with admin flag', () => {
    it('returns owner for any role when isAdmin is true', () => {
      expect(getEffectiveRole('member', true)).toBe('owner');
      expect(getEffectiveRole('lead', true)).toBe('owner');
      expect(getEffectiveRole('viewer', true)).toBe('owner');
      expect(getEffectiveRole('owner', true)).toBe('owner');
    });

    it('returns owner even when role is null and isAdmin is true', () => {
      expect(getEffectiveRole(null, true)).toBe('owner');
    });

    it('returns owner even when role is undefined and isAdmin is true', () => {
      expect(getEffectiveRole(undefined, true)).toBe('owner');
    });

    it('returns actual role when isAdmin is false', () => {
      expect(getEffectiveRole('member', false)).toBe('member');
      expect(getEffectiveRole('lead', false)).toBe('lead');
    });
  });
});

describe('canEditPlayer', () => {
  const player = createMockPlayer({ userId: 'user-123' });
  const unclaimedPlayer = createMockPlayer({ userId: undefined });

  describe('admin access', () => {
    it('allows admins to edit any player even without a role', () => {
      const result = canEditPlayer(null, player, 'other-user', true);
      expect(result.allowed).toBe(true);
    });

    it('allows admins to edit unclaimed players', () => {
      const result = canEditPlayer(undefined, unclaimedPlayer, undefined, true);
      expect(result.allowed).toBe(true);
    });
  });

  describe('owner access', () => {
    it('allows owners to edit any player', () => {
      const result = canEditPlayer('owner', player, 'other-user');
      expect(result.allowed).toBe(true);
    });
  });

  describe('lead access', () => {
    it('allows leads to edit any player', () => {
      const result = canEditPlayer('lead', player, 'other-user');
      expect(result.allowed).toBe(true);
    });
  });

  describe('member access', () => {
    it('allows members to edit their own claimed player', () => {
      const result = canEditPlayer('member', player, 'user-123');
      expect(result.allowed).toBe(true);
    });

    it('denies members from editing other claimed players', () => {
      const result = canEditPlayer('member', player, 'other-user');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('claimed cards');
    });
  });

  describe('viewer access', () => {
    it('denies viewers from editing players', () => {
      const result = canEditPlayer('viewer', player, 'user-123');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Viewers cannot edit');
    });
  });

  describe('no access', () => {
    it('denies when not logged in', () => {
      const result = canEditPlayer(null, player);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('logged in');
    });
  });
});

describe('canEditGear', () => {
  const player = createMockPlayer({ userId: 'user-123' });

  it('uses same logic as canEditPlayer', () => {
    // Admin access
    expect(canEditGear(null, player, 'other-user', true).allowed).toBe(true);

    // Owner access
    expect(canEditGear('owner', player, 'other-user').allowed).toBe(true);

    // Lead access
    expect(canEditGear('lead', player, 'other-user').allowed).toBe(true);
  });

  it('provides gear-specific error message for members', () => {
    const result = canEditGear('member', player, 'other-user');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('gear');
  });
});

describe('canResetGear', () => {
  const player = createMockPlayer({ userId: 'user-123' });

  describe('admin access', () => {
    it('allows admins to reset any player gear', () => {
      const result = canResetGear(null, player, 'other-user', true);
      expect(result.allowed).toBe(true);
    });
  });

  describe('owner and lead access', () => {
    it('allows owners to reset any player gear', () => {
      const result = canResetGear('owner', player, 'other-user');
      expect(result.allowed).toBe(true);
    });

    it('allows leads to reset any player gear', () => {
      const result = canResetGear('lead', player, 'other-user');
      expect(result.allowed).toBe(true);
    });
  });

  describe('member access', () => {
    it('allows members to reset their own claimed player gear', () => {
      const result = canResetGear('member', player, 'user-123');
      expect(result.allowed).toBe(true);
    });

    it('denies members from resetting other players gear', () => {
      const result = canResetGear('member', player, 'other-user');
      expect(result.allowed).toBe(false);
    });
  });

  describe('viewer access', () => {
    it('denies viewers from resetting gear', () => {
      const result = canResetGear('viewer', player, 'user-123');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Viewers cannot reset');
    });
  });
});

describe('canManageRoster', () => {
  describe('admin access', () => {
    it('allows admins to manage roster without a role', () => {
      const result = canManageRoster(null, true);
      expect(result.allowed).toBe(true);
    });

    it('allows admins with any role to manage roster', () => {
      expect(canManageRoster('viewer', true).allowed).toBe(true);
      expect(canManageRoster('member', true).allowed).toBe(true);
    });
  });

  describe('standard access', () => {
    it('allows owners to manage roster', () => {
      expect(canManageRoster('owner').allowed).toBe(true);
    });

    it('allows leads to manage roster', () => {
      expect(canManageRoster('lead').allowed).toBe(true);
    });

    it('denies members from managing roster', () => {
      const result = canManageRoster('member');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Leads and Owners');
    });

    it('denies viewers from managing roster', () => {
      const result = canManageRoster('viewer');
      expect(result.allowed).toBe(false);
    });
  });
});

describe('canManageTiers', () => {
  it('allows admins to manage tiers', () => {
    expect(canManageTiers(null, true).allowed).toBe(true);
  });

  it('allows owners to manage tiers', () => {
    expect(canManageTiers('owner').allowed).toBe(true);
  });

  it('allows leads to manage tiers', () => {
    expect(canManageTiers('lead').allowed).toBe(true);
  });

  it('denies members from managing tiers', () => {
    const result = canManageTiers('member');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('tiers');
  });
});

describe('canManageGroup', () => {
  describe('admin access', () => {
    it('allows admins to manage group without a role', () => {
      const result = canManageGroup(null, true);
      expect(result.allowed).toBe(true);
    });
  });

  describe('standard access', () => {
    it('allows owners to manage group', () => {
      expect(canManageGroup('owner').allowed).toBe(true);
    });

    it('denies leads from managing group', () => {
      const result = canManageGroup('lead');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Owner');
    });

    it('denies members from managing group', () => {
      expect(canManageGroup('member').allowed).toBe(false);
    });

    it('denies viewers from managing group', () => {
      expect(canManageGroup('viewer').allowed).toBe(false);
    });
  });
});

describe('canClaimPlayer', () => {
  const unclaimedPlayer = createMockPlayer({ userId: undefined });
  const claimedPlayer = createMockPlayer({ userId: 'owner-123' });

  it('allows members to claim unclaimed players', () => {
    const result = canClaimPlayer('member', unclaimedPlayer, 'user-456');
    expect(result.allowed).toBe(true);
  });

  it('denies members from claiming others claimed players', () => {
    const result = canClaimPlayer('member', claimedPlayer, 'user-456');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('claimed by another');
  });

  it('allows owners to unclaim others players', () => {
    const result = canClaimPlayer('owner', claimedPlayer, 'user-456');
    expect(result.allowed).toBe(true);
  });

  it('denies viewers from claiming', () => {
    const result = canClaimPlayer('viewer', unclaimedPlayer, 'user-456');
    expect(result.allowed).toBe(false);
  });
});

describe('canManageInvitations', () => {
  it('allows admins to manage invitations', () => {
    expect(canManageInvitations(null, true).allowed).toBe(true);
  });

  it('allows owners to manage invitations', () => {
    expect(canManageInvitations('owner').allowed).toBe(true);
  });

  it('allows leads to manage invitations', () => {
    expect(canManageInvitations('lead').allowed).toBe(true);
  });

  it('denies members from managing invitations', () => {
    const result = canManageInvitations('member');
    expect(result.allowed).toBe(false);
  });
});

describe('UI helpers', () => {
  describe('getRoleDescription', () => {
    it('returns correct description for each role', () => {
      expect(getRoleDescription('owner')).toContain('Full control');
      expect(getRoleDescription('lead')).toContain('roster');
      expect(getRoleDescription('member')).toContain('own claimed');
      expect(getRoleDescription('viewer')).toContain('Read-only');
    });

    it('returns no access for null/undefined', () => {
      expect(getRoleDescription(null)).toBe('No access');
      expect(getRoleDescription(undefined)).toBe('No access');
    });
  });

  describe('getRoleDisplayName', () => {
    it('capitalizes role names', () => {
      expect(getRoleDisplayName('owner')).toBe('Owner');
      expect(getRoleDisplayName('lead')).toBe('Lead');
      expect(getRoleDisplayName('member')).toBe('Member');
      expect(getRoleDisplayName('viewer')).toBe('Viewer');
    });

    it('returns Viewer for null/undefined', () => {
      expect(getRoleDisplayName(null)).toBe('Viewer');
      expect(getRoleDisplayName(undefined)).toBe('Viewer');
    });
  });

  describe('getRoleColorClasses', () => {
    it('returns color classes for each role', () => {
      expect(getRoleColorClasses('owner')).toContain('purple');
      expect(getRoleColorClasses('lead')).toContain('blue');
      expect(getRoleColorClasses('member')).toContain('green');
      expect(getRoleColorClasses('viewer')).toContain('gray');
    });

    it('returns gray for null/undefined', () => {
      expect(getRoleColorClasses(null)).toContain('gray');
      expect(getRoleColorClasses(undefined)).toContain('gray');
    });
  });
});
