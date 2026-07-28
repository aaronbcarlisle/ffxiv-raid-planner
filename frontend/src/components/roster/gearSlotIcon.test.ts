/**
 * gearSlotIcon — unit tests
 *
 * Pins the icon treatment shared by BOTH card densities. The class strings are
 * the expanded table's already-shipped behaviour (moved here verbatim from
 * `RosterGearTable`), so these tests are what stop the compact strip and the
 * table drifting apart.
 */
import { describe, it, expect } from 'vitest';
import { gearSlotIconUrl, gearSlotIconClass, isRealItemIcon } from './gearSlotIcon';
import { GEAR_SLOT_ICONS, type GearSlotStatus } from '../../types';

const base = (o: Partial<GearSlotStatus> = {}): GearSlotStatus =>
  ({ slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false, ...o }) as GearSlotStatus;

describe('gearSlotIconUrl', () => {
  it('prefers the real item icon', () => {
    expect(gearSlotIconUrl('head', base({ itemIcon: '/i/123.png' }))).toBe('/i/123.png');
  });

  it('falls back to the slot placeholder', () => {
    expect(gearSlotIconUrl('head', base())).toBe(GEAR_SLOT_ICONS.head);
  });
});

describe('gearSlotIconClass', () => {
  it('greys a missing item icon', () => {
    expect(gearSlotIconClass(base({ itemIcon: '/i/1.png' }), true)).toBe('rounded opacity-50 grayscale');
  });

  it('dims an unaugmented tome item icon', () => {
    expect(gearSlotIconClass(base({ bisSource: 'tome', hasItem: true }), true)).toBe('rounded opacity-75');
  });

  it('leaves a complete item icon untouched', () => {
    expect(gearSlotIconClass(base({ hasItem: true }), true)).toBe('rounded');
  });

  it('inverts a placeholder so it reads on the dark surface', () => {
    expect(gearSlotIconClass(base({ hasItem: true }), false)).toBe('brightness-0 invert opacity-90');
  });

  it('dims a missing placeholder without inverting', () => {
    expect(gearSlotIconClass(base(), false)).toBe('opacity-50');
  });
});

describe('isRealItemIcon', () => {
  it('is true only when the slot carries an item icon', () => {
    expect(isRealItemIcon(base({ itemIcon: '/i/1.png' }))).toBe(true);
    expect(isRealItemIcon(base())).toBe(false);
  });
});
