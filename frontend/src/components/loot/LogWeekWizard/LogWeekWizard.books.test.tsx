/**
 * LogWeekWizard — Books step reads the page ledger (issue #326).
 *
 * A player whose books for a floor/week are already an `earned` entry in the
 * page ledger is shown locked on the Books step (checked, read-only, labelled
 * "already logged") and is never sent in `markFloorCleared`; a floor whose
 * whole roster is already credited sends no request. Mirrors how LOG-1
 * (R-P0-9) locks already-logged gear slots.
 *
 * The ledger source is `useLootTrackingStore((s) => s.pageLedger)` — the
 * store `markFloorCleared` refreshes and Loot.tsx reads. Same mocking as
 * LogWeekWizard.test.tsx: only the three write actions are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';

const mocks = vi.hoisted(() => ({
  logLootAndUpdateGear: vi.fn(),
  logMaterialAndUpdateGear: vi.fn(),
  markFloorCleared: vi.fn(),
  storeState: {
    markFloorCleared: undefined as unknown,
    pageLedger: [] as unknown[],
    fetchPageLedger: async () => {},
    loadingStates: { lootLog: false, materialLog: false, pageLedger: false },
  },
}));

vi.mock('../../../utils/lootCoordination', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/lootCoordination')>()),
  logLootAndUpdateGear: mocks.logLootAndUpdateGear,
}));
vi.mock('../../../utils/materialCoordination', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/materialCoordination')>()),
  logMaterialAndUpdateGear: mocks.logMaterialAndUpdateGear,
}));
vi.mock('../../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (selector?: (s: typeof mocks.storeState) => unknown) =>
    selector ? selector(mocks.storeState) : mocks.storeState,
}));

import { LogWeekWizard } from './index';
import type { MarkFloorClearedRequest, PageLedgerEntry, TransactionType } from '../../../types';
import {
  DEVTST_FLOORS, DEVTST_LOOT_LOG, DEVTST_MATERIAL_LOG, DEVTST_PLAYERS, DEVTST_SETTINGS, DEVTST_TIER_ID,
} from '../../../test/fixtures/devtst';

type WizardProps = ComponentProps<typeof LogWeekWizard>;

const MAIN_PLAYERS = DEVTST_PLAYERS.filter((p) => p.configured && !p.isSubstitute);
const HEALER_TWO = DEVTST_PLAYERS.find((p) => p.name === 'Healer Two')!;
const TANK_ONE = DEVTST_PLAYERS.find((p) => p.name === 'Tank One')!;

let nextId = 1;
function ledger(
  player: { id: string; name: string },
  seed: { weekNumber?: number; floor?: string; transactionType?: TransactionType; tierSnapshotId?: string } = {},
): PageLedgerEntry {
  const transactionType = seed.transactionType ?? 'earned';
  return {
    id: nextId++,
    tierSnapshotId: seed.tierSnapshotId ?? DEVTST_TIER_ID,
    playerId: player.id,
    playerName: player.name,
    weekNumber: seed.weekNumber ?? 11,
    floor: seed.floor ?? 'M9S',
    bookType: 'I',
    transactionType,
    quantity: transactionType === 'earned' ? 1 : transactionType === 'spent' ? -4 : 0,
    createdAt: '2026-09-27T10:00:00Z',
    createdByUserId: 'u-owner',
  } as PageLedgerEntry;
}

function wizardProps(onClose: () => void, overrides: Partial<WizardProps> = {}): WizardProps {
  return {
    isOpen: true,
    onClose,
    groupId: 'g1',
    tierId: DEVTST_TIER_ID,
    players: DEVTST_PLAYERS,
    settings: DEVTST_SETTINGS,
    floors: DEVTST_FLOORS,
    currentWeek: 11,
    maxWeek: 12,
    lootLog: DEVTST_LOOT_LOG,
    materialLog: DEVTST_MATERIAL_LOG,
    ...overrides,
  };
}

function renderWizard(overrides: Partial<WizardProps> = {}) {
  const onClose = vi.fn();
  const { rerender } = render(<LogWeekWizard {...wizardProps(onClose, overrides)} />);
  return { onClose, rerender: () => rerender(<LogWeekWizard {...wizardProps(onClose, overrides)} />) };
}

const floorTab = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const uncheckFloor = (name: string) => fireEvent.click(within(floorTab(name)).getByRole('checkbox'));
function clearOnly(keep: string) {
  for (const name of DEVTST_FLOORS) if (name !== keep) uncheckFloor(name);
}
const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
const back = () => fireEvent.click(screen.getByRole('button', { name: /^Back/ }));
const submit = (week: number) => fireEvent.click(screen.getByRole('button', { name: `Log Week ${week}` }));
const bookBox = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });
const bookCalls = () => mocks.markFloorCleared.mock.calls.map((c) => c[2] as MarkFloorClearedRequest);

function expectLocked(name: string) {
  const box = bookBox(name);
  expect(box, `${name} checked`).toBeChecked();
  expect(box, `${name} read-only`).toBeDisabled();
}
function expectUnlocked(name: string) {
  expect(bookBox(name), `${name} editable`).toBeEnabled();
}

beforeEach(() => {
  nextId = 1;
  mocks.logLootAndUpdateGear.mockReset().mockResolvedValue(undefined);
  mocks.logMaterialAndUpdateGear.mockReset().mockResolvedValue(undefined);
  mocks.markFloorCleared.mockReset().mockResolvedValue(undefined);
  mocks.storeState.markFloorCleared = mocks.markFloorCleared;
  mocks.storeState.pageLedger = [];
  mocks.storeState.loadingStates = { lootLog: false, materialLog: false, pageLedger: false };
  document.body.removeAttribute('style');
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  );
});

describe('LogWeekWizard — Books step and the page ledger (#326)', () => {
  it('acceptance: a player already credited for M9S week 11 is locked, labelled already logged, and never sent', async () => {
    mocks.storeState.pageLedger = [ledger(HEALER_TWO)];
    const { onClose } = renderWizard();
    clearOnly('M9S');
    next();

    expectLocked('Healer Two');
    expect(screen.getByText(/already logged/i)).toBeInTheDocument();
    for (const p of MAIN_PLAYERS.filter((x) => x.id !== HEALER_TWO.id)) expectUnlocked(p.name);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    next();
    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(mocks.markFloorCleared).toHaveBeenCalledTimes(1);
    const [req] = bookCalls();
    expect(req).toMatchObject({ weekNumber: 11, floor: 'M9S' });
    expect(new Set(req.playerIds)).toEqual(new Set(MAIN_PLAYERS.filter((p) => p.id !== HEALER_TWO.id).map((p) => p.id)));
  });

  it('a locked player cannot be toggled off, and Clear / Clear All Floors leave the lock in place and unsent', async () => {
    mocks.storeState.pageLedger = [ledger(HEALER_TWO)];
    const { onClose } = renderWizard();
    clearOnly('M9S');
    next();

    fireEvent.click(bookBox('Healer Two'));
    expectLocked('Healer Two');
    fireEvent.click(screen.getByRole('button', { name: 'Select All Floors' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear All Floors' }));
    expectLocked('Healer Two');
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expectLocked('Healer Two');

    fireEvent.click(bookBox('Tank One'));
    next();
    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bookCalls()).toEqual([expect.objectContaining({ floor: 'M9S', weekNumber: 11, playerIds: [TANK_ONE.id] })]);
  });

  it('a floor whose whole roster is already credited sends no markFloorCleared request', async () => {
    mocks.storeState.pageLedger = MAIN_PLAYERS.map((p) => ledger(p));
    const { onClose } = renderWizard();
    clearOnly('M9S');
    next();
    for (const p of MAIN_PLAYERS) expectLocked(p.name);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    next();
    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(mocks.logLootAndUpdateGear).toHaveBeenCalled(); // the week still logs its gear
    expect(mocks.markFloorCleared).not.toHaveBeenCalled();
  });

  it('only an earned entry for this tier, week and floor locks: spent, missed, other week, other floor and other tier do not', async () => {
    const tankTwo = DEVTST_PLAYERS.find((p) => p.name === 'Tank Two')!;
    const healerOne = DEVTST_PLAYERS.find((p) => p.name === 'Healer One')!;
    const melee1 = DEVTST_PLAYERS.find((p) => p.name === 'Melee One')!;
    const ranged1 = DEVTST_PLAYERS.find((p) => p.name === 'Ranged One')!;
    const caster1 = DEVTST_PLAYERS.find((p) => p.name === 'Caster One')!;
    mocks.storeState.pageLedger = [
      ledger(HEALER_TWO), // the one real credit
      ledger(tankTwo, { transactionType: 'spent' }),
      ledger(healerOne, { transactionType: 'missed' }),
      ledger(melee1, { weekNumber: 10 }),
      ledger(ranged1, { floor: 'M10S' }),
      ledger(caster1, { tierSnapshotId: 'some-other-tier' }), // a stale ledger from another tier
    ];
    const { onClose } = renderWizard();
    clearOnly('M9S');
    next();

    expectLocked('Healer Two');
    for (const p of [tankTwo, healerOne, melee1, ranged1, caster1, TANK_ONE]) expectUnlocked(p.name);

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    next();
    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(new Set(bookCalls()[0].playerIds)).toEqual(
      new Set([tankTwo, healerOne, melee1, ranged1, caster1, TANK_ONE].map((p) => p.id)),
    );
  });

  it('changing the in-modal week re-seeds: week 11 locks Healer Two, week 12 unlocks and sends her', async () => {
    mocks.storeState.pageLedger = [ledger(HEALER_TWO)];
    const { onClose } = renderWizard();
    clearOnly('M9S');
    next();
    expectLocked('Healer Two');

    back();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
    next();
    expectUnlocked('Healer Two');
    expect(screen.queryByText(/already logged/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    next();
    submit(12);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bookCalls()[0]).toMatchObject({ weekNumber: 12, floor: 'M9S' });
    expect(bookCalls()[0].playerIds).toContain(HEALER_TWO.id);
  });

  it('a ledger that lands after the wizard opened locks the player live and keeps them out of the request', async () => {
    mocks.storeState.pageLedger = [];
    const { onClose, rerender } = renderWizard();
    clearOnly('M9S');
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));

    mocks.storeState.pageLedger = [ledger(HEALER_TWO)];
    rerender();
    expectLocked('Healer Two');

    next();
    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bookCalls()).toHaveLength(1);
    expect(bookCalls()[0].playerIds).not.toContain(HEALER_TWO.id);
    expect(bookCalls()[0].playerIds).toHaveLength(MAIN_PLAYERS.length - 1);
  });

  it('single-floor mode, which pre-selects every player, still never sends an already-credited one', async () => {
    mocks.storeState.pageLedger = [ledger(HEALER_TWO, { floor: 'M10S' })];
    const { onClose } = renderWizard({ singleFloorMode: true, initialFloor: 2 });
    next();
    expectLocked('Healer Two');

    next();
    // Single-floor mode labels its submit by the floor, not the week.
    fireEvent.click(screen.getByRole('button', { name: 'Log M10S' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bookCalls()).toHaveLength(1);
    expect(bookCalls()[0]).toMatchObject({ weekNumber: 11, floor: 'M10S' });
    expect(new Set(bookCalls()[0].playerIds)).toEqual(
      new Set(MAIN_PLAYERS.filter((p) => p.id !== HEALER_TWO.id).map((p) => p.id)),
    );
  });
});
