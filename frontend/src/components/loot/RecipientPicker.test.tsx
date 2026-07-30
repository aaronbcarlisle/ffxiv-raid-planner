import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// Checkboxes (ui/Checkbox) are a `<label>` wrapping a `div role="checkbox"`
// — the div itself carries no accessible name (no aria-label is passed by
// RecipientPicker), so `getByRole('checkbox', { name })` can't find it.
// Scope to the label whose visible text matches instead, then grab the
// checkbox inside it.
function checkboxByLabelText(text: string): HTMLElement {
  const labelEl = screen.getByText(text).closest('label');
  if (!labelEl) throw new Error(`checkbox label not found for "${text}"`);
  return within(labelEl).getByRole('checkbox');
}

function acquiredCheckbox(itemLabel: string): HTMLElement {
  return checkboxByLabelText(`Mark ${itemLabel} as acquired`);
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
    // Task-10 regression pin: the fallback avatar uses the PlayerIdentity ring
    // pattern (role color as border, neutral fill) — not a filled role circle.
    expect(screen.getByText('CO')).toHaveClass('rounded-full', 'border-2', 'bg-surface-interactive');
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

  it('announces the Options disclosure state via aria-expanded', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    const toggle = screen.getByRole('button', { name: 'Options' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide options' })).toHaveAttribute('aria-expanded', 'true');
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

  it('falls back to All members with a pre-selected recipient when nobody needs the item (A11)', () => {
    // Both players already hold the raid-BiS earring → the 'priority' scope
    // pool (needers only) is EMPTY. The picker must not open into a dead-end:
    // it opens on 'all' (never empty while anyone is configured) with the
    // first entry pre-selected, so submit is immediately usable.
    const gearedCaster = makePlayer('c1', 'Caster One', 'BLM');
    gearedCaster.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const gearedMelee = makePlayer('m1', 'Melee One', 'SAM');
    gearedMelee.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    render(
      <RecipientPicker {...baseProps} players={[gearedCaster, gearedMelee]} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'By priority' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('No players match.')).not.toBeInTheDocument();
    // First 'all'-scope entry (alphabetical among non-needers) is pre-selected
    // and submit is enabled with a named recipient — not the bare disabled 'Assign'.
    const submit = screen.getByRole('button', { name: 'Assign to Caster One' });
    expect(submit).toBeEnabled();
  });

  it('opens on By priority when the priority pool is non-empty (fallback must not swallow the normal path)', () => {
    // Default fixture: both players need the earring (hasItem: false) → pool
    // non-empty → normal path. Payload-level pin for this path already exists in
    // 'lists ranked eligible players with reasons and confirms the top pick';
    // this adds the explicit scope-toggle assertion.
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(screen.getByRole('button', { name: 'By priority' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('RecipientPicker — R-24 method + notes in assign mode', () => {
  beforeEach(() => vi.mocked(logLootAndUpdateGear).mockClear());

  it('assign mode offers all four methods and the notes field inside Options', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    // disclosure starts closed in assign mode
    fireEvent.click(screen.getByText('Options'));
    for (const m of ['Drop', 'Book', 'Tome', 'Purchase']) {
      expect(screen.getByRole('radio', { name: m })).toBeInTheDocument();
    }
    expect(screen.getByPlaceholderText('Optional notes…')).toBeInTheDocument();
  });

  it('choosing Tome disables the acquired checkbox with the caption, and submit still logs method=tome', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    fireEvent.click(screen.getByText('Options'));
    fireEvent.click(screen.getByRole('radio', { name: 'Tome' }));
    expect(acquiredCheckbox('Earring')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Gear sync applies to drops and books.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2]).toMatchObject({ method: 'tome' });
  });

  it('choosing a gear-sync-eligible method (Book) re-enables the checkbox and clears the caption', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    fireEvent.click(screen.getByText('Options'));
    fireEvent.click(screen.getByRole('radio', { name: 'Purchase' }));
    expect(acquiredCheckbox('Earring')).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Book' }));
    expect(acquiredCheckbox('Earring')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByText('Gear sync applies to drops and books.')).not.toBeInTheDocument();
  });

  // Review fix round 1, Finding 1: assign mode exposes the notes field (R-24)
  // but the submit payload was still computing `notes` as if it didn't exist,
  // so a typed note was silently discarded. Ruling: user note wins; the
  // weapon auto-note is only a fallback for an untouched field.
  it('assign mode: a typed note reaches the payload (non-weapon slot, no auto-note to compete with)', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    fireEvent.click(screen.getByText('Options'));
    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), { target: { value: 'traded for prio' } });
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].notes).toBe('traded for prio');
  });

  it('weapon assign, no typed note: payload falls back to the legacy auto-note', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    // default pinned pick = Caster One (BLM) — legacy auto-note parity.
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].notes).toBe('BLM weapon');
  });

  it('weapon assign, typed note: user note wins over the auto-note', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    fireEvent.click(screen.getByText('Options'));
    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), { target: { value: 'won on tiebreaker' } });
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].notes).toBe('won on tiebreaker');
  });
});

