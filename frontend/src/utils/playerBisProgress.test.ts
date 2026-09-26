import { describe, it, expect } from 'vitest';
import { playerBisProgress } from './playerBisProgress';
import type { GearSlot, GearSlotStatus } from '../types';

const BASE: GearSlot[] = [
  'weapon', 'head', 'body', 'hands', 'legs', 'feet',
  'earring', 'necklace', 'bracelet', 'ring1', 'ring2',
];

function slot(partial: Partial<GearSlotStatus> & { slot: GearSlot }): GearSlotStatus {
  return { bisSource: 'raid', hasItem: false, isAugmented: false, ...partial } as GearSlotStatus;
}

describe('playerBisProgress (R-E2-F)', () => {
  it('counts owned raid slots over the relevant slots', () => {
    const gear = BASE.map((s, i) => slot({ slot: s, hasItem: i < 6 }));
    expect(playerBisProgress({ job: 'DRG', gear })).toEqual({ completed: 6, total: 11 });
  });

  it('a relevant slot with no bisSource is incomplete even when owned, and still counts in the total', () => {
    // bisSlotTotals would drop this slot from BOTH sides; the card definition
    // keeps it in the denominator and never completes it.
    const gear = BASE.map((s) => slot({ slot: s, hasItem: true }));
    gear[1] = slot({ slot: 'head', bisSource: null, hasItem: true });
    expect(playerBisProgress({ job: 'DRG', gear })).toEqual({ completed: 10, total: 11 });
  });

  it('an empty off-hand off-PLD neither counts nor completes', () => {
    const gear = [...BASE.map((s) => slot({ slot: s, hasItem: true })), slot({ slot: 'offhand', bisSource: null })];
    expect(playerBisProgress({ job: 'DRG', gear })).toEqual({ completed: 11, total: 11 });
  });

  it('a PLD off-hand is relevant: it joins the total', () => {
    const gear = [...BASE.map((s) => slot({ slot: s, hasItem: true })), slot({ slot: 'offhand', bisSource: null })];
    expect(playerBisProgress({ job: 'PLD', gear })).toEqual({ completed: 11, total: 12 });
  });

  it('a tome slot needs its augment to complete', () => {
    const gear = BASE.map((s) => slot({ slot: s, hasItem: true }));
    gear[2] = slot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false });
    expect(playerBisProgress({ job: 'DRG', gear })).toEqual({ completed: 10, total: 11 });
  });

  it('falls back to 11 when there are no relevant slots', () => {
    expect(playerBisProgress({ job: 'DRG', gear: [] })).toEqual({ completed: 0, total: 11 });
  });
});
