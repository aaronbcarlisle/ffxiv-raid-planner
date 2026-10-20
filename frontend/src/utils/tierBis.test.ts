import { describe, it, expect } from 'vitest';
import {
  tierBisBreakdown,
  tierBisCell,
  tierBisTotals,
  tierStatusText,
  type TierBisCell,
} from './tierBis';
import { playerBisProgress } from './playerBisProgress';
import { GEAR_SLOTS } from '../types';
import type { GearSlot, GearSlotStatus, SnapshotPlayer } from '../types';

type P = Pick<SnapshotPlayer, 'job' | 'gear'>;

const BASE: GearSlot[] = [
  'weapon', 'head', 'body', 'hands', 'legs', 'feet',
  'earring', 'necklace', 'bracelet', 'ring1', 'ring2',
];

function slot(partial: Partial<GearSlotStatus> & { slot: GearSlot }): GearSlotStatus {
  return { bisSource: 'raid', hasItem: false, isAugmented: false, ...partial } as GearSlotStatus;
}

/** 6 done (raid, base_tome, crafted, augmented tome, raid, raid), 2 tome had un-augmented, 3 not had. */
function drgMixed(): P {
  return {
    job: 'DRG',
    gear: [
      slot({ slot: 'weapon', bisSource: 'raid', hasItem: true }),
      slot({ slot: 'head', bisSource: 'base_tome', hasItem: true }),
      slot({ slot: 'body', bisSource: 'crafted', hasItem: true }),
      slot({ slot: 'hands', bisSource: 'tome', hasItem: true, isAugmented: true }),
      slot({ slot: 'legs', bisSource: 'raid', hasItem: true }),
      slot({ slot: 'feet', bisSource: 'raid', hasItem: true }),
      slot({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }),
      slot({ slot: 'necklace', bisSource: 'tome', hasItem: true, isAugmented: false }),
      slot({ slot: 'bracelet', bisSource: 'raid', hasItem: false }),
      slot({ slot: 'ring1', bisSource: 'raid', hasItem: false }),
      slot({ slot: 'ring2', bisSource: 'raid', hasItem: false }),
    ],
  };
}

