import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { GearBoard } from './GearBoard';
import type { SnapshotPlayer, GearSlotStatus, GearSlot } from '../../types';

const SLOTS: GearSlot[] = ['weapon','head','body','hands','legs','feet','earring','necklace','bracelet','ring1','ring2'];

function gear(obtained: number): GearSlotStatus[] {
  return SLOTS.map((slot, i) => ({
    slot, bisSource: 'raid', hasItem: i < obtained, isAugmented: false,
  })) as GearSlotStatus[];
}

function player(over: Partial<SnapshotPlayer>): SnapshotPlayer {
  return {
    id: 'p', name: 'P', job: 'PLD', role: 'tank', position: 'T1', configured: true,
    isSubstitute: false, sortOrder: 0, tomeWeapon: { enabled: false, pursuing: false, hasItem: false, isAugmented: false } as SnapshotPlayer['tomeWeapon'],
    weaponPriorities: [], gear: gear(11), ...over,
  } as SnapshotPlayer;
}

const noop = () => ({ onUpdate: vi.fn() });

/** Owner-level gate — every row editable (replaces the old bare `canManage`). */
const OWNER_GATE = { userRole: 'owner', currentUserId: 'u-owner', isAdminAccess: false } as const;

describe('GearBoard', () => {
  it('renders a party-divider row and a player row per configured player', () => {
    render(<GearBoard players={[player({ id: 'a', name: 'Tank One' })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.getByText('Light Party 1')).toBeInTheDocument();
    expect(screen.getByText('Tank One')).toBeInTheDocument();
  });

  it('shows the X/11 BiS summary', () => {
    render(<GearBoard players={[player({ id: 'a', gear: gear(7) })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('row subtitle iLvl goes equipped-first when sync data covers half the slots (C5)', () => {
    // The Board must agree with the card headline: equipped average when
    // Lodestone/Tomestone data covers >= ceil(11/2) slots, BiS-target avg
    // otherwise. 6 slots at 730 -> "· 730" in the identity subtitle.
    const synced = player({
      id: 'a',
      gear: SLOTS.map((slot, i) => ({
        slot,
        bisSource: 'raid',
        hasItem: false,
        isAugmented: false,
        equippedItemLevel: i < 6 ? 730 : undefined,
      })) as GearSlotStatus[],
    });
    render(<GearBoard players={[synced]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.getByText(/730/)).toBeInTheDocument();
  });

  it('a PLD roster grows the OFFH column; a shield-free roster stays at 11 columns (D2)', () => {
    // player() defaults to job PLD with 11-slot gear — offhand-relevant, so
    // the OFFH column appears between WPN and HEAD.
    const { unmount } = render(<GearBoard players={[player({ id: 'a' })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    let heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toContain('OffH');
    expect(heads.indexOf('OffH')).toBe(heads.indexOf('Wpn') + 1);
    unmount();

    render(<GearBoard players={[player({ id: 'a', job: 'DRG' })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).not.toContain('OffH');
    // 11 slot heads + Player + BiS
    expect(heads).toHaveLength(13);
  });

  it('an unconfigured PLD does not summon the OFFH column (rows drive columns)', () => {
    render(
      <GearBoard
        players={[player({ id: 'a', job: 'DRG' }), player({ id: 'b', job: 'PLD', configured: false })]}
        {...OWNER_GATE}
        actionsForPlayer={noop}
      />
    );
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('OffH');
  });

  it('the party-divider colSpan tracks the column count (12-column roster)', () => {
    const { container } = render(<GearBoard players={[player({ id: 'a' })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    // 12 slot columns + 2 (Player, BiS)
    expect(container.querySelector('td[colspan="14"]')).not.toBeNull();
  });

  it('renders the "No BiS imported" row when a player has no BiS-target slots', () => {
    const noBis = player({ id: 'z', name: 'Caster One', gear: SLOTS.map((slot) => ({ slot, bisSource: null, hasItem: false, isAugmented: false })) as GearSlotStatus[] });
    render(<GearBoard players={[noBis]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.getByText(/No BiS imported/i)).toBeInTheDocument();
  });

  it('cycling a cell calls the per-player onUpdate with a gear patch', () => {
    const onUpdate = vi.fn();
    const factory = () => ({ onUpdate });
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} {...OWNER_GATE} actionsForPlayer={factory} />);
    const cells = screen.getAllByRole('checkbox');
    fireEvent.click(cells[0]); // first raid slot: missing -> have
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0];
    expect(patch.gear[0].hasItem).toBe(true);
  });

  it('is read-only for a member on a row they do not own (cells non-interactive)', () => {
    const onUpdate = vi.fn();
    render(<GearBoard players={[player({ id: 'a', gear: gear(0), userId: 'u-someone-else' })]} userRole="member" currentUserId="u-member" isAdminAccess={false} actionsForPlayer={() => ({ onUpdate })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('renders exactly one next-upgrade glyph for the player/slot in `priorities`', () => {
    const priorities = new Map<string, Set<GearSlot>>([['a', new Set<GearSlot>(['body'])]]);
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} {...OWNER_GATE} actionsForPlayer={noop} priorities={priorities} />);
    expect(screen.getAllByText('●')).toHaveLength(1);
  });

  it('renders no next-upgrade glyphs when `priorities` is omitted', () => {
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.queryByText('●')).not.toBeInTheDocument();
  });

  it('swallows a rejected onUpdate without an unhandled promise rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('api failed'));
    const factory = () => ({ onUpdate });
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} {...OWNER_GATE} actionsForPlayer={factory} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });

  // A2 (member gear self-edit): the gate must be PER ROW, not screen-wide.
  // A member with a claimed player edits their OWN row's cells while another
  // player's row in the SAME render stays inert — this is the test that
  // proves the screen-wide canManage bug dead.
  it('gates per ROW: a member cycles their own claimed row while another row in the same render stays inert', () => {
    const ownUpdate = vi.fn();
    const otherUpdate = vi.fn();
    const own = player({ id: 'own', name: 'Own Player', userId: 'u-member', gear: gear(0) });
    const other = player({
      id: 'other', name: 'Other Player', job: 'WHM', role: 'healer', position: 'H1',
      userId: 'u-someone-else', gear: gear(0),
    });
    render(
      <GearBoard
        players={[own, other]}
        userRole="member"
        currentUserId="u-member"
        isAdminAccess={false}
        actionsForPlayer={(p) => ({ onUpdate: p.id === 'own' ? ownUpdate : otherUpdate })}
      />,
    );

    const ownRow = screen.getByText('Own Player').closest('tr');
    const otherRow = screen.getByText('Other Player').closest('tr');
    expect(ownRow).not.toBeNull();
    expect(otherRow).not.toBeNull();

    // Own claimed row (player.userId === currentUserId): cells interactive.
    const ownCell = within(ownRow as HTMLElement).getAllByRole('checkbox')[0];
    expect(ownCell).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(ownCell);
    expect(ownUpdate).toHaveBeenCalledTimes(1);

    // Another player's row, SAME render: cells inert, click is a no-op.
    const otherCell = within(otherRow as HTMLElement).getAllByRole('checkbox')[0];
    expect(otherCell).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(otherCell);
    expect(otherUpdate).not.toHaveBeenCalled();
  });

  it('the role border reads the role token with a muted fallback, not a hex literal', () => {
    render(<GearBoard players={[player({ id: 'a', name: 'Tank One' })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    const identityCell = screen.getByText('Tank One').closest('td') as HTMLElement;
    expect(identityCell.getAttribute('style')).toContain('var(--color-role-tank, var(--color-text-muted))');
    expect(identityCell.getAttribute('style')).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

// R-E1-E: one roving tab stop, arrows move it, keyed by { playerId, slot }.
describe('GearBoard keyboard (R-E1-E)', () => {
  /** Non-PLD by default so the roster renders exactly the 11 base columns. */
  const p = (id: string, position: NonNullable<SnapshotPlayer['position']>, over: Partial<SnapshotPlayer> = {}) =>
    player({ id, name: `Player ${id}`, job: 'DRG', role: 'melee', position, ...over });
  const noBisGear = () => SLOTS.map((slot) => ({ slot, bisSource: null, hasItem: false, isAugmented: false })) as GearSlotStatus[];
  const MEMBER_GATE = { userRole: 'member', currentUserId: 'u-me', isAdminAccess: false } as const;
  /** The row's cells in column order (a no-BiS row has none). */
  const rowCells = (name: string) => within(screen.getByText(name).closest('tr') as HTMLElement).getAllByRole('checkbox');
  /** The board cells in the Tab sequence — the roving stop, so at most one. */
  const tabStops = () => screen.queryAllByRole('checkbox').filter((c) => c.getAttribute('tabindex') === '0');
  const focus = (el: HTMLElement) => act(() => el.focus());

  it('T2-b5: exactly one board cell sits in the Tab sequence between two sentinels', () => {
    render(
      <>
        <button type="button">before</button>
        <GearBoard players={[p('a', 'M1'), p('b', 'H1')]} {...OWNER_GATE} actionsForPlayer={noop} />
        <button type="button">after</button>
      </>,
    );
    // jsdom has no sequential focus navigation: emulate Tab as "the next
    // element in document order whose tabIndex is >= 0".
    const tab = () => {
      const order = Array.from(document.body.querySelectorAll<HTMLElement>('button, [tabindex]')).filter((el) => el.tabIndex >= 0);
      focus(order[order.indexOf(document.activeElement as HTMLElement) + 1]);
    };
    focus(screen.getByText('before'));
    tab();
    expect(document.activeElement).toHaveAttribute('role', 'checkbox');
    expect(rowCells('Player a')).toContain(document.activeElement);
    tab();
    expect(document.activeElement).toBe(screen.getByText('after'));
    expect(tabStops()).toHaveLength(1);
  });

  it('T2-b6: ArrowDown crosses a section divider and a no-BiS row to the same column', () => {
    // LP1: a (live) · divider · LP2: b (no BiS → spanning row, no cells) · c (live)
    render(<GearBoard players={[p('a', 'M1'), p('b', 'T2', { gear: noBisGear() }), p('c', 'H2')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    const from = rowCells('Player a')[3];
    focus(from);
    expect(fireEvent.keyDown(from, { key: 'ArrowDown' })).toBe(false); // defaultPrevented: focus moved
    expect(document.activeElement).toBe(rowCells('Player c')[3]);
    expect(tabStops()).toEqual([rowCells('Player c')[3]]);
  });

  it('T2-b6 (non-editable variant): ArrowDown/ArrowUp skip a divider and a row the member cannot edit', () => {
    // b's cells are rendered (tabIndex -1, aria-disabled) but inert — the DOM
    // has checkboxes there, so the skip must come from the grid, not the DOM.
    render(
      <GearBoard
        players={[p('a', 'M1', { userId: 'u-me' }), p('b', 'T2', { userId: 'u-other' }), p('c', 'H2', { userId: 'u-me' })]}
        {...MEMBER_GATE}
        actionsForPlayer={noop}
      />,
    );
    expect(rowCells('Player b')[3]).toHaveAttribute('aria-disabled', 'true');
    const from = rowCells('Player a')[3];
    focus(from);
    expect(fireEvent.keyDown(from, { key: 'ArrowDown' })).toBe(false);
    expect(document.activeElement).toBe(rowCells('Player c')[3]);
    expect(fireEvent.keyDown(rowCells('Player c')[3], { key: 'ArrowUp' })).toBe(false);
    expect(document.activeElement).toBe(from);
  });

  it('T2-b3b: an arrow at an edge moves nothing and is not defaultPrevented', () => {
    render(<GearBoard players={[p('a', 'M1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    const first = rowCells('Player a')[0];
    focus(first);
    expect(fireEvent.keyDown(first, { key: 'ArrowLeft' })).toBe(true);
    expect(fireEvent.keyDown(first, { key: 'ArrowUp' })).toBe(true);
    expect(fireEvent.keyDown(first, { key: 'ArrowDown' })).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('T2-b4: Alt+ArrowLeft and Shift+ArrowDown neither move focus nor are defaultPrevented', () => {
    render(<GearBoard players={[p('a', 'M1'), p('b', 'H1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    const from = rowCells('Player a')[2];
    focus(from);
    expect(fireEvent.keyDown(from, { key: 'ArrowLeft', altKey: true })).toBe(true);
    expect(fireEvent.keyDown(from, { key: 'ArrowDown', shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(from);
    expect(tabStops()).toEqual([from]);
  });

  it('ArrowRight skips a column with no cell (the OFFH column on a shield-free row)', () => {
    // A PLD roster grows the OFFH column; neither fixture carries an offhand
    // entry, so that `<td>` is empty and Right from Wpn lands on Head.
    render(<GearBoard players={[player({ id: 'pld', name: 'Player pld', position: 'T1' }), p('whm', 'H1', { job: 'WHM', role: 'healer' })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('OffH');
    const cells = rowCells('Player whm');
    focus(cells[0]);
    expect(fireEvent.keyDown(cells[0], { key: 'ArrowRight' })).toBe(false);
    expect(document.activeElement).toBe(cells[1]);
    // The `<td>` just before Head is the OFFH column, and it holds no cell.
    const offhTd = (cells[1].closest('td') as HTMLElement).previousElementSibling as HTMLElement;
    expect(offhTd.querySelector('[role="checkbox"]')).toBeNull();
  });

  it('T2-c1: removing the active player leaves exactly one tab stop', () => {
    const { rerender } = render(<GearBoard players={[p('a', 'M1'), p('b', 'H1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    focus(rowCells('Player b')[2]);
    expect(tabStops()).toEqual([rowCells('Player b')[2]]);
    rerender(<GearBoard players={[p('a', 'M1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(tabStops()).toEqual([rowCells('Player a')[0]]);
  });

  it('T2-c2: focusing a cell (as a real click does) makes it the tab stop', () => {
    render(<GearBoard players={[p('a', 'M1'), p('b', 'H1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(tabStops()).toEqual([rowCells('Player a')[0]]);
    const target = rowCells('Player b')[5];
    // A real click focuses the (tabIndex -1) cell before the click event fires;
    // jsdom has no such default action, so focus, then click.
    focus(target);
    fireEvent.click(target);
    expect(tabStops()).toEqual([target]);
  });

  it('T2-c3: a read-only board has no tab stop and no arrow-key description', () => {
    render(<GearBoard players={[p('a', 'M1'), p('b', 'H1')]} userRole="viewer" currentUserId="u-viewer" isAdminAccess={false} actionsForPlayer={noop} />);
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(tabStops()).toHaveLength(0);
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('Use arrow keys to move between gear cells.')).not.toBeInTheDocument();
  });

  it('T2-c6: the active cell losing its BiS target (spanning row) falls back to the first interactive cell', () => {
    const { rerender } = render(<GearBoard players={[p('a', 'M1'), p('b', 'H1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    focus(rowCells('Player b')[4]);
    expect(tabStops()).toEqual([rowCells('Player b')[4]]);
    // b is still on the board, but its row is now the no-BiS spanning row: no cell exists to carry the stop.
    rerender(<GearBoard players={[p('a', 'M1'), p('b', 'H1', { gear: noBisGear() })]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.getByText(/No BiS imported/i)).toBeInTheDocument();
    expect(tabStops()).toEqual([rowCells('Player a')[0]]);
  });

  it('T2-c6 (unclaim variant): the active row turning non-editable falls back to the first interactive cell', () => {
    const mine = { userId: 'u-me' };
    const { rerender } = render(<GearBoard players={[p('a', 'M1', mine), p('b', 'H1', mine)]} {...MEMBER_GATE} actionsForPlayer={noop} />);
    focus(rowCells('Player a')[2]);
    expect(tabStops()).toEqual([rowCells('Player a')[2]]);
    // a's cells are still rendered, now inert (tabIndex -1): the stop must leave them.
    rerender(<GearBoard players={[p('a', 'M1', { userId: 'u-other' }), p('b', 'H1', mine)]} {...MEMBER_GATE} actionsForPlayer={noop} />);
    expect(rowCells('Player a')[2]).toHaveAttribute('aria-disabled', 'true');
    expect(tabStops()).toEqual([rowCells('Player b')[0]]);
  });

  it('T2-c4: removing a player ABOVE the active cell keeps the same player and slot as the stop', () => {
    const { rerender } = render(<GearBoard players={[p('a', 'M1'), p('b', 'H1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    focus(rowCells('Player b')[4]);
    expect(tabStops()).toEqual([rowCells('Player b')[4]]);
    rerender(<GearBoard players={[p('b', 'H1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(tabStops()).toEqual([rowCells('Player b')[4]]);
  });

  it('T2-c5: clicking a disabled cell leaves exactly one tab stop, on an interactive cell', () => {
    render(<GearBoard players={[p('own', 'M1', { userId: 'u-me' }), p('other', 'H1', { userId: 'u-other' })]} {...MEMBER_GATE} actionsForPlayer={noop} />);
    const inert = rowCells('Player other')[3];
    expect(inert).toHaveAttribute('aria-disabled', 'true');
    focus(inert);
    fireEvent.click(inert);
    expect(document.activeElement).toBe(inert);
    const stops = tabStops();
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAttribute('aria-disabled', 'false');
    expect(rowCells('Player own')).toContain(stops[0]);
  });

  it('describes the arrow keys to assistive tech through aria-describedby', () => {
    render(<GearBoard players={[p('a', 'M1')]} {...OWNER_GATE} actionsForPlayer={noop} />);
    expect(screen.getByRole('table')).toHaveAccessibleDescription('Use arrow keys to move between gear cells.');
  });
});
