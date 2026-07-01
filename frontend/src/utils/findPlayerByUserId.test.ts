import { describe, it, expect } from 'vitest';
import { findPlayerByUserId } from './findPlayerByUserId';
import type { SnapshotPlayer } from '../types';

const players = [
  { id: 'p1', userId: 'u1', role: 'tank' },
  { id: 'p2', userId: null, role: 'healer' },
  { id: 'p3', userId: 'u3', role: 'melee' },
] as unknown as SnapshotPlayer[];

describe('findPlayerByUserId', () => {
  it('returns the player whose userId matches', () => {
    expect(findPlayerByUserId(players, 'u3')?.id).toBe('p3');
  });
  it('returns undefined for no match / null / empty', () => {
    expect(findPlayerByUserId(players, 'nope')).toBeUndefined();
    expect(findPlayerByUserId(players, null)).toBeUndefined();
    expect(findPlayerByUserId([], 'u1')).toBeUndefined();
  });
});
