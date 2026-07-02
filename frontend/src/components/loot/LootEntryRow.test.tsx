import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LootEntryRow, type HistoryItem } from './LootEntryRow';
import { WeekGroupHeader } from './WeekGroupHeader';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Aria',
    job: 'WHM',
    role: 'healer',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 7,
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M11S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-24T23:59:59Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 3,
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M11S',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    slotAugmented: 'body',
    createdAt: '2026-06-24T23:59:59Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

const floors = ['M9S', 'M10S', 'M11S', 'M12S'];

function openKebab(container: HTMLElement) {
  // Radix DropdownMenu trigger — driven via keyDown per established convention
  // (see WeekScopeControl.test.tsx / RosterToolbar.test.tsx); no user-event dep.
  fireEvent.keyDown(within(container).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
}

describe('LootEntryRow', () => {
  it('renders a loot drop row: R badge, BiS-need tag, recipient name, floor suffix, and id', () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry() };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit />);

    const row = document.getElementById('loot-entry-7');
    expect(row).toBeInTheDocument();
    expect(within(row!).getByTestId('source-badge')).toHaveTextContent('R');
    expect(within(row!).getByText('BiS need')).toBeInTheDocument();
    expect(within(row!).getByText('Aria')).toBeInTheDocument();
    expect(within(row!).getByText(/M11S · F3/)).toBeInTheDocument();
  });

  it('renders T for tome/purchase methods', () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry({ method: 'tome' }) };
    const { rerender } = render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit />);
    expect(within(document.getElementById('loot-entry-7')!).getByTestId('source-badge')).toHaveTextContent('T');

    rerender(
      <LootEntryRow
        item={{ kind: 'loot', entry: makeLootEntry({ method: 'purchase' }) }}
        playersById={players}
        floors={floors}
        canEdit
      />
    );
    expect(within(document.getElementById('loot-entry-7')!).getByTestId('source-badge')).toHaveTextContent('T');
  });

  it('renders "free / sell" and " · extra" when isExtra is true', () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry({ isExtra: true }) };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit />);
    const row = document.getElementById('loot-entry-7')!;
    expect(within(row).getByText('free / sell')).toBeInTheDocument();
    expect(within(row).getByText(/· extra/)).toBeInTheDocument();
  });

  it('renders a material row: A badge, "aug body", and id', () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'material', entry: makeMaterialEntry() };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit />);
    const row = document.getElementById('material-entry-3');
    expect(row).toBeInTheDocument();
    expect(within(row!).getByTestId('source-badge')).toHaveTextContent('A');
    expect(within(row!).getByText('aug body')).toBeInTheDocument();
  });

  it('falls back to the stored recipient name when the player is unknown', () => {
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry({ recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player' }) };
    render(<LootEntryRow item={item} playersById={new Map()} floors={floors} canEdit />);
    expect(screen.getByText('Departed Player')).toBeInTheDocument();
  });

  it('applies the highlight-pulse class when highlighted', () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry() };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit highlighted />);
    expect(document.getElementById('loot-entry-7')).toHaveClass('highlight-pulse');
  });

  it('does not apply highlight-pulse by default', () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry() };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit={false} />);
    expect(document.getElementById('loot-entry-7')).not.toHaveClass('highlight-pulse');
  });

  it('hides Edit and Delete but keeps Copy link when canEdit is false', async () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry() };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit={false} />);
    openKebab(document.getElementById('loot-entry-7')!);
    expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows Edit/Copy link/Delete for a loot row when canEdit is true', async () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry() };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit />);
    openKebab(document.getElementById('loot-entry-7')!);
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides Edit for a material row even when canEdit is true (loot rows only)', async () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'material', entry: makeMaterialEntry() };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit />);
    openKebab(document.getElementById('material-entry-3')!);
    expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('fires onEdit(entry) when the kebab Edit item is selected', async () => {
    const players = new Map([['p1', makePlayer()]]);
    const onEdit = vi.fn();
    const entry = makeLootEntry();
    render(
      <LootEntryRow item={{ kind: 'loot', entry }} playersById={players} floors={floors} canEdit onEdit={onEdit} />
    );
    openKebab(document.getElementById('loot-entry-7')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(entry);
  });

  it('fires onCopyLink(item) when Copy link is selected', async () => {
    const players = new Map([['p1', makePlayer()]]);
    const onCopyLink = vi.fn();
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry() };
    render(
      <LootEntryRow item={item} playersById={players} floors={floors} canEdit onCopyLink={onCopyLink} />
    );
    openKebab(document.getElementById('loot-entry-7')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }));
    expect(onCopyLink).toHaveBeenCalledWith(item);
  });

  it('fires onDelete(item) when Delete is selected', async () => {
    const players = new Map([['p1', makePlayer()]]);
    const onDelete = vi.fn();
    const item: HistoryItem = { kind: 'material', entry: makeMaterialEntry() };
    render(
      <LootEntryRow item={item} playersById={players} floors={floors} canEdit onDelete={onDelete} />
    );
    openKebab(document.getElementById('material-entry-3')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(item);
  });

  it('renders an em dash for an empty floor', () => {
    const players = new Map([['p1', makePlayer()]]);
    const item: HistoryItem = { kind: 'loot', entry: makeLootEntry({ floor: '' }) };
    render(<LootEntryRow item={item} playersById={players} floors={floors} canEdit />);
    expect(within(document.getElementById('loot-entry-7')!).getByText('—')).toBeInTheDocument();
  });
});

describe('WeekGroupHeader', () => {
  it('shows the week pill and UTC-pinned date range, with accent styling when current', () => {
    render(
      <WeekGroupHeader
        week={2}
        isCurrent
        range={{ start: new Date('2026-06-24T00:30:00Z'), end: new Date('2026-06-30T23:30:00Z') }}
        count={5}
      />
    );
    const pill = screen.getByText('WEEK 2');
    expect(pill).toHaveClass('bg-accent/15', 'text-accent-hover');
    expect(screen.getByText(/Jun 24.*Jun 30/)).toBeInTheDocument();
    expect(screen.getByText('5 drops')).toBeInTheDocument();
  });

  it('uses muted styling and singular "drop" when not current and count is 1', () => {
    render(
      <WeekGroupHeader
        week={1}
        isCurrent={false}
        range={{ start: new Date('2026-06-17T23:59:59Z'), end: new Date('2026-06-23T23:59:59Z') }}
        count={1}
      />
    );
    const pill = screen.getByText('WEEK 1');
    expect(pill).toHaveClass('bg-surface-elevated', 'text-text-secondary');
    expect(screen.getByText('1 drop')).toBeInTheDocument();
  });

  it('omits the date range when range is null', () => {
    render(<WeekGroupHeader week={4} isCurrent={false} range={null} count={0} />);
    expect(screen.getByText('WEEK 4')).toBeInTheDocument();
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });
});
