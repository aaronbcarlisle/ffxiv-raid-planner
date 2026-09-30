/**
 * LogWeekWizard — LOG-1 (P0c Task 1, R-P0-9 / R-P0-10 / R-P0-11).
 *
 * Renders the REAL wizard on the DEVTST fixture. Only the three write actions
 * are mocked: `logLootAndUpdateGear` and `logMaterialAndUpdateGear` (the
 * `utils/*Coordination` wrappers the wizard calls, which are what reach the
 * lootTrackingStore) and the store's `markFloorCleared`. Ranking, seeding and
 * locking run for real.
 *
 * Row labels come from `GEAR_SLOT_NAMES` (`earring` → "Ears"), the same map
 * the unlocked rows use.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';

const mocks = vi.hoisted(() => ({
  logLootAndUpdateGear: vi.fn(),
  logMaterialAndUpdateGear: vi.fn(),
  markFloorCleared: vi.fn(),
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
  useLootTrackingStore: () => ({ markFloorCleared: mocks.markFloorCleared }),
}));

import { LogWeekWizard } from './index';
import { buildRecipientEntries } from '../../../utils/recipientRanking';
import { materialPriorityEntries } from '../materialSuggestion';
import { isPriorityDisabled } from '../../../utils/priority';
import { FLOOR_LOOT_TABLES, UPGRADE_MATERIAL_DISPLAY_NAMES, type FloorNumber } from '../../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, type GearSlot, type LootLogEntry, type LootLogEntryCreate, type StaticSettings } from '../../../types';
import {
  DEVTST_FLOORS, DEVTST_LOOT_LOG, DEVTST_MATERIAL_LOG, DEVTST_PLAYERS, DEVTST_SETTINGS, DEVTST_TIER_ID,
} from '../../../test/fixtures/devtst';

type WizardProps = ComponentProps<typeof LogWeekWizard>;

function renderWizard(overrides: Partial<WizardProps> = {}) {
  const onClose = vi.fn();
  render(
    <LogWeekWizard
      isOpen
      onClose={onClose}
      groupId="g1"
      tierId={DEVTST_TIER_ID}
      players={DEVTST_PLAYERS}
      settings={DEVTST_SETTINGS}
      floors={DEVTST_FLOORS}
      currentWeek={11}
      maxWeek={12}
      lootLog={DEVTST_LOOT_LOG}
      materialLog={DEVTST_MATERIAL_LOG}
      {...overrides}
    />,
  );
  return { onClose };
}

const floorTab = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const uncheckFloor = (name: string) => fireEvent.click(within(floorTab(name)).getByRole('checkbox'));
/** Leave M9S as the only cleared floor. */
function clearOnlyM9S() {
  for (const name of ['M10S', 'M11S', 'M12S']) uncheckFloor(name);
}
const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
const back = () => fireEvent.click(screen.getByRole('button', { name: /^Back/ }));
const goToConfirm = () => { next(); next(); };
const submit = (week: number) => fireEvent.click(screen.getByRole('button', { name: `Log Week ${week}` }));
const gearCombo = (slot: GearSlot) => screen.getByRole('combobox', { name: `${GEAR_SLOT_NAMES[slot]} recipient` });
const queryGearCombo = (slot: GearSlot) => screen.queryByRole('combobox', { name: `${GEAR_SLOT_NAMES[slot]} recipient` });
const dropToggle = (slot: GearSlot) => screen.getByRole('switch', { name: `Toggle ${GEAR_SLOT_NAMES[slot]} drop` });
const gearCalls = () => mocks.logLootAndUpdateGear.mock.calls.map((c) => c[2] as LootLogEntryCreate);
const enhancedActiveFor = (settings: StaticSettings, lootLog: LootLogEntry[]) =>
  settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0;

const LOCKED_EARRING = 'Ears → Healer Two · logged';
/** What Loot.tsx:1499/1564 passes to FloorCard and to the wizard: the configured main roster (7), not the substitute. */
const MAIN_PLAYERS = DEVTST_PLAYERS.filter((p) => p.configured && !p.isSubstitute);

beforeEach(() => {
  mocks.logLootAndUpdateGear.mockReset().mockResolvedValue(undefined);
  mocks.logMaterialAndUpdateGear.mockReset().mockResolvedValue(undefined);
  mocks.markFloorCleared.mockReset().mockResolvedValue(undefined);
  document.body.removeAttribute('style');
  // jsdom has no scrollIntoView; Radix Select calls it when keyboard-opened.
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom has no matchMedia; Modal -> useDevice depends on it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  );
});

