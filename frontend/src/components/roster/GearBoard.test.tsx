import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
});