/** Every slot had; one legacy `tome` slot whose itemName has no "Aug." prefix. */
function legacyTome(): P {
  const gear = BASE.map((s) => slot({ slot: s, hasItem: true }));
  gear[3] = slot({ slot: 'hands', bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Quetzalli Gloves of Maiming' });
  // A legacy tome whose name DOES carry the prefix still needs the augment.
  gear[4] = slot({ slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Quetzalli Trousers of Maiming' });
  return { job: 'DRG', gear };
}

/** Every slot had, but head has no BiS target. */
function noSourceHad(): P {
  const gear = BASE.map((s) => slot({ slot: s, hasItem: true }));
  gear[1] = slot({ slot: 'head', bisSource: null, hasItem: true, isAugmented: true });
  return { job: 'DRG', gear };
}

function withOffhand(job: string, off: Partial<GearSlotStatus>): P {
  const gear = BASE.map((s) => slot({ slot: s, hasItem: true }));
  gear.splice(1, 0, slot({ slot: 'offhand', bisSource: null, ...off }));
  return { job, gear };
}

function noTargets(): P {
  return { job: 'DRG', gear: BASE.map((s, i) => slot({ slot: s, bisSource: null, hasItem: i % 2 === 0 })) };
}

function emptyGear(): P {
  return { job: 'DRG', gear: [] };
}

/** The week-1 state: every slot has a raid target, nothing is had yet. */
function targetsNothingDone(): P {
  return { job: 'DRG', gear: BASE.map((s) => slot({ slot: s, bisSource: 'raid', hasItem: false })) };
}

/** Classes interleaved in gear order (PLD so the off-hand is relevant). */
function pldInterleaved(): P {
  return {
    job: 'PLD',
    gear: GEAR_SLOTS.map((s, i) => {
      if (i % 3 === 0) return slot({ slot: s, bisSource: 'raid', hasItem: true });
      if (i % 3 === 1) return slot({ slot: s, bisSource: 'tome', hasItem: true, isAugmented: false });
      return slot({ slot: s, bisSource: 'raid', hasItem: false });
    }),
  };
}

const FIXTURES: Record<string, () => P> = {
  drgMixed,
  legacyTome,
  noSourceHad,
  pldEmptyOffhand: () => withOffhand('PLD', {}),
  warEmptyOffhand: () => withOffhand('WAR', {}),
  warOffhandWithSource: () => withOffhand('WAR', { bisSource: 'raid', hasItem: false }),
  noTargets,
  emptyGear,
  pldInterleaved,
  targetsNothingDone,
};

function cell(partial: Partial<TierBisCell>): TierBisCell {
  return { done: 0, needsAugment: 0, toGo: 0, total: 11, hasTargets: true, ...partial };
}

describe('tierBisCell (R-T-1)', () => {
  it('splits a DRG into 6 done, 2 needs augment, 3 to go', () => {
    expect(tierBisCell(drgMixed())).toEqual({ done: 6, needsAugment: 2, toGo: 3, total: 11, hasTargets: true });
  });

  it('a legacy tome slot without "Aug." in its name is done when had; one with "Aug." needs the augment', () => {
    expect(tierBisCell(legacyTome())).toEqual({ done: 10, needsAugment: 1, toGo: 0, total: 11, hasTargets: true });
  });

  it('a slot with no bisSource counts in total and to go, never done or needs augment, even when had', () => {
    expect(tierBisCell(noSourceHad())).toEqual({ done: 10, needsAugment: 0, toGo: 1, total: 11, hasTargets: true });
  });

  it('PLD with an empty off-hand: total 12, the off-hand is to go', () => {
    expect(tierBisCell(withOffhand('PLD', {}))).toEqual({ done: 11, needsAugment: 0, toGo: 1, total: 12, hasTargets: true });
  });

  it('WAR with an empty off-hand: total 11, the off-hand is ignored', () => {
    expect(tierBisCell(withOffhand('WAR', {}))).toEqual({ done: 11, needsAugment: 0, toGo: 0, total: 11, hasTargets: true });
  });

  it('WAR whose off-hand carries a bisSource: total 12', () => {
    expect(tierBisCell(withOffhand('WAR', { bisSource: 'raid', hasItem: false })))
      .toEqual({ done: 11, needsAugment: 0, toGo: 1, total: 12, hasTargets: true });
  });

  it('no targets at all: hasTargets false, done 0, every slot to go', () => {
    expect(tierBisCell(noTargets())).toEqual({ done: 0, needsAugment: 0, toGo: 11, total: 11, hasTargets: false });
  });

  it('targets set but nothing done (week 1): hasTargets true, every slot to go', () => {
    expect(tierBisCell(targetsNothingDone())).toEqual({ done: 0, needsAugment: 0, toGo: 11, total: 11, hasTargets: true });
  });

  it('empty gear: total 11 and toGo 11, computed directly while the breakdown lists are empty', () => {
    expect(tierBisCell(emptyGear())).toEqual({ done: 0, needsAugment: 0, toGo: 11, total: 11, hasTargets: false });
    expect(tierBisBreakdown(emptyGear())).toEqual({ done: [], needsAugment: [], toGo: [] });
  });
});

describe('tierBisCell agreement with playerBisProgress (R-T-1)', () => {
  for (const [name, make] of Object.entries(FIXTURES)) {
    it(`${name}: done/total match playerBisProgress and the three classes sum to total`, () => {
      const p = make();
      const c = tierBisCell(p);
      const ref = playerBisProgress(p);
      expect(c.done).toBe(ref.completed);
      expect(c.total).toBe(ref.total);
      expect(c.done + c.needsAugment + c.toGo).toBe(c.total);
    });
  }
});

describe('tierBisBreakdown (R-T-1)', () => {
  it('lists the DRG slots by class in gear order', () => {
    expect(tierBisBreakdown(drgMixed())).toEqual({
      done: ['weapon', 'head', 'body', 'hands', 'legs', 'feet'],
      needsAugment: ['earring', 'necklace'],
      toGo: ['bracelet', 'ring1', 'ring2'],
    });
  });

  it('keeps gear order when classes interleave, off-hand included for PLD', () => {
    const order = GEAR_SLOTS;
    expect(tierBisBreakdown(pldInterleaved())).toEqual({
      done: order.filter((_, i) => i % 3 === 0),
      needsAugment: order.filter((_, i) => i % 3 === 1),
      toGo: order.filter((_, i) => i % 3 === 2),
    });
  });

  it('drops an irrelevant WAR off-hand and lists a PLD one as to go', () => {
    expect(tierBisBreakdown(withOffhand('WAR', {})).toGo).not.toContain('offhand');
    expect(tierBisBreakdown(withOffhand('PLD', {})).toGo).toEqual(['offhand']);
  });

  it('a had slot with no bisSource is to go; a legacy un-prefixed tome is done', () => {
    expect(tierBisBreakdown(noSourceHad()).toGo).toEqual(['head']);
    const legacy = tierBisBreakdown(legacyTome());
    expect(legacy.done).toContain('hands');
    expect(legacy.needsAugment).toEqual(['legs']);
  });

  for (const [name, make] of Object.entries(FIXTURES)) {
    if (name === 'emptyGear') continue;
    it(`${name}: each relevant slot lands in exactly one list`, () => {
      const p = make();
      const b = tierBisBreakdown(p);
      const all = [...b.done, ...b.needsAugment, ...b.toGo];
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBe(tierBisCell(p).total);
      const c = tierBisCell(p);
      expect([b.done.length, b.needsAugment.length, b.toGo.length]).toEqual([c.done, c.needsAugment, c.toGo]);
    });
  }
});

describe('tierBisTotals (R-T-2, D-7)', () => {
  it('sums cells with targets; nulls and hasTargets:false cells add nothing', () => {
    const cells = [
      cell({ done: 6, needsAugment: 2, toGo: 3, total: 11 }),
      null, // a substitute
      cell({ done: 0, toGo: 11, total: 11, hasTargets: false }),
      null, // Not on the roster
      cell({ done: 3, toGo: 9, total: 12 }),
    ];
    expect(tierBisTotals(cells)).toEqual({ done: 9, total: 23, anySet: true });
  });

  it('a counted cell with nothing done still counts its total and sets anySet', () => {
    expect(tierBisTotals([cell({ done: 0, toGo: 11, total: 11 })]))
      .toEqual({ done: 0, total: 11, anySet: true });
  });

  it('anySet false when no cell has targets', () => {
    expect(tierBisTotals([null, cell({ done: 2, total: 11, hasTargets: false }), null]))
      .toEqual({ done: 0, total: 0, anySet: false });
  });

  it('anySet false for an empty roster', () => {
    expect(tierBisTotals([])).toEqual({ done: 0, total: 0, anySet: false });
  });
});

describe('tierStatusText (R-T-2, E-2)', () => {
  const set = { done: 23, total: 77, anySet: true };
  const none = { done: 0, total: 0, anySet: false };

  it('slots, week and floors joined by " · "', () => {
    expect(tierStatusText({ totals: set, week: 11, floors: { cleared: 0, of: 4 } }))
      .toBe('23/77 BiS slots · Week 11 · 0 of 4 floors cleared');
  });

  it('week null drops both the week and the floors', () => {
    expect(tierStatusText({ totals: set, week: null, floors: { cleared: 0, of: 4 } })).toBe('23/77 BiS slots');
  });

  it('floors null drops only the floors', () => {
    expect(tierStatusText({ totals: set, week: 11, floors: null })).toBe('23/77 BiS slots · Week 11');
  });

  it('nothing set reads "No BiS set"', () => {
    expect(tierStatusText({ totals: none, week: 11, floors: { cleared: 1, of: 4 } }))
      .toBe('No BiS set · Week 11 · 1 of 4 floors cleared');
  });
});
