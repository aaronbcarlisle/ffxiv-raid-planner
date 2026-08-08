import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Capture the enhance CONTEXT: FloorCard must feed `enhancePriorityEntries` the
// same week its status chip derives from — D4/R-15 collapsed the old
// scopedWeek/currentWeek pair into one `currentWeek` prop.
// The mock is a passthrough — with `active: false` the real implementation
// returns the entries unchanged bar breakdowns, which `toRowEntries` ignores,
// so every other test's row derivation is identical.
const { enhanceCalls } = vi.hoisted(() => ({
  enhanceCalls: [] as Array<{ currentWeek: number }>,
}));
vi.mock('../../utils/priorityEntries', () => ({
  enhancePriorityEntries: (entries: unknown[], ctx: { currentWeek: number }) => {
    enhanceCalls.push(ctx);
    return entries;
  },
}));

import { FloorCard } from './FloorCard';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../../types';

function makePlayer(id: string, name: string, opts: {
  sub?: boolean;
  earringHas?: boolean; earringSource?: 'raid' | 'tome';
  ring1Has?: boolean; necklaceHas?: boolean; braceletHas?: boolean;
} = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [
      { slot: 'earring', bisSource: opts.earringSource ?? 'raid', hasItem: opts.earringHas ?? false, isAugmented: false },
      { slot: 'necklace', bisSource: 'raid', hasItem: opts.necklaceHas ?? true, isAugmented: false },
      { slot: 'bracelet', bisSource: 'raid', hasItem: opts.braceletHas ?? true, isAugmented: false },
      { slot: 'ring1', bisSource: 'raid', hasItem: opts.ring1Has ?? true, isAugmented: false },
      { slot: 'ring2', bisSource: 'raid', hasItem: true, isAugmented: false },
    ],
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

const settings = { ...DEFAULT_SETTINGS };
const baseProps = {
  floorNumber: 1 as const, floorName: 'M9S',
  settings,
  lootLog: [] as LootLogEntry[], materialLog: [] as MaterialLogEntry[], pageLedger: [] as PageLedgerEntry[],
  currentWeek: 3, canEdit: true,
  onAssignGear: vi.fn(),
  onAssignMaterial: vi.fn(),
};

beforeEach(() => {
  enhanceCalls.length = 0;
  // jsdom has no matchMedia; FloorDropRow's Why trigger wraps a Tooltip, and
  // Tooltip -> useDevice depends on it (canHover=false here short-circuits
  // Tooltip to a plain passthrough, so it never needs a TooltipProvider).
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

describe('FloorCard', () => {
  it('renders the floor header with the floor name tag, floor number, and drops meta', () => {
    const players = [makePlayer('a', 'Alice')];
    render(<FloorCard {...baseProps} players={players} />);
    expect(screen.getByText('M9S')).toBeInTheDocument();
    expect(screen.getByText('Floor 1')).toBeInTheDocument();
  });

  it('a needer produces a priority chip and the header shows a pending chip', () => {
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    render(<FloorCard {...baseProps} players={players} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/pending/)).toBeInTheDocument();
  });

  it('collapses when everything for the week is logged, and Show expands it', () => {
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    const lootLog: LootLogEntry[] = [
      {
        id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M9S', itemSlot: 'earring',
        recipientPlayerId: 'a', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
        createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
      },
    ];
    render(<FloorCard {...baseProps} players={players} lootLog={lootLog} />);
    // Fully logged + no pending → collapsed: drop rows are not rendered, "Show" appears
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    const show = screen.getByText('Show');
    expect(show).toBeInTheDocument();
    fireEvent.click(show);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('hides Assign buttons when canEdit is false', () => {
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    render(<FloorCard {...baseProps} players={players} canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
  });

  it('keeps a material row Assign enabled with zero needers and falls back to the first roster player (A11)', () => {
    // Fully raid-geared player with no tome pieces and no tome weapon → neither
    // Floor 2 material (glaze / universal_tomestone) has a needer. Assign must
    // still work: the modal's own Select allows immediate reassignment, so the
    // handler fires with players[0] as the suggested recipient.
    const player: SnapshotPlayer = {
      id: 'a', tierSnapshotId: 't1', name: 'Alice', job: 'PLD', role: 'tank',
      configured: true, sortOrder: 0, isSubstitute: false,
      gear: [
        { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'hands', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: false },
      ],
      tomeWeapon: {}, weaponPriorities: [],
    } as unknown as SnapshotPlayer;
    const onAssignMaterial = vi.fn();
    render(
      <FloorCard
        {...baseProps}
        floorNumber={2}
        floorName="M10S"
        players={[player]}
        onAssignMaterial={onAssignMaterial}
      />
    );
    const glazeRow = screen.getByText('Glaze').closest('div.border-b') as HTMLElement;
    const assign = within(glazeRow).getByRole('button', { name: 'Assign' });
    expect(assign).not.toBeDisabled();
    fireEvent.click(assign);
    expect(onAssignMaterial).toHaveBeenCalledWith('glaze', expect.objectContaining({ id: 'a' }));
  });

  it('disables material Assign only when the roster is empty (nobody to assign to)', () => {
    // Degenerate guard pin: with zero configured players, players[0] would be
    // undefined at runtime — the ONLY case the button stays disabled.
    const onAssignMaterial = vi.fn();
    render(
      <FloorCard
        {...baseProps}
        floorNumber={2}
        floorName="M10S"
        players={[]}
        onAssignMaterial={onAssignMaterial}
      />
    );
    const glazeRow = screen.getByText('Glaze').closest('div.border-b') as HTMLElement;
    const assign = within(glazeRow).getByRole('button', { name: 'Assign' });
    expect(assign).toBeDisabled();
    fireEvent.click(assign);
    expect(onAssignMaterial).not.toHaveBeenCalled();
  });

  it('drives BOTH the status chip and the enhance context from the one currentWeek prop (R-15 collapse)', () => {
    // D4/R-15 replaced the scopedWeek + optional currentWeek pair with a single
    // required `currentWeek`. Discriminator for the collapse, using a week the
    // baseProps default (3) can never satisfy:
    //  - status: everything for week 2 is logged → the card collapses. If the
    //    status derivation were fed anything other than the passed week (e.g.
    //    a resurrected second week prop defaulting to 3, where nothing is
    //    logged), the card would render a pending chip and no "Show".
    //  - enhance context: must receive the same 2. If the enhance call were
    //    re-pointed at a different week, this fails.
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    const lootLog: LootLogEntry[] = [
      {
        id: 1, tierSnapshotId: 't1', weekNumber: 2, floor: 'M9S', itemSlot: 'earring',
        recipientPlayerId: 'a', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
        createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
      },
    ];
    render(<FloorCard {...baseProps} players={players} lootLog={lootLog} currentWeek={2} />);

    // Status reflects week 2 (fully logged → collapsed).
    expect(screen.getByText(/logged/)).toBeInTheDocument();
    expect(screen.getByText('Show')).toBeInTheDocument();

    // The enhance context received the very same week for every row.
    expect(enhanceCalls.length).toBeGreaterThan(0);
    enhanceCalls.forEach((ctx) => expect(ctx.currentWeek).toBe(2));
  });

  it('feeds MATERIAL queues that same currentWeek too', () => {
    // Floor 1 has no upgrade materials, so the test above only reaches the
    // enhance context through the gear path (buildRecipientEntries). Floor 2
    // has glaze + universal_tomestone, which run the card's own `enhance()`
    // helper — the second call site, pinned here on the same single prop.
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    render(<FloorCard {...baseProps} floorNumber={2} floorName="M10S" players={players} currentWeek={4} />);
    expect(enhanceCalls.length).toBeGreaterThan(0);
    enhanceCalls.forEach((ctx) => expect(ctx.currentWeek).toBe(4));
  });

  it('drops the duty chip (not doubling "Floor N") when floorName is the fallback', () => {
    // With no tier gamedata the caller passes floorName="Floor 1"; the header
    // must render exactly one "Floor 1", not a chip + heading pair — the
    // duplication the PR #224 review caught at the other two header sites.
    const players = [makePlayer('a', 'Alice')];
    render(<FloorCard {...baseProps} floorName="Floor 1" players={players} />);
    expect(screen.getAllByText('Floor 1')).toHaveLength(1);
  });

  it('never auto-collapses when autoCollapse is false — the solo-scoped card (R-49)', () => {
    // Same fully-logged fixture that collapses above; with autoCollapse=false
    // the rows must stay rendered and no "Show" affordance appears.
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    const lootLog: LootLogEntry[] = [
      {
        id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M9S', itemSlot: 'earring',
        recipientPlayerId: 'a', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
        createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
      },
    ];
    render(<FloorCard {...baseProps} players={players} lootLog={lootLog} autoCollapse={false} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Show')).not.toBeInTheDocument();
  });

  it('carries its floor identity once — accent stripe on the card, floor colour on the header name (R-8/R-45)', () => {
    const players = [makePlayer('a', 'Alice')];
    const { container } = render(<FloorCard {...baseProps} players={players} />);
    // The card wrapper carries the R-45 left accent for its floor…
    expect(container.firstElementChild?.className).toContain('border-l-floor-1');
    // …and the header floor name takes the floor text token.
    expect(screen.getByText('Floor 1').className).toContain('text-floor-1');
  });

  it('gear rows lead with the neutral slot glyph and a floor-coloured name; material rows keep material tokens (R-8/R-19)', () => {
    // Floor 2: gear drops include Head; materials include Glaze.
    const player: SnapshotPlayer = {
      id: 'a', tierSnapshotId: 't1', name: 'Alice', job: 'PLD', role: 'tank',
      configured: true, sortOrder: 0, isSubstitute: false,
      gear: [
        { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
        { slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false },
      ],
      tomeWeapon: {}, weaponPriorities: [],
    } as unknown as SnapshotPlayer;
    render(<FloorCard {...baseProps} floorNumber={2} floorName="M10S" players={[player]} />);

    // Gear name carries the floor colour; no coloured letter square before it.
    const headName = screen.getByText('Head');
    expect(headName.className).toContain('text-floor-2');
    const headRow = headName.closest('div.border-b') as HTMLElement;
    // The leading glyph is the masked GearSlotIcon (bg-current), not a letter.
    expect(headRow.querySelector('.bg-current')).not.toBeNull();
    expect(within(headRow).queryByText('H')).not.toBeInTheDocument();

    // Material rows keep the tokened letter square and a neutral name.
    const glazeName = screen.getByText('Glaze');
    expect(glazeName.className).toContain('text-text-primary');
    const glazeRow = glazeName.closest('div.border-b') as HTMLElement;
    expect(within(glazeRow).getByText('G')).toBeInTheDocument();
  });

  it("a material row's Assign calls onAssignMaterial with the top-priority player", () => {
    // Floor 2 has upgrade materials (glaze + universal_tomestone). Glaze applies to
    // accessory slots (UPGRADE_MATERIAL_SLOTS.glaze) — an unaugmented tome earring
    // needs it. Head/hands/feet (floor 2's gear drops) are all raid+hasItem so this
    // player doesn't also show up as a gear-row needer.
    const player: SnapshotPlayer = {
      id: 'a', tierSnapshotId: 't1', name: 'Alice', job: 'PLD', role: 'tank',
      configured: true, sortOrder: 0, isSubstitute: false,
      gear: [
        { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'hands', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false },
      ],
      tomeWeapon: {}, weaponPriorities: [],
    } as unknown as SnapshotPlayer;
    const onAssignMaterial = vi.fn();
    render(
      <FloorCard
        {...baseProps}
        floorNumber={2}
        floorName="M10S"
        players={[player]}
        onAssignMaterial={onAssignMaterial}
      />
    );
    const glazeRow = screen.getByText('Glaze').closest('div.border-b') as HTMLElement;
    fireEvent.click(within(glazeRow).getByRole('button', { name: 'Assign' }));
    expect(onAssignMaterial).toHaveBeenCalledWith('glaze', player);
  });
});

// D3 Task 5: gear queues swap to buildRecipientEntries (the picker's own
// derivation) and gain a QueueWhy "why this order" trigger. This file mocks
// priorityEntries (see the top of the file), so the mocked enhancePriorityEntries
// is a passthrough — the ORDER-IDENTITY proof that the swap matches the legacy
// pipeline lives in recipientRanking.test.ts (Task 4); these tests only cover
// the button's presence/absence and that chips still flow through the swap.
describe('FloorCard — D3 queue-row QueueWhy trigger (R-6)', () => {
  it('renders a "Why this order…" button for a gear row with a non-empty queue, not for an empty one', () => {
    // Alice needs Ears only (necklace/bracelet/ring already held) — Floor 1
    // has no materials, so the two gear rows alone prove the selectivity.
    // (GEAR_SLOT_NAMES: earring -> "Ears", necklace -> "Neck".)
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    render(<FloorCard {...baseProps} players={players} />);

    const earringRow = screen.getByText('Ears').closest('div.border-b') as HTMLElement;
    expect(within(earringRow).getByRole('button', { name: 'Why this order for Ears' })).toBeInTheDocument();

    const necklaceRow = screen.getByText('Neck').closest('div.border-b') as HTMLElement;
    expect(within(necklaceRow).queryByRole('button', { name: /Why this order/ })).not.toBeInTheDocument();
  });

  it('never renders a Why button on a material row', () => {
    // Floor 2: unaugmented tome earring needs Glaze; head/hands/feet are all
    // raid+hasItem so this player isn't also a gear-row needer.
    const player: SnapshotPlayer = {
      id: 'a', tierSnapshotId: 't1', name: 'Alice', job: 'PLD', role: 'tank',
      configured: true, sortOrder: 0, isSubstitute: false,
      gear: [
        { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'hands', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false },
      ],
      tomeWeapon: {}, weaponPriorities: [],
    } as unknown as SnapshotPlayer;
    render(<FloorCard {...baseProps} floorNumber={2} floorName="M10S" players={[player]} />);
    const glazeRow = screen.getByText('Glaze').closest('div.border-b') as HTMLElement;
    expect(within(glazeRow).queryByRole('button', { name: /Why this order/ })).not.toBeInTheDocument();
  });

  it('canEdit=false still renders the why button (transparency, not mutation)', () => {
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    render(<FloorCard {...baseProps} players={players} canEdit={false} />);
    const earringRow = screen.getByText('Ears').closest('div.border-b') as HTMLElement;
    expect(within(earringRow).getByRole('button', { name: 'Why this order for Ears' })).toBeInTheDocument();
    expect(within(earringRow).queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
  });

  it('queue chips still render name + rank through the derivation swap (smoke)', () => {
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    render(<FloorCard {...baseProps} players={players} />);
    const earringRow = screen.getByText('Ears').closest('div.border-b') as HTMLElement;
    expect(within(earringRow).getByText('Alice')).toBeInTheDocument();
    expect(earringRow.textContent).toContain('#1');
  });
});
