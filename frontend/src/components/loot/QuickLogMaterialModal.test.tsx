// Characterization baseline for QuickLogMaterialModal — the shared component the
// legacy V1 shell renders directly (LootPriorityPanel.tsx:770). This suite pins
// the component's CURRENT behavior so any V1-visible change fails loudly as
// later Phase D8 tasks grow it. `logMaterialAndUpdateGear` is the only mock —
// the pure eligibility helpers (getEligibleSlotsForAugmentation,
// needsTomeWeaponItem, needsTomeWeaponAugmentation) run for real, so the
// fixtures below exercise the actual branch conditions read out of
// materialCoordination.ts, not a stand-in. `useLootTrackingStore` is left REAL
// (only `materialLog` is reset per test) and `getPriorityForUpgradeMaterial` /
// `getPriorityForUniversalTomestone` (utils/priority.ts) run for real too, so
// recipient-option ordering/labels are whatever the live scorer produces —
// tests that need a specific player never assert on that label, only on the
// player's own name (which the option's accessible name always contains
// alongside the JobIcon's alt text and any priority suffix).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer, GearSlotStatus, MaterialLogEntryCreate } from '../../types';

const { logMaterialAndUpdateGearMock } = vi.hoisted(() => ({
  logMaterialAndUpdateGearMock: vi.fn().mockResolvedValue(undefined),
}));

// Partial-mock: keep the pure helpers real (they decide which render branch
// fires), replace only the network-touching coordinator.
vi.mock('../../utils/materialCoordination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/materialCoordination')>();
  return {
    ...actual,
    logMaterialAndUpdateGear: logMaterialAndUpdateGearMock,
  };
});

import { QuickLogMaterialModal } from './QuickLogMaterialModal';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import type { LogMaterialOptions } from '../../utils/materialCoordination';

// ── Fixture helpers (modeled on materialCoordination.test.ts:19-64) ─────────
// Shared across this file's describe blocks, including ones later D8 tasks add.

function makeGear(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return {
    slot: 'body',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Test Player',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [
      makeGear({ slot: 'weapon', bisSource: 'raid' }),
      makeGear({ slot: 'head', bisSource: 'raid' }),
      makeGear({ slot: 'body', bisSource: 'raid' }),
      makeGear({ slot: 'hands', bisSource: 'raid' }),
      makeGear({ slot: 'legs', bisSource: 'raid' }),
      makeGear({ slot: 'feet', bisSource: 'raid' }),
      makeGear({ slot: 'earring', bisSource: 'raid' }),
      makeGear({ slot: 'necklace', bisSource: 'raid' }),
      makeGear({ slot: 'bracelet', bisSource: 'raid' }),
      makeGear({ slot: 'ring1', bisSource: 'raid' }),
      makeGear({ slot: 'ring2', bisSource: 'raid' }),
    ],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
    ...overrides,
  };
}

type ModalProps = React.ComponentProps<typeof QuickLogMaterialModal>;

/** Renders with the brief's pinned baseline props (g1/t1/M11S/maxWeek=3), overridable. */
function renderModal(overrides: Partial<ModalProps> & Pick<ModalProps, 'material' | 'suggestedPlayer' | 'allPlayers'>) {
  const props: ModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    groupId: 'g1',
    tierId: 't1',
    floor: 'M11S',
    maxWeek: 3,
    ...overrides,
  };
  return render(<QuickLogMaterialModal {...props} />);
}

// Checkboxes (ui/Checkbox) are a `<label>` wrapping a `div role="checkbox"` with
// no accessible name of its own (no aria-label passed here) — scope to the
// label whose visible text matches, then grab the checkbox inside it (same
// pattern as RecipientPicker.test.tsx).
function checkboxByLabelText(text: string): HTMLElement {
  const labelEl = screen.getByText(text).closest('label');
  if (!labelEl) throw new Error(`checkbox label not found for "${text}"`);
  return within(labelEl).getByRole('checkbox');
}