describe('RecipientPicker — R-12 checkbox promotion + Options rename', () => {
  it('assign mode shows the acquired checkbox without opening the disclosure', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(acquiredCheckbox('Earring')).toBeInTheDocument();
    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('log mode also shows the checkbox promoted above the (already-open) disclosure', () => {
    render(<RecipientPicker {...baseProps} mode="log" />);
    // log mode's default placeholder slot is earring, labelled "Ears" (GEAR_SLOT_NAMES).
    expect(acquiredCheckbox('Ears')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide options' })).toBeInTheDocument();
  });

  it('edit mode keeps the acquired checkbox enabled regardless of the entry method (gear-sync refusal is the coordination util\'s job)', () => {
    const entry = makeEntry({ method: 'tome', itemSlot: 'body', recipientPlayerId: 'c1', notes: '' });
    render(<RecipientPicker {...baseProps} mode="edit" editEntry={entry} />);
    expect(acquiredCheckbox('Body')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByText('Gear sync applies to drops and books.')).not.toBeInTheDocument();
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

  it('log mode falls back to All members when nobody needs the initial placeholder slot (shared branch, A11)', () => {
    // Log mode opens on firstSlotForFloor(1) = earring. Both players already
    // hold it → empty priority pool → same 'all' fallback as assign mode.
    const gearedCaster = makePlayer('c1', 'Caster One', 'BLM');
    gearedCaster.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const gearedMelee = makePlayer('m1', 'Melee One', 'SAM');
    gearedMelee.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    render(<RecipientPicker {...baseProps} players={[gearedCaster, gearedMelee]} mode="log" />);
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('No players match.')).not.toBeInTheDocument();
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

  it('prefills week, method, notes, recipient, and pre-expands options from the entry', () => {
    const entry = makeEntry({ weekNumber: 2, floor: 'M11S', itemSlot: 'body', method: 'book', notes: 'hi', recipientPlayerId: 'c1' });
    render(<RecipientPicker {...baseProps} mode="edit" editEntry={entry} />);
    expect(screen.getByText(/Edit · Body/)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    expect(screen.getByRole('radio', { name: /Book/i })).toBeChecked();
    expect(screen.getByPlaceholderText('Optional notes…')).toHaveValue('hi');
    const casterRow = screen.getByText('Caster One').closest('[role="radio"]');
    expect(casterRow).toHaveAttribute('aria-checked', 'true');
    // options pre-expanded in edit mode
    expect(screen.getByRole('button', { name: 'Hide options' })).toBeInTheDocument();
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

  it('scope flip that drops the original recipient does NOT silently reassign to entries[0]', () => {
    // Caster One already holds the raid-BiS earring (hasItem: true) — under
    // 'priority' scope (needers only) they drop out of the list entirely,
    // while Melee One (default gear = needs earring) ranks #1.
    const owner = makePlayer('c1', 'Caster One', 'BLM');
    owner.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const needer = makePlayer('m1', 'Melee One', 'SAM');
    const entry = makeEntry({ floor: 'M9S', itemSlot: 'earring', recipientPlayerId: 'c1', method: 'drop', notes: '' });
    render(<RecipientPicker {...baseProps} players={[owner, needer]} mode="edit" editEntry={entry} />);

    // Edit mode opens with scope 'all' — Caster One (the entry's recipient) is selected.
    const casterRow = screen.getByText('Caster One').closest('[role="radio"]');
    expect(casterRow).toHaveAttribute('aria-checked', 'true');

    // Flip to priority scope — Caster One drops out (already has the item).
    fireEvent.click(screen.getByRole('button', { name: 'By priority' }));
    expect(screen.queryByText('Caster One')).not.toBeInTheDocument();

    // Melee One is now the sole entry but must NOT become silently selected.
    const meleeRow = screen.getByText('Melee One').closest('[role="radio"]');
    expect(meleeRow).toHaveAttribute('aria-checked', 'false');
    const submit = screen.getByRole('button', { name: 'Save changes' });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
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

  it('shows the Character select in assign mode for a recipient with registrations (presence pin)', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    // Assign mode starts with Options collapsed — expand to reach the Character select.
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    // Caster One (c1) is the pinned default recipient and has a registration.
    expect(screen.getByRole('combobox', { name: 'Character' })).toBeInTheDocument();
  });

  it('hides the Character select in edit mode even when the recipient has registrations (edit never diffs character fields — legacy parity)', () => {
    const entry = makeEntry({ weekNumber: 2, floor: 'M11S', itemSlot: 'body', method: 'book', notes: 'hi', recipientPlayerId: 'c1' });
    render(<RecipientPicker {...baseProps} mode="edit" editEntry={entry} />);
    // Caster One (c1) has a registration (see beforeEach), so if the block were
    // rendered unconditionally it would appear here too.
    expect(screen.queryByRole('combobox', { name: 'Character' })).not.toBeInTheDocument();
  });
});

describe('RecipientPicker — R-12 "This will:" live preview', () => {
  it('names the recipient, week and gear side effect, and tracks toggles live', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(screen.getByText('This will:')).toBeInTheDocument();
    // default pinned pick = top-ranked entry = Caster One; currentWeek = 3
    expect(screen.getByText(/Log Earring \(drop\) for Caster One in Week 3/)).toBeInTheDocument();
    expect(screen.getByText(/Mark Earring as acquired on Caster One's gear/)).toBeInTheDocument();

    fireEvent.click(acquiredCheckbox('Earring'));
    expect(screen.queryByText(/Mark Earring as acquired on/)).not.toBeInTheDocument();
  });

  it('does not promise a gear write for an extra-loot weapon or a tome method', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    // Before any toggle: default drop method + non-extra promises the gear write.
    expect(screen.getByText(/Mark Weapon as acquired on Caster One's gear/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Options'));
    fireEvent.click(checkboxByLabelText('Extra loot (not BiS priority)'));
    // The acquired checkbox itself is still present (not disabled by isExtra)…
    expect(acquiredCheckbox('Weapon')).toBeInTheDocument();
    // …but the preview no longer promises the write the util would refuse.
    expect(screen.queryByText(/Mark Weapon as acquired on/)).not.toBeInTheDocument();

    // Un-extra, then switch to a non-sync-eligible method (Tome) — same result.
    fireEvent.click(checkboxByLabelText('Extra loot (not BiS priority)'));
    fireEvent.click(screen.getByRole('radio', { name: 'Tome' }));
    expect(screen.queryByText(/Mark Weapon as acquired on/)).not.toBeInTheDocument();
  });

  it('promises the weapon-priority update only for drop/book methods', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    // default pick (Caster One, BLM) has a weapon-priority row for their job.
    expect(screen.getByText(/weapon priority/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Options'));
    fireEvent.click(screen.getByRole('radio', { name: 'Tome' }));
    expect(screen.queryByText(/weapon priority/)).not.toBeInTheDocument();
  });

  it('edit mode lists pending changes and says so when there are none', () => {
    // Non-weapon slot — the weaponJob backfill can't fire, so an untouched
    // entry has truly zero derived updates.
    const entry = makeEntry({ weekNumber: 2, floor: 'M11S', itemSlot: 'body', method: 'book', notes: 'hi', recipientPlayerId: 'c1' });
    render(<RecipientPicker {...baseProps} mode="edit" editEntry={entry} />);
    expect(screen.getByText('No changes yet.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), { target: { value: 'changed' } });
    expect(screen.getByText(/Update the notes/)).toBeInTheDocument();
    expect(screen.queryByText('No changes yet.')).not.toBeInTheDocument();
  });

  it('edit mode surfaces the weaponJob backfill it will write', () => {
    const warrior = makePlayer('w1', 'Warrior One', 'WAR');
    const entry = makeEntry({
      floor: 'M12S', itemSlot: 'weapon', weaponJob: undefined,
      recipientPlayerId: 'w1', method: 'drop', notes: '',
    });
    render(<RecipientPicker {...baseProps} players={[warrior]} mode="edit" editEntry={entry} />);
    expect(screen.getByText(/Record it as a WAR weapon/)).toBeInTheDocument();
    expect(screen.queryByText('No changes yet.')).not.toBeInTheDocument();
  });

  // Review fix round 1, Finding 1: the notes-clearing branch of the preview
  // (`'notes' in updates`) was dead code under the suite — nothing exercised
  // clearing a non-empty note to ''. `computeEditUpdates` sets the `notes`
  // key to the literal value `undefined` in that case (key PRESENT, value
  // undefined), so this pins both the preview line AND that the submitted
  // payload actually carries the key — `toEqual` would silently pass on a
  // payload missing the key entirely (it ignores undefined-valued props),
  // so the assertion uses `toHaveProperty`/`Object.keys` instead.
  it('edit mode: clearing a note to empty still surfaces the change and submits the notes key', async () => {
    const entry = makeEntry({ weekNumber: 2, floor: 'M11S', itemSlot: 'body', method: 'book', notes: 'hi', recipientPlayerId: 'c1' });
    render(<RecipientPicker {...baseProps} mode="edit" editEntry={entry} />);

    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), { target: { value: '' } });
    expect(screen.getByText(/Update the notes/)).toBeInTheDocument();
    expect(screen.queryByText('No changes yet.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateLootAndSyncGear).toHaveBeenCalledTimes(1));
    const updates = vi.mocked(updateLootAndSyncGear).mock.calls[0][4];
    expect(updates).toHaveProperty('notes');
    expect(Object.keys(updates)).toEqual(['notes']);
  });

  // Review fix round 1, Finding 3(a): pins the ring-vs-plain-slot refinement
  // — a slot whose gear is tome-sourced (not raid) never promises the gear
  // write, even with updateGear checked and method='drop' (both otherwise
  // eligible). Mirrors lootCoordination.ts:111's `bisSource === 'raid'` gate.
  it('assign mode: tome-sourced slot gear never promises the gear write (refinement pin)', () => {
    const tomeCaster = makePlayer('c1', 'Caster One', 'BLM');
    tomeCaster.gear = [
      { slot: 'earring', bisSource: 'tome', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    const tomeMelee = makePlayer('m1', 'Melee One', 'SAM');
    tomeMelee.gear = [
      { slot: 'earring', bisSource: 'tome', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    render(
      <RecipientPicker {...baseProps} players={[tomeCaster, tomeMelee]} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    // updateGear defaults checked, method defaults 'drop' — only the
    // bisSource refinement blocks the line.
    expect(acquiredCheckbox('Earring')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Log Earring \(drop\) for Caster One in Week 3/)).toBeInTheDocument();
    expect(screen.queryByText(/Mark Earring as acquired on/)).not.toBeInTheDocument();
  });

  // Review fix round 1, Finding 3(b): pins the weapon-priority refinement —
  // a recipient with no weapon-priority row for their own job never
  // promises the weapon-priority write, even for an otherwise-eligible
  // drop. Mirrors lootCoordination.ts:129-137's `targetJob` match.
  it('weapon assign mode: no weapon-priority row for the recipient means no promise (refinement pin)', () => {
    const casterNoWP = makePlayer('c1', 'Caster One', 'BLM');
    casterNoWP.weaponPriorities = [];
    render(
      <RecipientPicker {...baseProps} players={[casterNoWP, melee]} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    expect(screen.getByText(/Log Weapon \(drop\) for Caster One in Week 3/)).toBeInTheDocument();
    // Scoped to the preview's own phrasing ("Update <name>'s weapon priority")
    // rather than a bare /weapon priority/ match — R-6 now legitimately shows
    // a ROW warning ("Not on the weapon priority list") for this same fixture,
    // which would otherwise collide with a broader regex.
    expect(screen.queryByText(/Update .*weapon priority/)).not.toBeInTheDocument();
  });
});

describe('RecipientPicker — D-36 no-one-needs-this hint', () => {
  it('shows the hint when the slot has no needers', () => {
    const gearedCaster = makePlayer('c1', 'Caster One', 'BLM');
    gearedCaster.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const gearedMelee = makePlayer('m1', 'Melee One', 'SAM');
    gearedMelee.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    render(
      <RecipientPicker {...baseProps} players={[gearedCaster, gearedMelee]} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(screen.getByText(/No one needs this item for BiS/)).toBeInTheDocument();
  });

  it('does not show the hint when someone needs the slot', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(screen.queryByText(/No one needs this item/)).not.toBeInTheDocument();
  });

  it('does not show the hint in edit mode even with no needers', () => {
    const gearedCaster = makePlayer('c1', 'Caster One', 'BLM');
    gearedCaster.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const entry = makeEntry({ floor: 'M9S', itemSlot: 'earring', recipientPlayerId: 'c1', method: 'drop', notes: '' });
    render(<RecipientPicker {...baseProps} players={[gearedCaster]} mode="edit" editEntry={entry} />);
    expect(screen.queryByText(/No one needs this item/)).not.toBeInTheDocument();
  });

  // Director change-review Finding 4: `needers` is priority scope, which
  // excludes substitutes (recipientRanking.ts's mainRoster filter). When the
  // main roster is fully geared but a substitute still needs the slot, the
  // A11 fallback opens the picker on All members — where that substitute
  // renders "…is BiS" at rank #1 — so the hint must NOT also claim nobody
  // needs it.
  it('does not show the hint when only a substitute needs the slot (main roster fully geared, opens on All members)', () => {
    const gearedMain1 = makePlayer('c1', 'Caster One', 'BLM');
    gearedMain1.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const gearedMain2 = makePlayer('m1', 'Melee One', 'SAM');
    gearedMain2.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const needySub = makePlayer('s1', 'Sub One', 'WHM', { sub: true });
    needySub.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    render(
      <RecipientPicker {...baseProps} players={[gearedMain1, gearedMain2, needySub]} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    // A11 fallback: the priority pool (main roster only) is empty, so the
    // picker opens on All members.
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
    // The substitute is visible, ranked, and claims need ("Ears" — the gear
    // slot's short label, GEAR_SLOT_NAMES['earring'])…
    expect(screen.getByText(/Ears is BiS/)).toBeInTheDocument();
    // …so the footer must not contradict that row.
    expect(screen.queryByText(/No one needs this item/)).not.toBeInTheDocument();
  });
});

describe('RecipientPicker — R-4 initialRecipientId prefill', () => {
  // Tank One/Tank Two both default-need the earring (makePlayer's default
  // gear leaves it hasItem: false, bisSource 'raid') — equal scores tie-break
  // alphabetically (utils/priority.ts), so Tank One ranks #1, Tank Two #2.
  // Player Nine already holds the earring, so she is a configured non-needer
  // — visible only under 'all' scope (recipientRanking.ts's needers-then-rest list).
  const tankOne = makePlayer('p1', 'Tank One', 'PLD');
  const tankTwo = makePlayer('p2', 'Tank Two', 'WAR');
  const playerNine = makePlayer('p9', 'Player Nine', 'SGE');
  playerNine.gear = [
    { slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false },
    { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
  ] as SnapshotPlayer['gear'];
  const r4Players = [tankOne, tankTwo, playerNine];

  function renderPicker(opts: { initialRecipientId?: string } = {}) {
    return render(
      <RecipientPicker
        {...baseProps}
        players={r4Players}
        mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }}
        initialRecipientId={opts.initialRecipientId}
      />
    );
  }

  it('pre-selects a prefilled needer inside the priority ranking', () => {
    renderPicker({ initialRecipientId: 'p2' }); // p2 ranked #2
    expect(screen.getByRole('radio', { name: /Tank Two/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Tank One/ })).toBeInTheDocument(); // list still renders
  });

  it('falls back to All members when the prefilled player is not a needer', () => {
    renderPicker({ initialRecipientId: 'p9' }); // p9 does not need the slot
    expect(screen.getByRole('radio', { name: /Player Nine/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stays freely switchable after prefill', () => {
    renderPicker({ initialRecipientId: 'p2' });
    fireEvent.click(screen.getByRole('radio', { name: /Tank One/ }));
    expect(screen.getByRole('radio', { name: /Tank One/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('an unknown id falls back to the default top-ranked selection', () => {
    renderPicker({ initialRecipientId: 'nope' });
    expect(screen.getByRole('radio', { name: /Tank One/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('RecipientPicker — R-6 explanation + confidence in the picker', () => {
  it('a row with log history shows the received warning', () => {
    // Sole needer for the Head slot so the row is unambiguous; the log entry
    // matches the same player + slot the picker is showing.
    const headNeeder = makePlayer('c1', 'Caster One', 'BLM');
    headNeeder.gear = [
      { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    const headDropForP1Week2 = makeEntry({
      id: 99, weekNumber: 2, floor: 'M9S', itemSlot: 'head', recipientPlayerId: 'c1', method: 'drop', notes: '',
    });
    render(
      <RecipientPicker {...baseProps} players={[headNeeder]} lootLog={[headDropForP1Week2]} mode="assign"
        item={{ slot: 'head', floorName: 'M9S', floorNumber: 1, label: 'Head' }} />
    );
    expect(screen.getByText('Already received Head in Week 2')).toBeInTheDocument();
  });

  it('priority scope shows the confidence header', () => {
    // Sole clean needer (no rivals, no warnings) — deriveRankingConfidence's
    // "high" cutoff. The shared two-player default fixture yields Medium
    // (two clean needers, neither warned), so this test needs its own pool.
    const soleNeeder = makePlayer('c1', 'Caster One', 'BLM');
    render(
      <RecipientPicker {...baseProps} players={[soleNeeder]} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    expect(screen.getByText('High confidence')).toBeInTheDocument();
  });

  it('All-members scope hides the confidence header', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'All members' }));
    expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
  });

  // Final review fix: edit mode's `lootLog` prop CONTAINS the entry being
  // edited, so cross-checking the full log against the entry's own recipient
  // warned about the very receipt under edit. Two-part pin: (1) with the log
  // containing ONLY the edited entry, the row must show NO warning at all;
  // (2) once a genuinely separate receipt for the same player+slot is added,
  // the warning DOES appear — proving the fix filters out only the edited
  // entry, not the whole log.
  it('edit mode: the entry under edit does not warn about itself, but a separate entry for the same player+slot still does', () => {
    const headNeeder = makePlayer('c1', 'Caster One', 'BLM');
    headNeeder.gear = [
      { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    const editedEntry = makeEntry({
      id: 99, weekNumber: 2, floor: 'M9S', itemSlot: 'head', recipientPlayerId: 'c1', method: 'drop', notes: '',
    });

    const { rerender } = render(
      <RecipientPicker {...baseProps} players={[headNeeder]} lootLog={[editedEntry]}
        mode="edit" editEntry={editedEntry} />
    );
    expect(screen.queryByText(/Already received Head in Week/)).not.toBeInTheDocument();

    const otherHeadDrop = makeEntry({
      id: 50, weekNumber: 1, floor: 'M9S', itemSlot: 'head', recipientPlayerId: 'c1', method: 'drop', notes: '',
    });
    rerender(
      <RecipientPicker {...baseProps} players={[headNeeder]} lootLog={[editedEntry, otherHeadDrop]}
        mode="edit" editEntry={editedEntry} />
    );
    expect(screen.getByText('Already received Head in Week 1')).toBeInTheDocument();
  });
});
