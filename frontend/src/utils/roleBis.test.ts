import { describe, it, expect } from 'vitest';
import { bisByRole } from './roleBis';
import type { SnapshotPlayer } from '../types';

// one tank: 1/2 BiS slots obtained; one healer: 0/2; melee role empty
const players = [
  {
    role: 'tank',
    configured: true,
    isSubstitute: false,
    gear: [
      { slot: 'weapon', bisSource: 'raid', hasItem: true },
      { slot: 'head', bisSource: 'tome', hasItem: false },
    ],
  },
  {
    role: 'healer',
    configured: true,
    isSubstitute: false,
    gear: [
      { slot: 'weapon', bisSource: 'raid', hasItem: false },
      { slot: 'head', bisSource: 'raid', hasItem: false },
    ],
  },
] as unknown as SnapshotPlayer[];

describe('bisByRole', () => {
  it('sums obtained/total BiS slots per role', () => {
    const out = bisByRole(players);
    expect(out.find((r) => r.role === 'tank')).toEqual({ role: 'tank', obtained: 1, total: 2 });
    expect(out.find((r) => r.role === 'healer')).toEqual({ role: 'healer', obtained: 0, total: 2 });
  });

  it('returns all five roles in fixed order, with empty roles at 0/0', () => {
    const out = bisByRole(players);
    expect(out.map((r) => r.role)).toEqual(['tank', 'healer', 'melee', 'ranged', 'caster']);
    // melee/ranged/caster have no players → 0/0
    expect(out.find((r) => r.role === 'melee')).toEqual({ role: 'melee', obtained: 0, total: 0 });
    expect(out.find((r) => r.role === 'ranged')).toEqual({ role: 'ranged', obtained: 0, total: 0 });
    expect(out.find((r) => r.role === 'caster')).toEqual({ role: 'caster', obtained: 0, total: 0 });
  });

  it('excludes substitute and unconfigured players, and gear slots without a bisSource', () => {
    const mixed = [
      // configured tank: 1 BiS slot (weapon), the null-bisSource slot does not count
      {
        role: 'tank',
        configured: true,
        isSubstitute: false,
        gear: [
          { slot: 'weapon', bisSource: 'raid', hasItem: true },
          { slot: 'head', bisSource: null, hasItem: true },
        ],
      },
      // substitute tank — excluded entirely
      {
        role: 'tank',
        configured: true,
        isSubstitute: true,
        gear: [{ slot: 'weapon', bisSource: 'raid', hasItem: true }],
      },
      // unconfigured tank — excluded entirely
      {
        role: 'tank',
        configured: false,
        isSubstitute: false,
        gear: [{ slot: 'weapon', bisSource: 'raid', hasItem: true }],
      },
    ] as unknown as SnapshotPlayer[];

    expect(bisByRole(mixed).find((r) => r.role === 'tank')).toEqual({
      role: 'tank',
      obtained: 1,
      total: 1,
    });
  });
});
