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
import type { SnapshotPlayer, GearSlotStatus, MaterialLogEntryCreate, MaterialLogEntry } from '../../types';

const { logMaterialAndUpdateGearMock, updateMaterialAndReconcileGearMock } = vi.hoisted(() => ({
  logMaterialAndUpdateGearMock: vi.fn().mockResolvedValue(undefined),
  updateMaterialAndReconcileGearMock: vi.fn().mockResolvedValue(undefined),
}));

// Partial-mock: keep the pure helpers real (they decide which render branch
// fires), replace only the network-touching coordinators.
vi.mock('../../utils/materialCoordination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/materialCoordination')>();
  return {
    ...actual,
    logMaterialAndUpdateGear: logMaterialAndUpdateGearMock,
    updateMaterialAndReconcileGear: updateMaterialAndReconcileGearMock,
  };
});

import { QuickLogMaterialModal } from './QuickLogMaterialModal';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import type { LogMaterialOptions, UpdateMaterialOptions } from '../../utils/materialCoordination';

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

// Pinned-branch-only — this helper renders the V1 baseline shape (`floor`+`material`+
// `suggestedPlayer`); `Extract` collapses the modal's pinned/free-form union to the single
// object shape so `Partial<ModalProps>` below doesn't distribute over the union.
type ModalProps = Extract<React.ComponentProps<typeof QuickLogMaterialModal>, { floor: string }>;

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
  updateMaterialAndReconcileGearMock.mockClear();
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

