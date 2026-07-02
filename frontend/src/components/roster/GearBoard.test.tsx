import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('GearBoard', () => {
  it('renders a party-divider row and a player row per configured player', () => {
    render(<GearBoard players={[player({ id: 'a', name: 'Tank One' })]} canManage actionsForPlayer={noop} />);
    expect(screen.getByText('Light Party 1')).toBeInTheDocument();
    expect(screen.getByText('Tank One')).toBeInTheDocument();
  });

  it('shows the X/11 BiS summary', () => {
    render(<GearBoard players={[player({ id: 'a', gear: gear(7) })]} canManage actionsForPlayer={noop} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders the "No BiS imported" row when a player has no BiS-target slots', () => {
    const noBis = player({ id: 'z', name: 'Caster One', gear: SLOTS.map((slot) => ({ slot, bisSource: null, hasItem: false, isAugmented: false })) as GearSlotStatus[] });
    render(<GearBoard players={[noBis]} canManage actionsForPlayer={noop} />);
    expect(screen.getByText(/No BiS imported/i)).toBeInTheDocument();
  });

  it('cycling a cell calls the per-player onUpdate with a gear patch', () => {
    const onUpdate = vi.fn();
    const factory = () => ({ onUpdate });
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={factory} />);
    const cells = screen.getAllByRole('checkbox');
    fireEvent.click(cells[0]); // first raid slot: missing -> have
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0];
    expect(patch.gear[0].hasItem).toBe(true);
  });

  it('is read-only when canManage is false (cells non-interactive)', () => {
    const onUpdate = vi.fn();
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage={false} actionsForPlayer={() => ({ onUpdate })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('renders exactly one next-upgrade glyph for the player/slot in `priorities`', () => {
    const priorities = new Map<string, Set<GearSlot>>([['a', new Set<GearSlot>(['body'])]]);
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={noop} priorities={priorities} />);
    expect(screen.getAllByText('●')).toHaveLength(1);
  });

  it('renders no next-upgrade glyphs when `priorities` is omitted', () => {
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={noop} />);
    expect(screen.queryByText('●')).not.toBeInTheDocument();
  });

  it('swallows a rejected onUpdate without an unhandled promise rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('api failed'));
    const factory = () => ({ onUpdate });
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={factory} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });
});
