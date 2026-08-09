import { describe, it, expect } from 'vitest';
import { isOffhandRelevant, offhandSlotHasData, relevantGear } from './offhand';
import type { GearSlotStatus } from '../types';

function slot(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return { slot: 'offhand', bisSource: null, hasItem: false, isAugmented: false, ...overrides };
}

const emptyOffhand = slot();
const baseGear: GearSlotStatus[] = [
  { slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false },
  emptyOffhand,
  { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
];

describe('isOffhandRelevant', () => {
  it('PLD is relevant even with an empty offhand entry', () => {
    expect(isOffhandRelevant('PLD', baseGear)).toBe(true);
  });

  it('lowercase job strings are normalized (backend circulates "pld")', () => {
    expect(isOffhandRelevant('pld', baseGear)).toBe(true);
  });

  it('a non-offhand job with an empty entry is irrelevant', () => {
    expect(isOffhandRelevant('DRG', baseGear)).toBe(false);
    expect(isOffhandRelevant(undefined, baseGear)).toBe(false);
  });

  it.each([
    ['bisSource', { bisSource: 'raid' as const }],
    ['hasItem', { hasItem: true }],
    ['isAugmented', { isAugmented: true }],
    ['itemId', { itemId: 49679 }],
    ['itemName', { itemName: "Grand Champion's Kite Shield" }],
    ['equippedItemId', { equippedItemId: 49679 }],
    ['equippedItemName', { equippedItemName: "Grand Champion's Kite Shield" }],
  ])('any data field makes a non-offhand job relevant: %s', (_name, dataOverride) => {
    const gear = [baseGear[0], slot(dataOverride as Partial<GearSlotStatus>), baseGear[2]];
    expect(isOffhandRelevant('WHM', gear)).toBe(true);
  });
});

describe('relevantGear', () => {
  it('drops an irrelevant offhand entry', () => {
    const result = relevantGear('DRG', baseGear);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.slot === 'offhand')).toBeUndefined();
  });

  it('keeps the offhand for PLD', () => {
    expect(relevantGear('PLD', baseGear)).toHaveLength(3);
  });

  it('keeps a data-bearing offhand for any job', () => {
    const gear = [baseGear[0], slot({ hasItem: true }), baseGear[2]];
    expect(relevantGear('SGE', gear)).toHaveLength(3);
  });

  it('returns the input unchanged when no offhand entry exists at all', () => {
    const gear = [baseGear[0], baseGear[2]];
    expect(relevantGear('DRG', gear)).toBe(gear);
  });
});

describe('offhandSlotHasData', () => {
  it('an undefined or empty entry has no data', () => {
    expect(offhandSlotHasData(undefined)).toBe(false);
    expect(offhandSlotHasData(emptyOffhand)).toBe(false);
  });
});
