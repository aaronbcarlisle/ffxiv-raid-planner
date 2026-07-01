import { describe, it, expect } from 'vitest';
import { computeGearSlotUpdate } from './calculations';
import type { SnapshotPlayer, GearSlotStatus } from '../types';

function slot(over: Partial<GearSlotStatus>): GearSlotStatus {
  return {
    slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false,
    ...over,
  } as GearSlotStatus;
}

function player(over: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1', name: 'X', job: 'PLD', role: 'tank', configured: true, isSubstitute: false,
    sortOrder: 0, tomeWeapon: {} as SnapshotPlayer['tomeWeapon'],
    weaponPriorities: [], gear: [], ...over,
  } as SnapshotPlayer;
}

describe('computeGearSlotUpdate', () => {
  it('recalcs currentSource to savage when a raid slot gains the item', () => {
    const p = player({ gear: [slot({ slot: 'head', bisSource: 'raid' })] });
    const out = computeGearSlotUpdate(p, 'head', { hasItem: true });
    expect(out.gear?.[0].hasItem).toBe(true);
    expect(out.gear?.[0].currentSource).toBe('savage');
    expect(out.weaponPriorities).toBeUndefined(); // non-weapon → no sync
  });

  it('recalcs currentSource to tome / tome_up for a tome slot by augmentation', () => {
    const p = player({ gear: [slot({ slot: 'legs', bisSource: 'tome' })] });
    expect(computeGearSlotUpdate(p, 'legs', { hasItem: true, isAugmented: false }).gear?.[0].currentSource).toBe('tome');
    expect(computeGearSlotUpdate(p, 'legs', { hasItem: true, isAugmented: true }).gear?.[0].currentSource).toBe('tome_up');
  });

  it('reverts currentSource to crafted when the item is removed', () => {
    const p = player({ gear: [slot({ slot: 'head', bisSource: 'raid', hasItem: true, currentSource: 'savage' })] });
    expect(computeGearSlotUpdate(p, 'head', { hasItem: false }).gear?.[0].currentSource).toBe('crafted');
  });

  it('syncs the main-job weapon priority when the raid weapon is obtained', () => {
    const p = player({
      gear: [slot({ slot: 'weapon', bisSource: 'raid' })],
      weaponPriorities: [{ job: 'PLD', priority: 1, received: false } as SnapshotPlayer['weaponPriorities'][number]],
    });
    const out = computeGearSlotUpdate(p, 'weapon', { hasItem: true });
    expect(out.weaponPriorities?.[0].received).toBe(true);
    expect(out.weaponPriorities?.[0].receivedDate).toBeTruthy();
  });

  it('does not include weaponPriorities when the weapon status is unchanged', () => {
    const p = player({
      gear: [slot({ slot: 'weapon', bisSource: 'raid' })],
      weaponPriorities: [{ job: 'PLD', priority: 1, received: false } as SnapshotPlayer['weaponPriorities'][number]],
    });
    // no hasItem in updates → not a hasItem change → no sync
    expect(computeGearSlotUpdate(p, 'weapon', { isAugmented: true }).weaponPriorities).toBeUndefined();
  });
});
