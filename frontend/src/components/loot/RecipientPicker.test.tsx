import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecipientPicker } from './RecipientPicker';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import type { SnapshotPlayer, LootLogEntry, StaticCharacterRegistration } from '../../types';

vi.mock('../../utils/lootCoordination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/lootCoordination')>();
  return {
    ...actual,
    logLootAndUpdateGear: vi.fn().mockResolvedValue(undefined),
    updateLootAndSyncGear: vi.fn().mockResolvedValue(undefined),
  };
});
import { logLootAndUpdateGear, updateLootAndSyncGear } from '../../utils/lootCoordination';

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
    // default pick pinned at open = top-ranked entry (equal scores → alphabetical → Caster One)
    expect(payload.recipientPlayerId).toBe('c1');
    // weapon parity: weaponJob = recipient's main job; weapon-priority sync on
    expect(payload.weaponJob).toBe(payload.recipientPlayerId === 'c1' ? 'BLM' : 'SAM');
    // legacy auto-note parity: `${weaponJob} weapon` (no ' (extra)' suffix when not extra)
    expect(payload.notes).toBe('BLM weapon');
    expect(options).toMatchObject({ updateGear: true, updateWeaponPriority: true });
  });

  it('keyboard interaction can change the selection', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    const rows = screen.getAllByRole('radio');
    expect(rows).toHaveLength(2);
    // every row is tabbable for keyboard users, not just the selected one
    for (const row of rows) expect(row).toHaveAttribute('tabindex', '0');
    // default pick is Caster One (rows[0]); Enter on the second row moves selection
    fireEvent.keyDown(rows[1], { key: 'Enter' });
    expect(rows[1]).toHaveAttribute('aria-checked', 'true');
    expect(rows[0]).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].recipientPlayerId).toBe('m1');
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

  it('announces the Details disclosure state via aria-expanded', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    const toggle = screen.getByRole('button', { name: 'Details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('disables submit when the search filter hides the pinned selection, and re-enables when cleared', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    // Default pick pinned at open = top-ranked entry = Caster One.
    const submit = screen.getByRole('button', { name: /Assign to/ });
    expect(submit).toBeEnabled();

    // Search to a term that excludes the pinned selection (Caster One).
    fireEvent.change(screen.getByPlaceholderText('Search players…'), { target: { value: 'Melee' } });
    expect(screen.queryByText('Caster One')).not.toBeInTheDocument();
    expect(submit).toBeDisabled();

    // Clearing the search restores visibility and re-enables submit.
    fireEvent.change(screen.getByPlaceholderText('Search players…'), { target: { value: '' } });
    expect(submit).toBeEnabled();
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

function makeEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 42,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M11S',
    itemSlot: 'body',
    recipientPlayerId: 'c1',
    recipientPlayerName: 'Caster One',
    recipientCharacterRegistrationId: null,
    recipientCharacterName: null,
    method: 'book',
    notes: 'hi',
    weaponJob: undefined,
    isExtra: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'user',
    ...overrides,
  };
}

describe('RecipientPicker (edit mode)', () => {
  beforeEach(() => {
    vi.mocked(logLootAndUpdateGear).mockClear();
    vi.mocked(updateLootAndSyncGear).mockClear();
  });

  it('prefills week, method, notes, recipient, and pre-expands details from the entry', () => {
    const entry = makeEntry({ weekNumber: 2, floor: 'M11S', itemSlot: 'body', method: 'book', notes: 'hi', recipientPlayerId: 'c1' });
    render(<RecipientPicker {...baseProps} mode="edit" editEntry={entry} />);
    expect(screen.getByText(/Edit · Body/)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    expect(screen.getByRole('radio', { name: /Book/i })).toBeChecked();
    expect(screen.getByPlaceholderText('Optional notes…')).toHaveValue('hi');
    const casterRow = screen.getByText('Caster One').closest('[role="radio"]');
    expect(casterRow).toHaveAttribute('aria-checked', 'true');
    // details pre-expanded in edit mode
    expect(screen.getByRole('button', { name: 'Hide details' })).toBeInTheDocument();
  });

  it('diffs only the changed recipient — one-key updates via updateLootAndSyncGear', async () => {
    const entry = makeEntry({ weekNumber: 2, floor: 'M11S', itemSlot: 'body', method: 'book', notes: 'hi', recipientPlayerId: 'c1' });
    render(<RecipientPicker {...baseProps} mode="edit" editEntry={entry} />);
    fireEvent.click(screen.getByText('Melee One'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateLootAndSyncGear).toHaveBeenCalledTimes(1));
    const [gid, tid, id, orig, updates, options] = vi.mocked(updateLootAndSyncGear).mock.calls[0];
    expect(gid).toBe('g1');
    expect(tid).toBe('t1');
    expect(id).toBe(entry.id);
    expect(orig).toBe(entry);
    expect(updates).toEqual({ recipientPlayerId: 'm1' });
    expect(Object.keys(updates)).toHaveLength(1);
    expect(options).toEqual({ syncGear: true });
  });

  it('backfills weaponJob from the new recipient job for a weapon entry lacking it', async () => {
    const pld = makePlayer('p1', 'Paladin One', 'PLD');
    const entry = makeEntry({ floor: 'M12S', itemSlot: 'weapon', weaponJob: undefined, recipientPlayerId: 'c1', method: 'drop', notes: '' });
    render(<RecipientPicker {...baseProps} players={[caster, pld]} mode="edit" editEntry={entry} />);
    fireEvent.click(screen.getByText('Paladin One'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateLootAndSyncGear).toHaveBeenCalledTimes(1));
    const updates = vi.mocked(updateLootAndSyncGear).mock.calls[0][4];
    expect(updates.recipientPlayerId).toBe('p1');
    expect(updates.weaponJob).toBe('PLD');
  });

  it('closes without calling updateLootAndSyncGear when nothing changed', async () => {
    const onClose = vi.fn();
    const entry = makeEntry({ weekNumber: 2, floor: 'M11S', itemSlot: 'body', method: 'book', notes: 'hi', recipientPlayerId: 'c1' });
    render(<RecipientPicker {...baseProps} onClose={onClose} mode="edit" editEntry={entry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateLootAndSyncGear).not.toHaveBeenCalled();
  });

  it('round-trips an untouched ring2 slot — notes-only change carries no itemSlot key', async () => {
    const ringPlayers = [makePlayer('c1', 'Caster One', 'BLM')];
    ringPlayers[0].gear = [
      { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
      { slot: 'ring2', bisSource: 'raid', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    const entry = makeEntry({ floor: 'M9S', itemSlot: 'ring2', recipientPlayerId: 'c1', method: 'drop', notes: '' });
    render(<RecipientPicker {...baseProps} players={ringPlayers} mode="edit" editEntry={entry} />);
    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), { target: { value: 'traded' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateLootAndSyncGear).toHaveBeenCalledTimes(1));
    const updates = vi.mocked(updateLootAndSyncGear).mock.calls[0][4];
    expect(updates).toEqual({ notes: 'traded' });
    expect(updates).not.toHaveProperty('itemSlot');
  });
});

describe('RecipientPicker (character payload — PR-1 obligation)', () => {
  beforeEach(() => {
    vi.mocked(logLootAndUpdateGear).mockClear();
    vi.mocked(updateLootAndSyncGear).mockClear();
    useStaticCharacterStore.setState({
      registrationsByGroup: {
        g1: {
          c1: [{
            id: 'reg-primary',
            staticGroupId: 'g1',
            snapshotPlayerId: 'c1',
            playerCharacterId: null,
            manualCharacterName: null,
            manualWorld: null,
            manualDataCenter: null,
            roleInStatic: 'main',
            job: 'BLM',
            isPrimaryForStatic: true,
            source: 'manual',
            lastSyncedAt: null,
            createdAt: '',
            updatedAt: '',
            resolvedName: 'Caster Prime',
            resolvedWorld: null,
            resolvedDataCenter: null,
            linkedCharacter: null,
          } as unknown as StaticCharacterRegistration],
        },
      },
    });
  });
  afterEach(() => {
    useStaticCharacterStore.setState({ registrationsByGroup: {} });
  });

  it('sends recipientCharacterRegistrationId + name from the primary registration on create', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(logLootAndUpdateGear).mock.calls[0][2];
    // regression: the create path routes through logLootAndUpdateGear, NOT the edit util
    expect(updateLootAndSyncGear).not.toHaveBeenCalled();
    expect(payload.recipientPlayerId).toBe('c1');
    expect(payload.recipientCharacterRegistrationId).toBe('reg-primary');
    expect(payload.recipientCharacterName).toBe('Caster Prime');
  });
});