describe('LogWeekWizard — seeding and locking (R-P0-9)', () => {
  it('acceptance: at week 11 the M9S earring already logged is locked, counted on confirm, and never sent', async () => {
    const { onClose } = renderWizard();
    clearOnlyM9S();

    // The locked row is read-only: the logged text, no picker, no toggle.
    expect(screen.getByText(LOCKED_EARRING)).toBeInTheDocument();
    expect(queryGearCombo('earring')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Toggle Ears drop' })).toBeNull();
    // The unlocked M9S rows still get a suggestion.
    expect(gearCombo('necklace')).toHaveTextContent(/Top Priority/);

    goToConfirm();
    expect(screen.getByText('1 already logged this week')).toBeInTheDocument();

    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const calls = gearCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.itemSlot === 'earring')).toHaveLength(0);
    expect(new Set(calls.map((c) => c.itemSlot))).toEqual(new Set(['necklace', 'bracelet', 'ring1']));
    for (const c of calls) expect(c).toMatchObject({ floor: 'M9S', weekNumber: 11, method: 'drop' });
  });

  it('changing the in-modal week to 12 re-seeds: the earring row is unlocked and suggested again', () => {
    renderWizard();
    expect(screen.getByText(LOCKED_EARRING)).toBeInTheDocument();
    expect(queryGearCombo('earring')).toBeNull();

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });

    expect(screen.queryByText(LOCKED_EARRING)).toBeNull();
    const top = buildRecipientEntries({
      players: DEVTST_PLAYERS, slot: 'earring', scope: 'priority', settings: DEVTST_SETTINGS,
      lootLog: DEVTST_LOOT_LOG, currentWeek: 12, enhancedActive: false,
    })[0].player;
    expect(gearCombo('earring')).toHaveTextContent(`${top.name} - Top Priority`);
  });

  it('"Restore All" (V1) restores only the unlocked slots; the locked earring stays locked and is never sent', async () => {
    const { onClose } = renderWizard();
    clearOnlyM9S();

    for (const slot of ['necklace', 'bracelet', 'ring1'] as GearSlot[]) fireEvent.click(dropToggle(slot));
    fireEvent.click(screen.getByRole('button', { name: 'Restore All' }));

    expect(screen.getByText(LOCKED_EARRING)).toBeInTheDocument();
    expect(queryGearCombo('earring')).toBeNull();
    for (const slot of ['necklace', 'bracelet', 'ring1'] as GearSlot[]) {
      expect(gearCombo(slot)).toHaveTextContent(/Top Priority/);
    }

    goToConfirm();
    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const calls = gearCalls();
    expect(calls.filter((c) => c.itemSlot === 'earring')).toHaveLength(0);
    expect(new Set(calls.map((c) => c.itemSlot))).toEqual(new Set(['necklace', 'bracelet', 'ring1']));
  });

  it('after a partial failure, "Restore All" and the retry resend only what did not succeed', async () => {
    // Necklace is marked "didn't drop" before the first submit so that, after
    // the books call fails, every unlocked slot is a no-drop and Restore All is
    // offered. The gear that succeeded (bracelet, ring) must come back locked,
    // so Restore All can only restore the necklace.
    mocks.markFloorCleared.mockRejectedValue(new Error('books failed'));
    const { onClose } = renderWizard();
    clearOnlyM9S();
    fireEvent.click(dropToggle('necklace'));
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Select All' })); // M9S books
    next();
    submit(11);

    await screen.findByText(/1 entries failed/);
    expect(onClose).not.toHaveBeenCalled();
    expect(new Set(gearCalls().map((c) => c.itemSlot))).toEqual(new Set(['bracelet', 'ring1']));
    expect(mocks.markFloorCleared).toHaveBeenCalledTimes(1);

    back();
    back();
    expect(screen.getByText(LOCKED_EARRING)).toBeInTheDocument();
    expect(screen.getByText(/^Wrists → .+ · logged$/)).toBeInTheDocument();
    expect(screen.getByText(/^R\. Ring → .+ · logged$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore All' }));
    expect(screen.getByText(/^Wrists → .+ · logged$/)).toBeInTheDocument();
    expect(screen.getByText(/^R\. Ring → .+ · logged$/)).toBeInTheDocument();
    expect(queryGearCombo('bracelet')).toBeNull();
    expect(queryGearCombo('ring1')).toBeNull();
    expect(gearCombo('necklace')).toHaveTextContent(/Top Priority/);

    mocks.logLootAndUpdateGear.mockClear();
    mocks.markFloorCleared.mockReset().mockResolvedValue(undefined);
    goToConfirm();
    submit(11);
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(gearCalls().map((c) => c.itemSlot)).toEqual(['necklace']);
    expect(mocks.markFloorCleared).toHaveBeenCalledTimes(1);
  });

  it('a same-slot entry logged another way (tome) does not lock the slot and shows the hint (V4)', () => {
    const tome: LootLogEntry = {
      ...DEVTST_LOOT_LOG[0], id: 999, itemSlot: 'necklace', method: 'tome',
      recipientPlayerId: 'p-ranged-1', recipientPlayerName: 'Ranged One',
    };
    renderWizard({ lootLog: [...DEVTST_LOOT_LOG, tome] });

    expect(gearCombo('necklace')).toHaveTextContent(/Top Priority/);
    expect(screen.getByText('Also logged this week: Neck → Ranged One (tome)')).toBeInTheDocument();
    expect(screen.queryByText(/^Neck → .+ · logged$/)).toBeNull();
    // The real drop is still locked.
    expect(screen.getByText(LOCKED_EARRING)).toBeInTheDocument();
  });

  it('with enhanced scoring on, the preselected player carries the "Top Priority" label (V5)', () => {
    const settings = { ...DEVTST_SETTINGS, enableEnhancedScoring: true };
    renderWizard({ settings, currentWeek: 12 });
    let compared = 0;
    for (const slot of FLOOR_LOOT_TABLES[1].gearDrops) {
      const combo = gearCombo(slot);
      if (combo.textContent?.includes('Free for All')) continue;
      expect(combo).toHaveTextContent(/ - Top Priority$/);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('seeds the ranking at the week it opens for, not the mount-time week (fix wave: stale selectedWeek)', () => {
    // Both real mounts keep the wizard mounted while its week prop moves
    // (Loot.tsx:1567 `writeWeek`; GroupViewContent.tsx:1073,1464 sets the week
    // in the same batch as opening). The seed must rank at the week it locks
    // for, or the pick is the mount week's #1 under the opened week's labels.
    // On this fixture the M9S earring's enhanced #1 is Tank One up to week 15
    // and Healer Two from week 16 (her week-11 drought reaches the 5-week
    // cap), so mount at 16 and open at 12.
    const settings: StaticSettings = { ...DEVTST_SETTINGS, enableEnhancedScoring: true };
    const props = {
      onClose: vi.fn(), groupId: 'g1', tierId: DEVTST_TIER_ID, players: DEVTST_PLAYERS, settings,
      floors: DEVTST_FLOORS, maxWeek: 16, lootLog: DEVTST_LOOT_LOG, materialLog: DEVTST_MATERIAL_LOG,
    };
    const { rerender } = render(<LogWeekWizard {...props} isOpen={false} currentWeek={16} />);
    rerender(<LogWeekWizard {...props} isOpen currentWeek={12} />);

    let compared = 0;
    for (const slot of FLOOR_LOOT_TABLES[1].gearDrops) {
      const expected = buildRecipientEntries({
        players: MAIN_PLAYERS, slot: slot === 'ring1' ? 'ring' : slot, scope: 'priority',
        settings, lootLog: DEVTST_LOOT_LOG, currentWeek: 12, enhancedActive: true,
      })[0]?.player;
      const combo = gearCombo(slot);
      if (!expected) continue;
      expect(combo, slot).toHaveTextContent(`${expected.name} - Top Priority`);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(0);
  });
});

describe.each([[false], [true]])('LogWeekWizard — consistency with Queues, enableEnhancedScoring=%s (R-P0-10)', (enhanced) => {
  it('for every M9S–M12S gear slot and material, the suggested player is entry #1 of the Queues ranking', () => {
    const settings: StaticSettings = { ...DEVTST_SETTINGS, enableEnhancedScoring: enhanced };
    const currentWeek = 12; // nothing is logged at week 12, so no row is locked
    const enhancedActive = enhancedActiveFor(settings, DEVTST_LOOT_LOG);
    expect(enhancedActive).toBe(enhanced);
    renderWizard({ settings, currentWeek });

    let compared = 0;
    for (const floorNum of [1, 2, 3, 4] as FloorNumber[]) {
      fireEvent.click(floorTab(DEVTST_FLOORS[floorNum - 1]));
      const table = FLOOR_LOOT_TABLES[floorNum];

      for (const slot of table.gearDrops) {
        // Built exactly as FloorCard.tsx builds its gear rows (on the main roster Loot.tsx hands it).
        const expected = buildRecipientEntries({
          players: MAIN_PLAYERS, slot: slot === 'ring1' ? 'ring' : slot, scope: 'priority',
          settings, lootLog: DEVTST_LOOT_LOG, currentWeek, enhancedActive,
        })[0]?.player;
        const combo = gearCombo(slot);
        if (expected) {
          expect(combo, `${DEVTST_FLOORS[floorNum - 1]} ${slot}`).toHaveTextContent(`${expected.name} - Top Priority`);
          compared += 1;
        } else {
          expect(combo).toHaveTextContent('(Free for All)');
        }
      }

      for (const material of table.upgradeMaterials) {
        // Built exactly as FloorCard.tsx builds its material rows (main roster: averageDrops divides by its size).
        const expected = materialPriorityEntries({
          material, players: MAIN_PLAYERS, settings, lootLog: DEVTST_LOOT_LOG,
          materialLog: DEVTST_MATERIAL_LOG, currentWeek,
        })[0]?.player;
        const combo = screen.getByRole('combobox', { name: `${UPGRADE_MATERIAL_DISPLAY_NAMES[material]} recipient` });
        if (expected) {
          expect(combo, `${DEVTST_FLOORS[floorNum - 1]} ${material}`).toHaveTextContent(`${expected.name} - Top Priority`);
          compared += 1;
        } else {
          expect(combo).toHaveTextContent('(No one needs this)');
        }
      }
    }
    expect(compared).toBeGreaterThan(0);
  });
});
