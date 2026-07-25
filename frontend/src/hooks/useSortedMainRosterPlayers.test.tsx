import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSortedMainRosterPlayers } from './useSortedMainRosterPlayers';
import type { TierSnapshot } from '../types';

const tier = { players: [
  { id: 'a', configured: true, isSubstitute: false, role: 'tank', sortOrder: 1 },
  { id: 'b', configured: false, isSubstitute: false, role: 'healer', sortOrder: 2 },
  { id: 'c', configured: true, isSubstitute: true, role: 'melee', sortOrder: 3 },
] } as unknown as TierSnapshot;

describe('useSortedMainRosterPlayers', () => {
  it('returns only configured, non-substitute players', () => {
    const { result } = renderHook(() => useSortedMainRosterPlayers(tier));
    expect(result.current.map(p => p.id)).toEqual(['a']);
  });
  it('returns [] for null tier', () => {
    const { result } = renderHook(() => useSortedMainRosterPlayers(null));
    expect(result.current).toEqual([]);
  });
});
