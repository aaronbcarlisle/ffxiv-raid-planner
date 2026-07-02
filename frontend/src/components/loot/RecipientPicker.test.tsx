import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecipientPicker } from './RecipientPicker';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer } from '../../types';

vi.mock('../../utils/lootCoordination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/lootCoordination')>();
  return { ...actual, logLootAndUpdateGear: vi.fn().mockResolvedValue(undefined) };
});
import { logLootAndUpdateGear } from '../../utils/lootCoordination';

beforeEach(() => {
  // jsdom has no matchMedia; Modal -> useDevice depends on it.
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

function makePlayer(id: string, name: string, job: string, opts: { hasWeapon?: boolean; sub?: boolean } = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job, role: 'caster',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [
      { slot: 'weapon', bisSource: 'raid', hasItem: opts.hasWeapon ?? false, isAugmented: false },
      { slot: 'earring', bisSource: 'raid', hasItem: false, isAugmented: false },
    ],
    tomeWeapon: {}, weaponPriorities: [{ job, priority: 1, received: false }],
  } as unknown as SnapshotPlayer;
}

const caster = makePlayer('c1', 'Caster One', 'BLM');
const melee = makePlayer('m1', 'Melee One', 'SAM');
const players = [caster, melee];
const baseProps = {
  isOpen: true, onClose: vi.fn(), groupId: 'g1', tierId: 't1',
  players, settings: { ...DEFAULT_SETTINGS }, floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  lootLog: [], currentWeek: 3, maxWeek: 3,
};

describe('RecipientPicker (assign mode)', () => {
  beforeEach(() => vi.mocked(logLootAndUpdateGear).mockClear());

  it('lists ranked eligible players with reasons and confirms the top pick', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    expect(screen.getByText(/Assign · Weapon/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    const [gid, tid, payload, options] = vi.mocked(logLootAndUpdateGear).mock.calls[0];
    expect(gid).toBe('g1'); expect(tid).toBe('t1');
    expect(payload).toMatchObject({
      weekNumber: 3, floor: 'M12S', itemSlot: 'weapon', method: 'drop', isExtra: false,
    });
    // weapon parity: weaponJob = recipient's main job; weapon-priority sync on
    expect(payload.weaponJob).toBe(payload.recipientPlayerId === 'c1' ? 'BLM' : 'SAM');
    expect(options).toMatchObject({ updateGear: true, updateWeaponPriority: true });
  });

  it('ring context submits itemSlot ring1 (legacy parity)', async () => {
    const ringPlayers = [makePlayer('r1', 'Ring Needer', 'BRD')];
    ringPlayers[0].gear = [
      { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
      { slot: 'ring2', bisSource: 'raid', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    render(
      <RecipientPicker {...baseProps} players={ringPlayers} mode="assign"
        item={{ slot: 'ring', floorName: 'M9S', floorNumber: 1, label: 'Ring' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalled());
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].itemSlot).toBe('ring1');
    // non-weapon: no weapon-priority sync
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][3]).toMatchObject({ updateWeaponPriority: false });
  });

  it('off-spec scope forces isExtra', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Off-spec / free' }));
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalled());
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].isExtra).toBe(true);
  });

  it('search filters the rows', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    fireEvent.change(screen.getByPlaceholderText('Search players…'), { target: { value: 'Melee' } });
    expect(screen.queryByText('Caster One')).not.toBeInTheDocument();
    expect(screen.getByText('Melee One')).toBeInTheDocument();
  });
});

describe('RecipientPicker (log mode)', () => {
  beforeEach(() => vi.mocked(logLootAndUpdateGear).mockClear());

  it('offers fight + slot selectors and a book method option, and submits the choice', async () => {
    render(<RecipientPicker {...baseProps} mode="log" />);
    // defaults to the first fight's first slot; switch method to book
    fireEvent.click(screen.getByRole('radio', { name: /Book/i }));
    fireEvent.click(screen.getByRole('button', { name: /Assign to|Log drop/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalled());
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].method).toBe('book');
  });
});
