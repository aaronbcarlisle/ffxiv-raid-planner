import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
  scopedWeek: 3, canEdit: true,
  onAssignGear: vi.fn(),
  onAssignMaterial: vi.fn(),
};

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

  it('disables a material row Assign when the row has zero needers (no-op guard)', () => {
    // Fully raid-geared player with no tome pieces and no tome weapon → neither
    // Floor 2 material (glaze / universal_tomestone) has a needer.
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
    expect(assign).toBeDisabled();
    fireEvent.click(assign);
    expect(onAssignMaterial).not.toHaveBeenCalled();
  });

  it('accepts a distinct currentWeek prop for the enhance context and still renders', () => {
    // scopedWeek governs the status chip; currentWeek only feeds enhanced scoring.
    const players = [makePlayer('a', 'Alice', { earringHas: false })];
    render(<FloorCard {...baseProps} players={players} scopedWeek={2} currentWeek={5} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
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
