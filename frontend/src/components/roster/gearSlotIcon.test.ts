/**
 * gearSlotIcon — unit tests
 *
 * Pins the icon treatment shared by BOTH card densities. The class strings are
 * the expanded table's already-shipped behaviour (moved here verbatim from
 * `RosterGearTable`), so these tests are what stop the compact strip and the
 * table drifting apart.
 */
import { describe, it, expect } from 'vitest';
import { gearSlotIconUrl, gearSlotIconClass, isRealItemIcon, raidNormalizedWeapon } from './gearSlotIcon';
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

describe('raidNormalizedWeapon', () => {
  it('treats the weapon as raid, so its icon agrees with its 2-state circle', () => {
    const tomeWeapon = base({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false });
    // Raw: the icon would dim as "incomplete" while the circle says Complete.
    expect(gearSlotIconClass(tomeWeapon, false)).toBe('brightness-0 invert opacity-50');
    // Normalized: both agree.
    expect(gearSlotIconClass(raidNormalizedWeapon('weapon', tomeWeapon), false)).toBe(
      'brightness-0 invert opacity-90',
    );
  });

  it('leaves every other slot alone', () => {
    const tomeLegs = base({ slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: false });
    expect(raidNormalizedWeapon('legs', tomeLegs)).toBe(tomeLegs);
  });
});