beforeEach(() => {
  // A dropdown left open at test-end (e.g. the solvent-dual fixture, which
  // opens its Select AFTER taking its snapshot) leaks Radix's scroll-lock
  // `style` attribute onto `<body>` past RTL's cleanup — it isn't
  // per-render state, so it bleeds into the NEXT test's baseElement snapshot
  // even though that test never touched a dropdown. Strip it before every
  // test so a subset run (`vitest -t ...`) can't produce a false snapshot
  // mismatch depending on what ran immediately before it.
  document.body.removeAttribute('style');
  // jsdom has no scrollIntoView; Radix Select calls it when keyboard-opened
  // (Roster.test.tsx doesn't need this because it never yields to the event
  // loop after opening — this file's dropdown-opening tests do).
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
  useLootTrackingStore.setState({ materialLog: [] });
  logMaterialAndUpdateGearMock.mockClear();
});

// The `V1 freeze baseline` describe block was written against the pre-D8
// component and MUST NOT be edited in this slice — it is the two-part
// assert's teeth. If a D8 task needs to change one of these tests, the task
// is wrong.
// Append new describe blocks AFTER this one — snapshots embed useId sequences.
describe('V1 freeze baseline', () => {
  describe('render branches', () => {
    it('twine: an eligible slot renders the gear checkbox + slot Select, static Floor/Material rows, week = maxWeek, no textarea, no player-select placeholder', () => {
      const p1 = makePlayer({
        id: 'p1',
        name: 'Alice',
        gear: [
          makeGear({ slot: 'weapon', bisSource: 'raid' }),
          makeGear({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false }),
          makeGear({ slot: 'body', bisSource: 'raid' }),
          makeGear({ slot: 'hands', bisSource: 'raid' }),
          makeGear({ slot: 'legs', bisSource: 'raid' }),
          makeGear({ slot: 'feet', bisSource: 'raid' }),
          makeGear({ slot: 'earring', bisSource: 'raid' }),
          makeGear({ slot: 'necklace', bisSource: 'raid' }),
          makeGear({ slot: 'bracelet', bisSource: 'raid' }),
          makeGear({ slot: 'ring1', bisSource: 'raid' }),
          makeGear({ slot: 'ring2', bisSource: 'raid' }),
        ],
      });
      const { baseElement } = renderModal({ material: 'twine', suggestedPlayer: p1, allPlayers: [p1] });

      expect(screen.getByRole('heading', { name: 'Log Twine' })).toBeInTheDocument();
      // Static info rows — not a role="group" selector, just labelled text pairs.
      expect(screen.getByText('Floor:')).toBeInTheDocument();
      expect(screen.getByText('M11S')).toBeInTheDocument();
      expect(screen.getByText('Material:')).toBeInTheDocument();
      expect(screen.getByText('Twine')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toHaveValue(3); // week defaults to maxWeek
      expect(checkboxByLabelText('Also mark gear as augmented for Alice')).toBeInTheDocument();
      const combos = screen.getAllByRole('combobox');
      expect(combos).toHaveLength(2); // Recipient + slot
      expect(combos[1]).toHaveTextContent('Head');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByText(/select player/i)).not.toBeInTheDocument();

      expect(baseElement).toMatchSnapshot();
    });

    it('universal tomestone: a player pursuing the tome weapon without it renders the canMarkTomeWeaponHave checkbox, no slot Select', () => {
      const p1 = makePlayer({
        id: 'p1',
        name: 'Bob',
        tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
      });
      const { baseElement } = renderModal({ material: 'universal_tomestone', suggestedPlayer: p1, allPlayers: [p1] });

      expect(screen.getByRole('heading', { name: 'Log Universal Tomestone' })).toBeInTheDocument();
      expect(checkboxByLabelText('Also mark tome weapon as obtained for Bob')).toBeInTheDocument();
      // Only the Recipient combobox — this branch has no gear-slot Select.
      expect(screen.getAllByRole('combobox')).toHaveLength(1);

      expect(baseElement).toMatchSnapshot();
    });

    it('solvent: tome weapon AND weapon slot both eligible renders the dual Select seeded to the SLOT — init-order asymmetry (slots[0] wins over the tome-augmentation check)', () => {
      const p1 = makePlayer({
        id: 'p1',
        name: 'Cara',
        gear: [
          makeGear({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false }),
          makeGear({ slot: 'head', bisSource: 'raid' }),
          makeGear({ slot: 'body', bisSource: 'raid' }),
          makeGear({ slot: 'hands', bisSource: 'raid' }),
          makeGear({ slot: 'legs', bisSource: 'raid' }),
          makeGear({ slot: 'feet', bisSource: 'raid' }),
          makeGear({ slot: 'earring', bisSource: 'raid' }),
          makeGear({ slot: 'necklace', bisSource: 'raid' }),
          makeGear({ slot: 'bracelet', bisSource: 'raid' }),
          makeGear({ slot: 'ring1', bisSource: 'raid' }),
          makeGear({ slot: 'ring2', bisSource: 'raid' }),
        ],
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      });
      const { baseElement } = renderModal({ material: 'solvent', suggestedPlayer: p1, allPlayers: [p1] });

      expect(screen.getByRole('heading', { name: 'Log Solvent' })).toBeInTheDocument();
      expect(checkboxByLabelText('Also mark gear as augmented for Cara')).toBeInTheDocument();
      const combos = screen.getAllByRole('combobox');
      expect(combos).toHaveLength(2); // Recipient + the dual Select
      // Init order: selectedSlot's initializer runs `slots[0]` before the
      // augmentTomeWeapon initializer even checks `slots.length === 0`, so the
      // dual Select opens on the SLOT, not "Tome Weapon", even though both
      // are eligible.
      expect(combos[1]).toHaveTextContent('Weapon');
      expect(combos[1]).not.toHaveTextContent('Tome Weapon');

      expect(baseElement).toMatchSnapshot();

      // Both options are present once opened.
      fireEvent.keyDown(combos[1], { key: 'Enter' });
      expect(screen.getByRole('option', { name: 'Tome Weapon' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Weapon' })).toBeInTheDocument();
    });

    it('solvent: tome weapon eligible but no gear slots renders the bare "Tome Weapon" text, no Select', () => {
      const p1 = makePlayer({
        id: 'p1',
        name: 'Dana',
        // weapon gear stays raid BiS (default) — not augmentation-eligible.
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      });
      const { baseElement } = renderModal({ material: 'solvent', suggestedPlayer: p1, allPlayers: [p1] });

      expect(screen.getByRole('heading', { name: 'Log Solvent' })).toBeInTheDocument();
      expect(checkboxByLabelText('Also mark gear as augmented for Dana')).toBeInTheDocument();
      expect(screen.getByText('Tome Weapon')).toBeInTheDocument();
      // The bare-text branch renders no Select — only the Recipient combobox.
      expect(screen.getAllByRole('combobox')).toHaveLength(1);

      expect(baseElement).toMatchSnapshot();
    });

    it('renders no gear block at all when the recipient has zero eligible options (all-raid player)', () => {
      const p1 = makePlayer({ id: 'p1', name: 'Eve' }); // default fixture: all-raid gear, tomeWeapon not pursuing
      const { baseElement } = renderModal({ material: 'twine', suggestedPlayer: p1, allPlayers: [p1] });

      expect(screen.getByRole('heading', { name: 'Log Twine' })).toBeInTheDocument();
      expect(screen.queryByText(/Also mark gear as augmented/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Also mark tome weapon as obtained/)).not.toBeInTheDocument();
      // Only the Recipient combobox — the entire conditional gear block is absent.
      expect(screen.getAllByRole('combobox')).toHaveLength(1);

      expect(baseElement).toMatchSnapshot();
    });
  });

  describe('interactions (twine fixture)', () => {
    function twineFixturePlayers(): { p1: SnapshotPlayer; p2: SnapshotPlayer } {
      const p1 = makePlayer({
        id: 'p1',
        name: 'Alice',
        gear: [
          makeGear({ slot: 'weapon', bisSource: 'raid' }),
          makeGear({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false }),
          makeGear({ slot: 'body', bisSource: 'raid' }),
          makeGear({ slot: 'hands', bisSource: 'raid' }),
          makeGear({ slot: 'legs', bisSource: 'raid' }),
          makeGear({ slot: 'feet', bisSource: 'raid' }),
          makeGear({ slot: 'earring', bisSource: 'raid' }),
          makeGear({ slot: 'necklace', bisSource: 'raid' }),
          makeGear({ slot: 'bracelet', bisSource: 'raid' }),
          makeGear({ slot: 'ring1', bisSource: 'raid' }),
          makeGear({ slot: 'ring2', bisSource: 'raid' }),
        ],
      });
      const p2 = makePlayer({
        id: 'p2',
        name: 'Bea',
        gear: [
          makeGear({ slot: 'weapon', bisSource: 'raid' }),
          makeGear({ slot: 'head', bisSource: 'raid' }),
          makeGear({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }),
          makeGear({ slot: 'hands', bisSource: 'raid' }),
          makeGear({ slot: 'legs', bisSource: 'raid' }),
          makeGear({ slot: 'feet', bisSource: 'raid' }),
          makeGear({ slot: 'earring', bisSource: 'raid' }),
          makeGear({ slot: 'necklace', bisSource: 'raid' }),
          makeGear({ slot: 'bracelet', bisSource: 'raid' }),
          makeGear({ slot: 'ring1', bisSource: 'raid' }),
          makeGear({ slot: 'ring2', bisSource: 'raid' }),
        ],
      });
      return { p1, p2 };
    }

    it('a recipient change re-inits eligibility to the NEW recipient (:156-187) — but a real, unmocked Radix effect-ordering race resets the slot Select back to placeholder, and the submit payload reflects that', async () => {
      // Ground truth (verified via a throwaway instrumented render, not
      // guessed, and cross-checked against the solvent-dual fixture's
      // committed snapshot — its hidden native <select> already lists BOTH
      // options before that Select is ever opened, so "items only register
      // once opened" is wrong): handleRecipientChange DOES call
      // setSelectedSlot('body') for p2 in the same tick. The real mechanism
      // is an effect-ordering race: switching recipient swaps this Select's
      // `options` array (p1's 'head' item out, p2's 'body' item in) in the
      // SAME commit as the controlled `value` changing to 'body'. Radix's
      // hidden native-<select> "bubble input" (form/autofill semantics) syncs
      // via a `useEffect` that assigns `select.value = 'body'` and dispatches
      // a native "change" event whenever the value changes — but the native
      // <option> for 'body' is (re)registered by a SEPARATE `useLayoutEffect`
      // (`onNativeOptionAdd`) whose state update hasn't re-rendered the
      // native option set yet when the bubble-input's sync effect runs, so
      // `.value = 'body'` no-ops against the stale (pre-swap) option set and
      // the native select's value falls back to `''`. The dispatched "change"
      // event's `event.target.value` is therefore `''`; this component's
      // onChange for the slot Select is unguarded
      // (`(val) => setSelectedSlot(val as GearSlot)`), so that '' clobbers
      // the just-computed 'body' back out. "Never opened" is NOT the trigger
      // condition — a previously-opened dropdown hits the identical race
      // whenever the new value wasn't already in the prior option set (e.g.
      // the solvent-dual fixture's OWN Select would hit this too if a THIRD
      // option were swapped in at the same instant its value changed to it).
      // This is real React-effect-ordering + <select> semantics
      // (reproducible in a real browser too, not a jsdom/fireEvent artifact)
      // — pinned here as current V1 behavior, not fixed.
      const { p1, p2 } = twineFixturePlayers();
      renderModal({ material: 'twine', suggestedPlayer: p1, allPlayers: [p1, p2] });

      // p1's (default) eligible slot is 'head'.
      expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Head');

      // Switch recipient to p2 — the third slot-init copy (:156-187) fires.
      fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recipient' }), { key: 'Enter' });
      fireEvent.click(screen.getByRole('option', { name: new RegExp(p2.name) }));

      // The recipient itself switched correctly...
      expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent(p2.name);
      // ...but the slot Select lands on the placeholder, not "Body", per the
      // race described above.
      expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Select...');

      fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
      await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

      const [, , data, options] = logMaterialAndUpdateGearMock.mock.calls[0] as [
        string, string, MaterialLogEntryCreate, LogMaterialOptions,
      ];
      // The recipient change DOES reach the submit payload...
      expect(data).toEqual(expect.objectContaining({ recipientPlayerId: 'p2' }));
      // ...but slotToAugment is undefined (selectedSlot is '', a falsy value)
      // — NOT 'body', because of the reset above.
      expect(options).toEqual(expect.objectContaining({ slotToAugment: undefined }));
    });

    it('submit (gear-update on): exact groupId/tierId/data args, no notes field, options carry updateGear+slotToAugment', async () => {
      const { p1, p2 } = twineFixturePlayers();
      renderModal({ material: 'twine', suggestedPlayer: p1, allPlayers: [p1, p2] });

      fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
      await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

      const call = logMaterialAndUpdateGearMock.mock.calls[0] as [
        string, string, MaterialLogEntryCreate, LogMaterialOptions,
      ];
      const [groupId, tierId, data, options] = call;
      expect(groupId).toBe('g1');
      expect(tierId).toBe('t1');
      expect(data).toEqual(expect.objectContaining({
        weekNumber: 3,
        floor: 'M11S',
        materialType: 'twine',
        recipientPlayerId: 'p1',
        method: 'drop',
      }));
      expect(data).not.toHaveProperty('notes');
      expect(options).toEqual(expect.objectContaining({ updateGear: true, slotToAugment: 'head' }));
    });

    it('submit (gear-update checkbox unchecked): options carry updateGear=false, slotToAugment=undefined', async () => {
      const { p1, p2 } = twineFixturePlayers();
      renderModal({ material: 'twine', suggestedPlayer: p1, allPlayers: [p1, p2] });

      fireEvent.click(checkboxByLabelText('Also mark gear as augmented for Alice'));
      fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
      await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

      const [, , , options] = logMaterialAndUpdateGearMock.mock.calls[0] as [
        string, string, MaterialLogEntryCreate, LogMaterialOptions,
      ];
      expect(options).toEqual(expect.objectContaining({ updateGear: false, slotToAugment: undefined }));
    });
  });

  // The asymmetric solvent render (dual Select seeded to the SLOT, not "Tome
  // Weapon" — see the render-branches fixture above) had no submit coverage:
  // component :210's `augmentTomeWeapon` payload mapping was unpinned.
  describe('interactions (solvent-dual fixture)', () => {
    function solventDualFixturePlayer(): SnapshotPlayer {
      return makePlayer({
        id: 'p1',
        name: 'Finn',
        gear: [
          makeGear({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false }),
          makeGear({ slot: 'head', bisSource: 'raid' }),
          makeGear({ slot: 'body', bisSource: 'raid' }),
          makeGear({ slot: 'hands', bisSource: 'raid' }),
          makeGear({ slot: 'legs', bisSource: 'raid' }),
          makeGear({ slot: 'feet', bisSource: 'raid' }),
          makeGear({ slot: 'earring', bisSource: 'raid' }),
          makeGear({ slot: 'necklace', bisSource: 'raid' }),
          makeGear({ slot: 'bracelet', bisSource: 'raid' }),
          makeGear({ slot: 'ring1', bisSource: 'raid' }),
          makeGear({ slot: 'ring2', bisSource: 'raid' }),
        ],
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      });
    }

    it('submit as-rendered (dual Select defaults to the SLOT): options carry slotToAugment=\'weapon\', augmentTomeWeapon=false', async () => {
      const p1 = solventDualFixturePlayer();
      renderModal({ material: 'solvent', suggestedPlayer: p1, allPlayers: [p1] });

      fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
      await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

      const [, , , options] = logMaterialAndUpdateGearMock.mock.calls[0] as [
        string, string, MaterialLogEntryCreate, LogMaterialOptions,
      ];
      expect(options).toEqual(expect.objectContaining({
        updateGear: true, slotToAugment: 'weapon', augmentTomeWeapon: false,
      }));
    });

    it('switching the dual Select to "Tome Weapon" then submitting: options carry slotToAugment=undefined, augmentTomeWeapon=true', async () => {
      const p1 = solventDualFixturePlayer();
      renderModal({ material: 'solvent', suggestedPlayer: p1, allPlayers: [p1] });

      // Both options are already registered on this Select from mount (the
      // render-branches fixture's committed snapshot proves it), so picking
      // a DIFFERENT already-known option here does not hit the effect-
      // ordering race described in the recipient-change test above — that
      // race is specific to a value changing in the same commit as its
      // option being newly registered.
      fireEvent.keyDown(screen.getAllByRole('combobox')[1], { key: 'Enter' });
      fireEvent.click(screen.getByRole('option', { name: 'Tome Weapon' }));
      expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Tome Weapon');

      fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
      await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

      const [, , , options] = logMaterialAndUpdateGearMock.mock.calls[0] as [
        string, string, MaterialLogEntryCreate, LogMaterialOptions,
      ];
      expect(options).toEqual(expect.objectContaining({
        updateGear: true, slotToAugment: undefined, augmentTomeWeapon: true,
      }));
    });
  });
});
