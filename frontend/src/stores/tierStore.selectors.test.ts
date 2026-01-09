/**
 * Unit tests for tierStore selectors
 *
 * Tests the selector logic that allows components to efficiently
 * subscribe to specific parts of the tier store state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// Mock the services/api module to break circular dependency with authStore
vi.mock('../services/api', () => ({
  API_BASE_URL: 'http://localhost:8000',
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock authStore to avoid circular dependency issues
vi.mock('./authStore', () => ({
  useAuthStore: {
    getState: () => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      refreshAccessToken: vi.fn(),
    }),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}));

import { useTierStore } from './tierStore';
import type { TierSnapshot, SnapshotPlayer } from '../types';

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
    isSubstitute: false,
    gear: [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock tier
function createMockTier(overrides: Partial<TierSnapshot> = {}): TierSnapshot {
  return {
    id: 'tier-1',
    staticGroupId: 'group-1',
    tierId: 'aac-heavyweight',
    contentType: 'savage',
    isActive: true,
    currentWeek: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    players: [],
    weaponPrioritiesGlobalLock: false,
    ...overrides,
  };
}

// Helper to get state using a selector function
function selectFromStore<T>(selector: (state: ReturnType<typeof useTierStore.getState>) => T): T {
  return selector(useTierStore.getState());
}

describe('tierStore selectors', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useTierStore.setState({
        tiers: [],
        currentTier: null,
        isLoading: false,
        isSaving: false,
        error: null,
      });
    });
  });

  describe('currentTier selector', () => {
    it('returns null when no tier is selected', () => {
      const result = selectFromStore((state) => state.currentTier);
      expect(result).toBeNull();
    });

    it('returns the current tier when set', () => {
      const tier = createMockTier();
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore((state) => state.currentTier);
      expect(result).toEqual(tier);
    });
  });

  describe('currentTierId selector', () => {
    it('returns undefined when no tier is selected', () => {
      const result = selectFromStore((state) => state.currentTier?.id);
      expect(result).toBeUndefined();
    });

    it('returns the current tier ID', () => {
      const tier = createMockTier({ id: 'specific-tier-id' });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore((state) => state.currentTier?.id);
      expect(result).toBe('specific-tier-id');
    });
  });

  describe('tiers selector', () => {
    it('returns empty array initially', () => {
      const result = selectFromStore((state) => state.tiers);
      expect(result).toEqual([]);
    });

    it('returns all tiers', () => {
      const tiers = [
        createMockTier({ id: 'tier-1', tierId: 'tier-a' }),
        createMockTier({ id: 'tier-2', tierId: 'tier-b' }),
      ];
      act(() => {
        useTierStore.setState({ tiers });
      });

      const result = selectFromStore((state) => state.tiers);
      expect(result).toHaveLength(2);
      expect(result[0].tierId).toBe('tier-a');
      expect(result[1].tierId).toBe('tier-b');
    });
  });

  describe('tierPlayers selector', () => {
    it('returns empty array when no tier selected', () => {
      const result = selectFromStore((state) => state.currentTier?.players ?? []);
      expect(result).toEqual([]);
    });

    it('returns players from current tier', () => {
      const players = [
        createMockPlayer({ id: 'p1', name: 'Player 1' }),
        createMockPlayer({ id: 'p2', name: 'Player 2' }),
      ];
      const tier = createMockTier({ players });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore((state) => state.currentTier?.players ?? []);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Player 1');
    });
  });

  describe('isLoading selector', () => {
    it('returns false initially', () => {
      const result = selectFromStore((state) => state.isLoading);
      expect(result).toBe(false);
    });

    it('returns true when loading', () => {
      act(() => {
        useTierStore.setState({ isLoading: true });
      });

      const result = selectFromStore((state) => state.isLoading);
      expect(result).toBe(true);
    });
  });

  describe('isSaving selector', () => {
    it('returns false initially', () => {
      const result = selectFromStore((state) => state.isSaving);
      expect(result).toBe(false);
    });

    it('returns true when saving', () => {
      act(() => {
        useTierStore.setState({ isSaving: true });
      });

      const result = selectFromStore((state) => state.isSaving);
      expect(result).toBe(true);
    });
  });

  describe('error selector', () => {
    it('returns null initially', () => {
      const result = selectFromStore((state) => state.error);
      expect(result).toBeNull();
    });

    it('returns error message when set', () => {
      act(() => {
        useTierStore.setState({ error: 'Something went wrong' });
      });

      const result = selectFromStore((state) => state.error);
      expect(result).toBe('Something went wrong');
    });
  });

  describe('player selector', () => {
    it('returns undefined when player not found', () => {
      const tier = createMockTier({ players: [] });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore(
        (state) => state.currentTier?.players.find((p) => p.id === 'nonexistent')
      );
      expect(result).toBeUndefined();
    });

    it('returns the player when found', () => {
      const player = createMockPlayer({ id: 'target-player', name: 'Target' });
      const tier = createMockTier({ players: [player] });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore(
        (state) => state.currentTier?.players.find((p) => p.id === 'target-player')
      );
      expect(result?.name).toBe('Target');
    });

    it('returns undefined when no tier selected', () => {
      const result = selectFromStore(
        (state) => state.currentTier?.players.find((p) => p.id === 'any-id')
      );
      expect(result).toBeUndefined();
    });
  });

  describe('playerByPosition selector', () => {
    it('returns undefined when position not found', () => {
      const tier = createMockTier({ players: [] });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore(
        (state) => state.currentTier?.players.find((p) => p.position === 'T1')
      );
      expect(result).toBeUndefined();
    });

    it('returns the player at position', () => {
      const players = [
        createMockPlayer({ id: 'p1', position: 'T1', name: 'Tank' }),
        createMockPlayer({ id: 'p2', position: 'H1', name: 'Healer' }),
      ];
      const tier = createMockTier({ players });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore(
        (state) => state.currentTier?.players.find((p) => p.position === 'T1')
      );
      expect(result?.name).toBe('Tank');
    });
  });

  describe('configuredPlayers selector', () => {
    it('returns empty array when no tier selected', () => {
      const result = selectFromStore(
        (state) => state.currentTier?.players.filter((p) => p.configured) ?? []
      );
      expect(result).toEqual([]);
    });

    it('filters to only configured players', () => {
      const players = [
        createMockPlayer({ id: 'p1', configured: true, name: 'Configured' }),
        createMockPlayer({ id: 'p2', configured: false, name: 'Template' }),
        createMockPlayer({ id: 'p3', configured: true, name: 'Also Configured' }),
      ];
      const tier = createMockTier({ players });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const result = selectFromStore(
        (state) => state.currentTier?.players.filter((p) => p.configured) ?? []
      );
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(['Configured', 'Also Configured']);
    });
  });

  describe('playersByGroup selector', () => {
    it('returns empty groups when no tier selected', () => {
      const players = selectFromStore((state) => state.currentTier?.players ?? []);
      const group1 = players.filter((p) => p.position?.endsWith('1'));
      const group2 = players.filter((p) => p.position?.endsWith('2'));

      expect(group1).toEqual([]);
      expect(group2).toEqual([]);
    });

    it('groups players by position', () => {
      const players = [
        createMockPlayer({ id: 'p1', position: 'T1', name: 'Tank1' }),
        createMockPlayer({ id: 'p2', position: 'H1', name: 'Healer1' }),
        createMockPlayer({ id: 'p3', position: 'M1', name: 'Melee1' }),
        createMockPlayer({ id: 'p4', position: 'R1', name: 'Ranged1' }),
        createMockPlayer({ id: 'p5', position: 'T2', name: 'Tank2' }),
        createMockPlayer({ id: 'p6', position: 'H2', name: 'Healer2' }),
        createMockPlayer({ id: 'p7', position: 'M2', name: 'Melee2' }),
        createMockPlayer({ id: 'p8', position: 'R2', name: 'Ranged2' }),
      ];
      const tier = createMockTier({ players });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const allPlayers = selectFromStore((state) => state.currentTier?.players ?? []);
      const group1 = allPlayers.filter((p) => p.position?.endsWith('1'));
      const group2 = allPlayers.filter((p) => p.position?.endsWith('2'));

      expect(group1).toHaveLength(4);
      expect(group2).toHaveLength(4);

      const group1Names = group1.map((p) => p.name);
      expect(group1Names).toContain('Tank1');
      expect(group1Names).toContain('Healer1');
      expect(group1Names).toContain('Melee1');
      expect(group1Names).toContain('Ranged1');

      const group2Names = group2.map((p) => p.name);
      expect(group2Names).toContain('Tank2');
      expect(group2Names).toContain('Healer2');
      expect(group2Names).toContain('Melee2');
      expect(group2Names).toContain('Ranged2');
    });

    it('handles players without position', () => {
      const players = [
        createMockPlayer({ id: 'p1', position: 'T1', name: 'With Position' }),
        createMockPlayer({ id: 'p2', position: undefined, name: 'No Position' }),
      ];
      const tier = createMockTier({ players });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const allPlayers = selectFromStore((state) => state.currentTier?.players ?? []);
      const group1 = allPlayers.filter((p) => p.position?.endsWith('1'));
      const group2 = allPlayers.filter((p) => p.position?.endsWith('2'));

      expect(group1).toHaveLength(1);
      expect(group2).toHaveLength(0);
    });
  });

  describe('weaponPrioritySettings selector', () => {
    it('returns defaults when no tier selected', () => {
      const state = useTierStore.getState();

      expect(state.currentTier?.weaponPrioritiesAutoLockDate).toBeUndefined();
      expect(state.currentTier?.weaponPrioritiesGlobalLock ?? false).toBe(false);
      expect(state.currentTier?.weaponPrioritiesGlobalLockedBy).toBeUndefined();
      expect(state.currentTier?.weaponPrioritiesGlobalLockedAt).toBeUndefined();
    });

    it('returns weapon priority settings from tier', () => {
      const tier = createMockTier({
        weaponPrioritiesAutoLockDate: '2026-02-01T00:00:00Z',
        weaponPrioritiesGlobalLock: true,
        weaponPrioritiesGlobalLockedBy: 'user-123',
        weaponPrioritiesGlobalLockedAt: '2026-01-15T12:00:00Z',
      });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const state = useTierStore.getState();

      expect(state.currentTier?.weaponPrioritiesAutoLockDate).toBe('2026-02-01T00:00:00Z');
      expect(state.currentTier?.weaponPrioritiesGlobalLock).toBe(true);
      expect(state.currentTier?.weaponPrioritiesGlobalLockedBy).toBe('user-123');
      expect(state.currentTier?.weaponPrioritiesGlobalLockedAt).toBe('2026-01-15T12:00:00Z');
    });

    it('returns false for globalLock when not set', () => {
      const tier = createMockTier({
        weaponPrioritiesGlobalLock: undefined,
      });
      act(() => {
        useTierStore.setState({ currentTier: tier });
      });

      const state = useTierStore.getState();
      expect(state.currentTier?.weaponPrioritiesGlobalLock ?? false).toBe(false);
    });
  });
});

describe('selector memoization', () => {
  beforeEach(() => {
    act(() => {
      useTierStore.setState({
        tiers: [],
        currentTier: null,
        isLoading: false,
        isSaving: false,
        error: null,
      });
    });
  });

  it('returns same reference when state unchanged', () => {
    const players = [createMockPlayer()];
    const tier = createMockTier({ players });
    act(() => {
      useTierStore.setState({ currentTier: tier });
    });

    const result1 = useTierStore.getState().currentTier?.players;
    const result2 = useTierStore.getState().currentTier?.players;

    // Same state = same reference
    expect(result1).toBe(result2);
  });

  it('returns new reference when players change', () => {
    const tier1 = createMockTier({ players: [createMockPlayer({ name: 'Old' })] });
    act(() => {
      useTierStore.setState({ currentTier: tier1 });
    });

    const result1 = useTierStore.getState().currentTier?.players;

    const tier2 = createMockTier({ players: [createMockPlayer({ name: 'New' })] });
    act(() => {
      useTierStore.setState({ currentTier: tier2 });
    });

    const result2 = useTierStore.getState().currentTier?.players;

    expect(result1).not.toBe(result2);
    expect(result1?.[0].name).toBe('Old');
    expect(result2?.[0].name).toBe('New');
  });
});