// D8 Task 3B: the free-form door (the Log toolbar mounts it in a later task) — floor +
// material selectors, auto-recipient, and the "Include substitutes" widening.
describe('free-form mode (R-26)', () => {
  const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];

  // Single-material fixture: each player needs exactly one of the four materials, so
  // auto-recipient ranking per material is unambiguous.
  function freeformPlayers(): { gina: SnapshotPlayer; uzo: SnapshotPlayer } {
    const gina = makePlayer({
      id: 'gina',
      name: 'Gina',
      gear: [
        makeGear({ slot: 'weapon', bisSource: 'raid' }),
        makeGear({ slot: 'head', bisSource: 'raid' }),
        makeGear({ slot: 'body', bisSource: 'raid' }),
        makeGear({ slot: 'hands', bisSource: 'raid' }),
        makeGear({ slot: 'legs', bisSource: 'raid' }),
        makeGear({ slot: 'feet', bisSource: 'raid' }),
        makeGear({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }), // needs glaze
        makeGear({ slot: 'necklace', bisSource: 'raid' }),
        makeGear({ slot: 'bracelet', bisSource: 'raid' }),
        makeGear({ slot: 'ring1', bisSource: 'raid' }),
        makeGear({ slot: 'ring2', bisSource: 'raid' }),
      ],
    });
    const uzo = makePlayer({
      id: 'uzo',
      name: 'Uzo',
      tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false }, // needs universal tomestone
    });
    return { gina, uzo };
  }

  // Discriminates on required `initialWeek` (Task 6's `edit` branch also has required `floors`,
  // so that alone no longer picks out free-form uniquely; `edit`'s `initialWeek?: never` is
  // optional and so isn't extracted by a REQUIRED-`initialWeek` filter).
  function renderFreeform(
    overrides: Partial<Extract<React.ComponentProps<typeof QuickLogMaterialModal>, { initialWeek: number }>> = {},
    allPlayers: SnapshotPlayer[] = [],
  ) {
    const props: Extract<React.ComponentProps<typeof QuickLogMaterialModal>, { initialWeek: number }> = {
      isOpen: true,
      onClose: vi.fn(),
      groupId: 'g1',
      tierId: 't1',
      maxWeek: 5,
      floors: FLOORS,
      initialWeek: 2,
      allPlayers,
      ...overrides,
    };
    return render(<QuickLogMaterialModal {...props} />);
  }

  it('floor pills show the two material floors labeled via `floors`, defaulting to F2 with Glaze auto-picked; title reads "Log Material"', () => {
    const { gina, uzo } = freeformPlayers();
    renderFreeform({}, [gina, uzo]);

    expect(screen.getByRole('heading', { name: 'Log Material' })).toBeInTheDocument();

    const floorGroup = screen.getByRole('group', { name: 'Floor' });
    expect(within(floorGroup).getByRole('button', { name: 'M10S' })).toHaveAttribute('aria-pressed', 'true'); // floor 2
    expect(within(floorGroup).getByRole('button', { name: 'M11S' })).toHaveAttribute('aria-pressed', 'false'); // floor 3
    expect(within(floorGroup).queryByRole('button', { name: 'M9S' })).not.toBeInTheDocument();
    expect(within(floorGroup).queryByRole('button', { name: 'M12S' })).not.toBeInTheDocument();

    const materialGroup = screen.getByRole('group', { name: 'Material' });
    expect(within(materialGroup).getByRole('button', { name: 'Glaze' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(materialGroup).getByRole('button', { name: 'Universal Tomestone' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('picking Floor 3 swaps the material pills to Twine + Solvent, with Twine auto-picked', () => {
    renderFreeform({}, []);
    fireEvent.click(screen.getByRole('button', { name: 'M11S' }));

    const materialGroup = screen.getByRole('group', { name: 'Material' });
    expect(within(materialGroup).getByRole('button', { name: 'Twine' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(materialGroup).getByRole('button', { name: 'Solvent' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(materialGroup).queryByRole('button', { name: 'Glaze' })).not.toBeInTheDocument();
  });

  it('auto-recipient: top-priority needer per material (incl. the mount-seeded default), re-ranks on a floor cascade, and a manual pick survives a same-floor re-click (both floors)', () => {
    const { gina, uzo } = freeformPlayers();
    renderFreeform({}, [gina, uzo]);

    // Fix round 1, item 4: `recipientPlayerId` is now seeded synchronously at mount (a lazy
    // `useState` initializer computing the same ranking the auto-recipient effect below uses),
    // so the very first render already carries the default material's (Glaze) top-priority
    // needer — Gina — with no post-mount `'' -> id` transition left for the pinned Radix
    // Select race (see QuickLogMaterialModal.tsx's auto-recipient effect comment) to clobber.
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Gina');

    // Material pill: Universal Tomestone -> only Uzo needs it.
    fireEvent.click(screen.getByRole('button', { name: 'Universal Tomestone' }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Uzo');

    // Back to Glaze: re-ranks to Gina (the default material's top-priority needer).
    fireEvent.click(screen.getByRole('button', { name: 'Glaze' }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Gina');

    // Manually pick a DIFFERENT player (Uzo) while still on Glaze, then re-click the SAME
    // (already-active) floor pill. Today's two floors never share a material, so the only
    // reachable "floor-only change" is re-clicking the active floor — it must not clobber the
    // manual pick.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recipient' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: new RegExp(uzo.name) }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Uzo');
    fireEvent.click(screen.getByRole('button', { name: 'M10S' })); // re-click floor 2 (active)
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Uzo');

    // Floor cascade (M11S carries neither Glaze nor Universal Tomestone, so switching to it
    // is a real material change to Twine, which nobody needs — the correct re-rank falls back
    // to alphabetical: Gina, DIFFERENT from Uzo, the manual pick still in effect going in).
    // This assertion is item 3's regression pin: it only passes if `pickFloor`'s cascade still
    // calls `applyMaterialChange` (which resets `userPickedRecipient` so the auto-recipient
    // effect can re-fire) — drop that call and this would incorrectly stay 'Uzo' (verified: see
    // the fix-round report for the before/after repro of exactly this).
    fireEvent.click(screen.getByRole('button', { name: 'M11S' }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Gina');

    // Manually re-pick (Uzo again, different from the Gina re-rank), then re-click the SAME
    // floor pill (M11S, active) — must not clobber. Covers "both directions" together with
    // the M10S no-clobber assertion above.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recipient' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: new RegExp(uzo.name) }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Uzo');
    fireEvent.click(screen.getByRole('button', { name: 'M11S' })); // re-click floor 3 (active)
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Uzo');
  });

  it('auto-recipient re-rank re-derives gear selection for the NEWLY picked recipient, not the pre-rank one (fix round 1, item 1)', async () => {
    // Bug repro: pick Universal Tomestone (auto-picks Uzo, who has no glaze-eligible slot —
    // irrelevant to UT anyway), then pick Glaze. `applyMaterialChange` derives gear for
    // whoever was CURRENT (Uzo) before the auto-recipient effect re-ranks to Gina (the actual
    // Glaze needer) — without item 1's fix, Gina's gear checkbox/slot Select would show empty
    // (derived from Uzo, who has zero eligible Glaze slots) even though the UI's own
    // `hasEligibleOptions`/Checkbox (driven by a separate, always-correct `eligibleOptions`
    // memo) claims a slot IS being augmented, and submit would silently send
    // `slotToAugment: undefined`.
    const { gina, uzo } = freeformPlayers();
    renderFreeform({}, [gina, uzo]);

    fireEvent.click(screen.getByRole('button', { name: 'Universal Tomestone' }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Uzo');

    fireEvent.click(screen.getByRole('button', { name: 'Glaze' }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Gina');

    expect(checkboxByLabelText('Also mark gear as augmented for Gina')).toBeInTheDocument();
    const slotSelect = screen.getAllByRole('combobox')[1]; // Recipient + the gear-slot Select
    expect(slotSelect).toHaveTextContent('Ears'); // GEAR_SLOT_NAMES['earring']

    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));
    const [, , , options] = logMaterialAndUpdateGearMock.mock.calls[0] as [
      string, string, MaterialLogEntryCreate, LogMaterialOptions,
    ];
    expect(options).toEqual(expect.objectContaining({ updateGear: true, slotToAugment: 'earring' }));
  });

  it('week shows initialWeek', () => {
    renderFreeform({ initialWeek: 4, maxWeek: 6 }, []);
    expect(screen.getByRole('spinbutton')).toHaveValue(4);
  });

  it('Include substitutes: off by default (a needing sub is absent from the Select); checked reveals them and they can receive the submit payload', async () => {
    const gina = makePlayer({
      id: 'gina',
      name: 'Gina', // doesn't need glaze — keeps the recipient list uncluttered
    });
    const sara = makePlayer({
      id: 'sara',
      name: 'Sara',
      isSubstitute: true,
      gear: [
        makeGear({ slot: 'weapon', bisSource: 'raid' }),
        makeGear({ slot: 'head', bisSource: 'raid' }),
        makeGear({ slot: 'body', bisSource: 'raid' }),
        makeGear({ slot: 'hands', bisSource: 'raid' }),
        makeGear({ slot: 'legs', bisSource: 'raid' }),
        makeGear({ slot: 'feet', bisSource: 'raid' }),
        makeGear({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }), // needs glaze
        makeGear({ slot: 'necklace', bisSource: 'raid' }),
        makeGear({ slot: 'bracelet', bisSource: 'raid' }),
        makeGear({ slot: 'ring1', bisSource: 'raid' }),
        makeGear({ slot: 'ring2', bisSource: 'raid' }),
      ],
    });
    renderFreeform({}, [gina, sara]);

    expect(screen.getByText('Include substitutes')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recipient' }), { key: 'Enter' });
    expect(screen.queryByRole('option', { name: new RegExp(sara.name) })).not.toBeInTheDocument();
    // Close by picking the only other option (Gina) — the well-tested close mechanism this
    // file already relies on elsewhere; a keyboard Escape doesn't reliably close a Radix
    // Select under fireEvent.
    fireEvent.click(screen.getByRole('option', { name: new RegExp(gina.name) }));

    fireEvent.click(checkboxByLabelText('Include substitutes'));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recipient' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: new RegExp(sara.name) }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Sara');

    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));
    const [, , data] = logMaterialAndUpdateGearMock.mock.calls[0] as [string, string, MaterialLogEntryCreate];
    expect(data).toEqual(expect.objectContaining({ recipientPlayerId: 'sara' }));
  });

  it('a subs toggle does not clobber a manual slot pick when the auto-recipient does not move (fix round 7)', async () => {
    // Round-7 review repro: "Include substitutes" re-creates `eligiblePlayers` (its memo
    // depends on `includeSubs`), so `sortedRecipients` gets a new identity and the
    // auto-recipient effect fires even though the ranking is unchanged. The recipient id is
    // unchanged (`setRecipientPlayerId` bails out) — the gear re-derivation must bail out
    // too, or a manually picked slot snaps back to the derived initial and submit augments
    // the WRONG slot. Distinct from the subs test above: there the recipient is picked
    // manually first, arming `userPickedRecipient` and disabling the effect entirely; here
    // only the SLOT changes, so the guard stays unarmed.
    const gina = makePlayer({
      id: 'gina',
      name: 'Gina',
      gear: [
        makeGear({ slot: 'weapon', bisSource: 'raid' }),
        makeGear({ slot: 'head', bisSource: 'raid' }),
        makeGear({ slot: 'body', bisSource: 'raid' }),
        makeGear({ slot: 'hands', bisSource: 'raid' }),
        makeGear({ slot: 'legs', bisSource: 'raid' }),
        makeGear({ slot: 'feet', bisSource: 'raid' }),
        makeGear({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }), // needs glaze
        makeGear({ slot: 'necklace', bisSource: 'tome', hasItem: true, isAugmented: false }), // needs glaze
        makeGear({ slot: 'bracelet', bisSource: 'raid' }),
        makeGear({ slot: 'ring1', bisSource: 'raid' }),
        makeGear({ slot: 'ring2', bisSource: 'raid' }),
      ],
    });
    const sara = makePlayer({ id: 'sara', name: 'Sara', isSubstitute: true });
    renderFreeform({}, [gina, sara]);

    // Mount seed: Gina auto-picked (Glaze top needer), slot Select seeded to her first
    // eligible slot.
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Gina');
    expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Ears');

    // Change ONLY the slot — the recipient Select is never touched.
    fireEvent.keyDown(screen.getAllByRole('combobox')[1], { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Neck' }));
    expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Neck');

    // Subs toggle: new `sortedRecipients` identity, same top pick (Sara isn't a needer).
    fireEvent.click(checkboxByLabelText('Include substitutes'));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Gina');
    expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Neck');

    // And the submit payload keeps the manual pick.
    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));
    const [, , , options] = logMaterialAndUpdateGearMock.mock.calls[0] as [
      string, string, MaterialLogEntryCreate, LogMaterialOptions,
    ];
    expect(options).toEqual(expect.objectContaining({ updateGear: true, slotToAugment: 'necklace' }));
  });

  it('submit sends the picked floor name, material, and week', async () => {
    const { gina, uzo } = freeformPlayers();
    renderFreeform({ initialWeek: 3 }, [gina, uzo]);
    fireEvent.click(screen.getByRole('button', { name: 'M11S' })); // floor 3 -> cascades to twine

    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));
    const [, , data] = logMaterialAndUpdateGearMock.mock.calls[0] as [string, string, MaterialLogEntryCreate];
    expect(data).toEqual(expect.objectContaining({ floor: 'M11S', materialType: 'twine', weekNumber: 3 }));
  });
});

// Fix round 1, item 2: pinned's own `initialWeek` (D5's Log-cell door) — NOT part of the
// frozen "V1 freeze baseline" block (V1 never passes this prop, so it's untested there), but
// still a pinned-mode behavior, so it gets its own describe rather than living under
// 'free-form mode (R-26)'.
describe('pinned initialWeek (D5, R-20 coherence)', () => {
  it('pinned + initialWeek renders that week and submits it, not maxWeek', async () => {
    const p1 = makePlayer({ id: 'p1', name: 'Alice' });
    renderModal({
      material: 'twine', suggestedPlayer: p1, allPlayers: [p1],
      initialWeek: 2, maxWeek: 5,
    });

    expect(screen.getByRole('spinbutton')).toHaveValue(2);

    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));
    const [, , data] = logMaterialAndUpdateGearMock.mock.calls[0] as [string, string, MaterialLogEntryCreate];
    expect(data).toEqual(expect.objectContaining({ weekNumber: 2 }));
  });
});

// D8 Task 4: the notes field — v2-only (pinned's `showNotes` cell door + free-form, always).
// V1 (pinned WITHOUT showNotes) keeps the frozen no-textarea behavior pinned above.
describe('notes (R-26)', () => {
  function renderFreeformWithPlayer(
    overrides: Partial<Extract<React.ComponentProps<typeof QuickLogMaterialModal>, { initialWeek: number }>> = {},
  ) {
    const player = makePlayer({ id: 'p1', name: 'Nora' });
    const props: Extract<React.ComponentProps<typeof QuickLogMaterialModal>, { initialWeek: number }> = {
      isOpen: true,
      onClose: vi.fn(),
      groupId: 'g1',
      tierId: 't1',
      maxWeek: 5,
      floors: ['M9S', 'M10S', 'M11S', 'M12S'],
      initialWeek: 2,
      allPlayers: [player],
      ...overrides,
    };
    return render(<QuickLogMaterialModal {...props} />);
  }

  it('pinned + showNotes renders the notes textarea', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Alice' });
    renderModal({ material: 'twine', suggestedPlayer: p1, allPlayers: [p1], showNotes: true });

    expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
  });

  it('free-form always renders the notes textarea', () => {
    renderFreeformWithPlayer();

    expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
  });

  it('a typed note reaches the create payload, trimmed', async () => {
    renderFreeformWithPlayer();

    fireEvent.change(screen.getByLabelText('Notes (optional)'), {
      target: { value: '  got it from FC chest  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

    const [, , data] = logMaterialAndUpdateGearMock.mock.calls[0] as [string, string, MaterialLogEntryCreate];
    expect(data.notes).toBe('got it from FC chest');
  });

  it('whitespace-only input leaves the notes key absent from the create payload', async () => {
    renderFreeformWithPlayer();

    fireEvent.change(screen.getByLabelText('Notes (optional)'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

    const [, , data] = logMaterialAndUpdateGearMock.mock.calls[0] as [string, string, MaterialLogEntryCreate];
    expect(data).not.toHaveProperty('notes');
  });
});

// D8 Task 6: edit mode (R-21) — the entry's old-vs-new reconciliation. `updateMaterialAndReconcileGear`
// is mocked (partial-mock, same pattern as `logMaterialAndUpdateGear`); the pure eligibility
// helpers stay real.
describe('edit mode (R-21)', () => {
  const EDIT_FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];

  // sara: 'head' is the entry's own (already-augmented) slot; 'body' is newly eligible (not
  // yet augmented) — exercises `withOriginalSlot` offering both at once.
  // theo: 'body' is newly eligible — the recipient a "recipient change" test switches to.
  function editFixturePlayers(): { sara: SnapshotPlayer; theo: SnapshotPlayer } {
    const sara = makePlayer({
      id: 'sara',
      name: 'Sara',
      isSubstitute: true,
      gear: [
        makeGear({ slot: 'weapon', bisSource: 'raid' }),
        makeGear({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true }),
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
    const theo = makePlayer({
      id: 'theo',
      name: 'Theo',
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
    return { sara, theo };
  }

  function editEntryFixture(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
    return {
      id: 42,
      tierSnapshotId: 't1',
      weekNumber: 2,
      floor: 'M11S',
      materialType: 'twine',
      recipientPlayerId: 'sara',
      recipientPlayerName: 'Sara',
      method: 'book',
      slotAugmented: 'head',
      notes: 'from static chest',
      createdAt: '2026-01-09T00:00:00Z',
      createdByUserId: 'u1',
      createdByUsername: 'Lead',
      ...overrides,
    };
  }

  function renderEdit(
    overrides: Partial<Extract<React.ComponentProps<typeof QuickLogMaterialModal>, { editEntry: MaterialLogEntry }>> = {},
    allPlayers: SnapshotPlayer[] = [],
  ) {
    const props: Extract<React.ComponentProps<typeof QuickLogMaterialModal>, { editEntry: MaterialLogEntry }> = {
      isOpen: true,
      onClose: vi.fn(),
      groupId: 'g1',
      tierId: 't1',
      maxWeek: 5,
      floors: EDIT_FLOORS,
      editEntry: editEntryFixture(),
      allPlayers,
      ...overrides,
    };
    return render(<QuickLogMaterialModal {...props} />);
  }

  it('prefills floor, material, recipient, week, method, gear checkbox, and notes from the entry; auto-checks Include substitutes for a sub recipient', () => {
    const { sara, theo } = editFixturePlayers();
    renderEdit({}, [sara, theo]);

    expect(screen.getByRole('heading', { name: 'Edit Material Entry' })).toBeInTheDocument();

    const floorGroup = screen.getByRole('group', { name: 'Floor' });
    expect(within(floorGroup).getByRole('button', { name: 'M11S' })).toHaveAttribute('aria-pressed', 'true');

    const materialGroup = screen.getByRole('group', { name: 'Material' });
    expect(within(materialGroup).getByRole('button', { name: 'Twine' })).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    expect(screen.getByRole('radio', { name: 'Book' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Sara');
    expect(checkboxByLabelText('Include substitutes')).toBeChecked();
    expect(checkboxByLabelText('Also mark gear as augmented for Sara')).toBeChecked();
    expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Head');
    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('from static chest');
  });

  it('offers the entry\'s own (already-augmented) slot in the slot Select alongside a newly-eligible slot', () => {
    const { sara, theo } = editFixturePlayers();
    renderEdit({}, [sara, theo]);

    const combos = screen.getAllByRole('combobox');
    expect(combos).toHaveLength(2); // Recipient + slot
    expect(combos[1]).toHaveTextContent('Head');

    fireEvent.keyDown(combos[1], { key: 'Enter' });
    expect(screen.getByRole('option', { name: 'Head' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Body' })).toBeInTheDocument();
  });

  it('injects the entry\'s recipient into the Select by name when they are missing from allPlayers', async () => {
    const { theo } = editFixturePlayers();
    const entry = editEntryFixture({ recipientPlayerId: 'ghost', recipientPlayerName: 'Ghost Player' });
    renderEdit({ editEntry: entry }, [theo]); // 'sara'/'ghost' absent from allPlayers

    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Ghost Player');
    // PR #236 review (Copilot suppressed comment): the preview must fall back to the entry's
    // recorded name for an out-of-pool recipient — never an empty gap.
    expect(screen.getByText(/~ Update Twine entry for Ghost Player \(Week 2\)/)).toBeInTheDocument();
    // Round 8 (Copilot): with the recipient gone from the roster, the gear section stays
    // hidden — the old recorded-slot clause forced `hasEligibleOptions` true here and promised
    // a reconciliation `updateMaterialAndReconcileGear` would silently no-op (it can't find
    // the player either).
    expect(screen.queryByLabelText(/Also mark gear/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1); // Recipient only — no slot Select
    // The payload-level pin: the old clause made `shouldUpdateGear` true, so submit sent
    // `updateGear: true, slotToAugment: 'head'` (the lazy seed keeps the entry's slot) for a
    // player the coordinator can't resolve. It must send a truthful `updateGear: false`.
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(updateMaterialAndReconcileGearMock).toHaveBeenCalledTimes(1));
    const [, , , , options] = updateMaterialAndReconcileGearMock.mock.calls[0] as [
      string, string, MaterialLogEntry, unknown, UpdateMaterialOptions,
    ];
    expect(options).toEqual(expect.objectContaining({ updateGear: false, slotToAugment: undefined }));
  });

  it('hides the gear section when the recipient is switched to a player with no eligible slots (fix round 8)', async () => {
    // The recorded-slot clause's other false-promise path: the entry's slot belongs to the
    // ORIGINAL recipient; after switching to a player with nothing eligible, the section must
    // hide rather than promise an augmentation the coordinator has no slot to apply (the
    // recipient-change rule leaves the old recipient's gear untouched, so the recorded slot is
    // irrelevant to the new pick).
    const { sara } = editFixturePlayers();
    const nix = makePlayer({ id: 'nix', name: 'Nix' }); // no tome gear -> nothing twine-eligible
    renderEdit({}, [sara, nix]);

    // Original recipient (Sara, in-pool): the memo re-offers the entry's own slot.
    expect(screen.getByLabelText(/Also mark gear as augmented for Sara/)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recipient' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: /Nix/ }));
    expect(screen.getByRole('combobox', { name: 'Recipient' })).toHaveTextContent('Nix');

    expect(screen.queryByLabelText(/Also mark gear/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1); // Recipient only — no slot Select

    // Payload-level pin: pre-fix, `shouldUpdateGear` stayed true (the clause fired off the
    // ENTRY's recorded slot even though it belongs to the original recipient), sending a
    // hollow `updateGear: true` with nothing to apply. It must send `updateGear: false`.
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(updateMaterialAndReconcileGearMock).toHaveBeenCalledTimes(1));
    const [, , , , options] = updateMaterialAndReconcileGearMock.mock.calls[0] as [
      string, string, MaterialLogEntry, unknown, UpdateMaterialOptions,
    ];
    expect(options).toEqual(expect.objectContaining({ updateGear: false }));
  });

  it('m4: when the parsed floor lacks the entry\'s material, falls back to the material\'s home floor (M9S + twine -> M11S/Twine pressed)', () => {
    const { sara, theo } = editFixturePlayers();
    const entry = editEntryFixture({ floor: 'M9S', materialType: 'twine' });
    renderEdit({ editEntry: entry }, [sara, theo]);

    const floorGroup = screen.getByRole('group', { name: 'Floor' });
    expect(within(floorGroup).getByRole('button', { name: 'M11S' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(floorGroup).getByRole('button', { name: 'M10S' })).toHaveAttribute('aria-pressed', 'false');

    const materialGroup = screen.getByRole('group', { name: 'Material' });
    expect(within(materialGroup).getByRole('button', { name: 'Twine' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('preview shows Un-mark/Mark lines when the slot changes for the same recipient (head -> body)', () => {
    const { sara, theo } = editFixturePlayers();
    renderEdit({}, [sara, theo]);

    const combos = screen.getAllByRole('combobox');
    fireEvent.keyDown(combos[1], { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Body' }));

    expect(screen.getByText('− Un-mark Head as augmented')).toBeInTheDocument();
    expect(screen.getByText('+ Mark Body as augmented')).toBeInTheDocument();
  });

  it('preview adds a "keeps their augmented" line for the old recipient when the recipient changes', () => {
    const { sara, theo } = editFixturePlayers();
    renderEdit({}, [sara, theo]);

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recipient' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: new RegExp(theo.name) }));

    expect(screen.getByText('+ Mark Body as augmented')).toBeInTheDocument();
    expect(screen.getByText('· Sara keeps their Head marked as augmented')).toBeInTheDocument();
  });

  it('submit calls updateMaterialAndReconcileGear with the old entry (by identity), the new data (notes trimmed, \'\' included when cleared), and typed options', async () => {
    const { sara, theo } = editFixturePlayers();
    const entry = editEntryFixture();
    renderEdit({ editEntry: entry }, [sara, theo]);

    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(updateMaterialAndReconcileGearMock).toHaveBeenCalledTimes(1));

    const call = updateMaterialAndReconcileGearMock.mock.calls[0] as [
      string, string, MaterialLogEntry,
      { weekNumber: number; floor: string; materialType: string; recipientPlayerId: string; method: string; notes: string },
      UpdateMaterialOptions,
    ];
    const [groupId, tierId, oldEntry, newData, options] = call;
    expect(groupId).toBe('g1');
    expect(tierId).toBe('t1');
    expect(oldEntry).toBe(entry); // identity, not a copy
    expect(newData).toEqual({
      weekNumber: 2,
      floor: 'M11S',
      materialType: 'twine',
      recipientPlayerId: 'sara',
      method: 'book',
      notes: '', // cleared -> '' included, never absent (differs from the create path)
    });
    expect(options).toEqual({ updateGear: true, slotToAugment: 'head', augmentTomeWeapon: false });
  });

  it('toast reads "Material entry updated" on a successful edit', async () => {
    const { toast } = await import('../../stores/toastStore');
    const successSpy = vi.spyOn(toast, 'success');
    const { sara, theo } = editFixturePlayers();
    renderEdit({}, [sara, theo]);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(updateMaterialAndReconcileGearMock).toHaveBeenCalledTimes(1));

    expect(successSpy).toHaveBeenCalledWith('Material entry updated');
    successSpy.mockRestore();
  });

  it('UT edit: the "mark tome weapon as obtained" checkbox is pre-checked (the recipient already has it via this entry); unchecking it sends updateGear: false', async () => {
    const uzo = makePlayer({
      id: 'uzo',
      name: 'Uzo',
      tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
    });
    const entry = editEntryFixture({
      materialType: 'universal_tomestone',
      floor: 'M10S',
      recipientPlayerId: 'uzo',
      recipientPlayerName: 'Uzo',
      slotAugmented: null,
    });
    renderEdit({ editEntry: entry }, [uzo]);

    const checkbox = checkboxByLabelText('Also mark tome weapon as obtained for Uzo');
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(updateMaterialAndReconcileGearMock).toHaveBeenCalledTimes(1));

    const [, , , , options] = updateMaterialAndReconcileGearMock.mock.calls[0] as [
      string, string, MaterialLogEntry, unknown, UpdateMaterialOptions,
    ];
    expect(options).toEqual(expect.objectContaining({ updateGear: false }));
  });

  // PR #236 review (claude thread): the entry's slot must not leak into a DIFFERENT material's
  // slot domain when the user switches material pills mid-edit — `originalSlot` and
  // `hasEligibleOptions`'s edit clause are both gated on material identity.
  describe('material-identity gates (PR #236 review)', () => {
    it('switching a twine entry to glaze de-injects the twine slot: no "Head" option, no gear checkbox, submit sends updateGear: false', async () => {
      const { sara, theo } = editFixturePlayers();
      renderEdit({}, [sara, theo]);

      // Cascade: M10S carries glaze/UT, so the twine pick can't survive the floor switch.
      fireEvent.click(within(screen.getByRole('group', { name: 'Floor' })).getByRole('button', { name: 'M10S' }));
      expect(within(screen.getByRole('group', { name: 'Material' })).getByRole('button', { name: 'Glaze' }))
        .toHaveAttribute('aria-pressed', 'true');

      // Sara has zero glaze-eligible accessories and the entry's 'head' is twine-domain:
      // the gear section must vanish entirely rather than offer the wrong-domain slot.
      expect(screen.getAllByRole('combobox')).toHaveLength(1); // Recipient only — no slot Select
      expect(screen.queryByText(/Also mark gear as augmented/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(updateMaterialAndReconcileGearMock).toHaveBeenCalledTimes(1));
      const [, , , newData, options] = updateMaterialAndReconcileGearMock.mock.calls[0] as [
        string, string, MaterialLogEntry, { materialType: string }, UpdateMaterialOptions,
      ];
      expect(newData.materialType).toBe('glaze');
      expect(options).toEqual(expect.objectContaining({ updateGear: false, slotToAugment: undefined }));
    });

    it('switching a twine entry to universal tomestone renders no gear checkbox and no "+ Mark tome weapon as obtained" promise; submit sends updateGear: false', async () => {
      const { sara, theo } = editFixturePlayers();
      renderEdit({}, [sara, theo]);

      fireEvent.click(within(screen.getByRole('group', { name: 'Floor' })).getByRole('button', { name: 'M10S' }));
      fireEvent.click(within(screen.getByRole('group', { name: 'Material' })).getByRole('button', { name: 'Universal Tomestone' }));

      // Sara doesn't need the tome item and the entry's recorded slot is twine-domain: the
      // edit clause must not keep `shouldUpdateGear` alive to promise a no-op.
      expect(screen.queryByText(/Also mark tome weapon as obtained/)).not.toBeInTheDocument();
      expect(screen.queryByText('+ Mark tome weapon as obtained')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(updateMaterialAndReconcileGearMock).toHaveBeenCalledTimes(1));
      const [, , , , options] = updateMaterialAndReconcileGearMock.mock.calls[0] as [
        string, string, MaterialLogEntry, unknown, UpdateMaterialOptions,
      ];
      expect(options).toEqual(expect.objectContaining({ updateGear: false }));
    });

    it('a failed edit toasts "Failed to update material entry", not the create copy (PR #236 Copilot thread)', async () => {
      const { toast } = await import('../../stores/toastStore');
      const errorSpy = vi.spyOn(toast, 'error');
      updateMaterialAndReconcileGearMock.mockRejectedValueOnce(new Error('nope'));
      const { sara, theo } = editFixturePlayers();
      renderEdit({}, [sara, theo]);

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to update material entry'));
      errorSpy.mockRestore();
    });
  });
});

// D8 Task 7 (review gap closed): 'notes (R-26)' above only pins that pinned + showNotes RENDERS
// the textarea — the submit path for that same door had no coverage. Closes the gap named in the
// Task 4 review round.
describe('pinned + showNotes submit (D8 Task 7)', () => {
  it('a typed note reaches the create payload, trimmed', async () => {
    const p1 = makePlayer({ id: 'p1', name: 'Alice' });
    renderModal({ material: 'twine', suggestedPlayer: p1, allPlayers: [p1], showNotes: true });

    fireEvent.change(screen.getByLabelText('Notes (optional)'), {
      target: { value: '  got it from FC chest  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log Material' }));
    await waitFor(() => expect(logMaterialAndUpdateGearMock).toHaveBeenCalledTimes(1));

    const [, , data] = logMaterialAndUpdateGearMock.mock.calls[0] as [string, string, MaterialLogEntryCreate];
    expect(data.notes).toBe('got it from FC chest');
  });
});
