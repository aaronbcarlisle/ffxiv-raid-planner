import { describe, it, expect } from 'vitest';
import { equippedAverageIlv } from './rosterIlv';
import type { GearSlotStatus } from '../../types';

// Direct coverage for the shared equipped-average helper (C5, D-10). Added at
// PR #193 review round 5: the card and the GearBoard both guard on `> 0`, so a
// non-total helper could return NaN unnoticed — pin the contract here.

const slot = (equippedItemLevel?: number): GearSlotStatus =>
  ({ slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false, equippedItemLevel }) as GearSlotStatus;

describe('equippedAverageIlv', () => {
  it('returns 0 for an empty gear array (never NaN)', () => {
    expect(equippedAverageIlv([])).toBe(0);
  });

  it('averages the synced slots when sync covers at least half the slots', () => {
    expect(equippedAverageIlv([slot(790), slot(780), slot(770), slot(undefined)])).toBe(780);
  });

  it('returns 0 when sync covers fewer than half the slots', () => {
    expect(equippedAverageIlv([slot(790), slot(undefined), slot(undefined), slot(undefined)])).toBe(0);
  });

  it('ignores non-positive equipped levels', () => {
    expect(equippedAverageIlv([slot(0), slot(790), slot(770)])).toBe(780);
  });
});
