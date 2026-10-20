/**
 * LogWeekWizard — the wizard loads the page ledger itself (issue #326, review fix).
 *
 * No mount loads the ledger for the wizard (the Gear / Priority doors never open
 * History), so the wizard calls the store's `fetchPageLedger` on open and after
 * a submit, and gates submit while the ledger is in flight or failed, the same
 * way it gates an unknown loot log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';

const mocks = vi.hoisted(() => ({
  logLootAndUpdateGear: vi.fn(),
  logMaterialAndUpdateGear: vi.fn(),
  markFloorCleared: vi.fn(),
  fetchPageLedger: vi.fn(),
  storeState: {
    markFloorCleared: undefined as unknown,
    fetchPageLedger: undefined as unknown,
    pageLedger: [] as unknown[],
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
import {
  DEVTST_FLOORS, DEVTST_LOOT_LOG, DEVTST_MATERIAL_LOG, DEVTST_PLAYERS, DEVTST_SETTINGS, DEVTST_TIER_ID,
} from '../../../test/fixtures/devtst';

type WizardProps = ComponentProps<typeof LogWeekWizard>;

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

const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
const submitButton = () => screen.getByRole('button', { name: 'Log Week 11' });
function toConfirmStep() {
  next();
  next();
}

beforeEach(() => {
  mocks.logLootAndUpdateGear.mockReset().mockResolvedValue(undefined);
  mocks.logMaterialAndUpdateGear.mockReset().mockResolvedValue(undefined);
  mocks.markFloorCleared.mockReset().mockResolvedValue(undefined);
  mocks.fetchPageLedger.mockReset().mockResolvedValue(undefined);
  mocks.storeState.markFloorCleared = mocks.markFloorCleared;
  mocks.storeState.fetchPageLedger = mocks.fetchPageLedger;
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

describe('LogWeekWizard — loads the page ledger itself (#326)', () => {
  it('fetches the ledger for its group and tier when it opens, and not while closed', async () => {
    renderWizard({ isOpen: false });
    expect(mocks.fetchPageLedger).not.toHaveBeenCalled();

    renderWizard();
    await waitFor(() => expect(mocks.fetchPageLedger).toHaveBeenCalledTimes(1));
    expect(mocks.fetchPageLedger).toHaveBeenCalledWith('g1', DEVTST_TIER_ID);
  });

  it('refetches the ledger after a successful submit, before closing', async () => {
    const { onClose } = renderWizard();
    await waitFor(() => expect(mocks.fetchPageLedger).toHaveBeenCalledTimes(1));
    toConfirmStep();
    fireEvent.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.logLootAndUpdateGear).toHaveBeenCalled();
    expect(mocks.fetchPageLedger).toHaveBeenCalledTimes(2);
    expect(mocks.fetchPageLedger).toHaveBeenLastCalledWith('g1', DEVTST_TIER_ID);
  });

  it('does not refetch after a submit where nothing landed', async () => {
    mocks.logLootAndUpdateGear.mockRejectedValue(new Error('boom'));
    mocks.logMaterialAndUpdateGear.mockRejectedValue(new Error('boom'));
    const { onClose } = renderWizard();
    await waitFor(() => expect(mocks.fetchPageLedger).toHaveBeenCalledTimes(1));
    toConfirmStep();
    fireEvent.click(submitButton());

    await waitFor(() => expect(screen.getByText('boom', { selector: 'div' })).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.fetchPageLedger).toHaveBeenCalledTimes(1);
  });

  it('disables submit with a reason while the ledger is in flight, and re-enables it when it lands', async () => {
    mocks.storeState.loadingStates = { lootLog: false, materialLog: false, pageLedger: true };
    const { onClose, rerender } = renderWizard();
    toConfirmStep();

    expect(submitButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/loading the book ledger/i);
    fireEvent.click(submitButton());
    expect(mocks.logLootAndUpdateGear).not.toHaveBeenCalled();

    mocks.storeState.loadingStates = { lootLog: false, materialLog: false, pageLedger: false };
    rerender();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(submitButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('disables submit with a reason when the ledger fetch failed', async () => {
    mocks.fetchPageLedger.mockRejectedValue(new Error('ledger down'));
    renderWizard();
    toConfirmStep();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/couldn't load the book ledger/i));
    expect(submitButton()).toBeDisabled();
    fireEvent.click(submitButton());
    expect(mocks.logLootAndUpdateGear).not.toHaveBeenCalled();
  });
});
