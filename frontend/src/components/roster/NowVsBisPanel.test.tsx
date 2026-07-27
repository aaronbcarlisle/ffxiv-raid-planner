import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NowVsBisPanel } from './NowVsBisPanel';
import type { GearSlotStatus } from '../../types';

// Direct coverage for the panel's per-slot pricing (PR #193 review round 3):
// the RosterCard suite renders the panel through a tooltip trigger with
// synthetic slot names, so none of these branches were exercised there.
// Real tier data (aac-heavyweight): savage 790 · tome 780 · crafted 770
// (non-weapon) — the same constants calculations.test.ts pins.

const slot = (over: Partial<GearSlotStatus>): GearSlotStatus =>
  ({ bisSource: 'raid', hasItem: false, isAugmented: false, ...over }) as GearSlotStatus;

/** The panel row containing the given slot label. */
const row = (label: string) => {
  const el = screen.getByText(label).closest('div');
  expect(el).not.toBeNull();
  return within(el as HTMLElement);
};

describe('NowVsBisPanel', () => {
  const gear: GearSlotStatus[] = [
    // Owned raid piece with an imported level → the import wins.
    slot({ slot: 'head', hasItem: true, itemLevel: 795, equippedItemLevel: 792 }),
    // Owned un-augmented tome → priced at the tier's base-tome level, not the
    // imported (augmented) 790.
    slot({ slot: 'body', bisSource: 'tome', hasItem: true, itemLevel: 790, equippedItemLevel: 780 }),
    // base_tome → base-tome price; no sync data → "—" in the Now column.
    slot({ slot: 'hands', bisSource: 'base_tome', hasItem: true, itemLevel: 790 }),
    // crafted → crafted price, ahead of the import. Legacy's per-slot function
    // has this branch and `calculateAverageItemLevel` (the footer average) does
    // not, so this row can disagree with the average below it — v1 behavior,
    // kept deliberately and recorded on matrix D-10 (review round 10).
    slot({ slot: 'legs', bisSource: 'crafted', hasItem: true, itemLevel: 790, equippedItemLevel: 771 }),
    // UNOWNED with an imported level → the import is ignored and the slot
    // prices at currentSource (the inherited both-shells semantics recorded
    // on matrix D-10 at review round 2).
    slot({ slot: 'feet', itemLevel: 790, currentSource: 'crafted', equippedItemLevel: 765 }),
  ];

  it('prices each slot with the legacy fallback chain (two-column mode)', () => {
    render(<NowVsBisPanel gear={gear} tierId="aac-heavyweight" equippedAvgIlv={777} bisAvgIlv={775} />);

    expect(row('Head').getByText('795')).toBeInTheDocument();
    // Body: the equipped base tome (Now 780) and the base-tome price (BiS 780)
    // agree — two cells, same number.
    expect(row('Body').getAllByText('780')).toHaveLength(2);
    expect(row('Hands').getByText('780')).toBeInTheDocument();
    expect(row('Legs').getByText('770')).toBeInTheDocument();
    expect(row('Feet').getByText('770')).toBeInTheDocument();
  });

  it('renders the Now column: synced values, "—" when un-synced, negative deltas only', () => {
    render(<NowVsBisPanel gear={gear} tierId="aac-heavyweight" equippedAvgIlv={777} bisAvgIlv={775} />);

    // Behind slots carry the (now − bis) delta …
    expect(row('Head').getByText('792')).toBeInTheDocument();
    expect(row('Head').getByText('(-3)')).toBeInTheDocument();
    expect(row('Feet').getByText('765')).toBeInTheDocument();
    expect(row('Feet').getByText('(-5)')).toBeInTheDocument();
    // … at-or-above slots don't …
    expect(row('Legs').getByText('771')).toBeInTheDocument();
    expect(row('Legs').queryByText(/\(/)).not.toBeInTheDocument();
    // … and a slot with no sync data shows the placeholder.
    expect(row('Hands').getByText('—')).toBeInTheDocument();

    expect(screen.getByText('Equipped avg')).toBeInTheDocument();
    expect(screen.getByText('i777')).toBeInTheDocument();
    expect(screen.getByText('BiS target avg')).toBeInTheDocument();
    expect(screen.getByText('i775')).toBeInTheDocument();
  });

  it('collapses to the single-column layout without equipped data', () => {
    render(<NowVsBisPanel gear={gear} tierId="aac-heavyweight" equippedAvgIlv={0} bisAvgIlv={775} />);

    expect(screen.queryByText('Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Equipped avg')).not.toBeInTheDocument();
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('i775')).toBeInTheDocument();
    expect(row('Head').getByText('795')).toBeInTheDocument();
  });
});
