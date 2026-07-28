import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { RosterCard } from './RosterCard';
import { TooltipProvider } from '../primitives';
import { GEAR_SLOT_ICONS } from '../../types';
import type { RosterCardActions } from '../../hooks/useRosterCardActions';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';
import { useToastStore } from '../../stores/toastStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useSharedBisStore } from '../../stores/sharedBisStore';
import type { SharedBiSTargetSet } from '../../types';
import { eventBus, Events } from '../../lib/eventBus';
import { computeGearSlotUpdate, fromGearState } from '../../utils/calculations';

// Partial mock so the ledger-scan call itself is observable (the compact-card
// perf assertion below); everything else runs the real implementation.
const { buildSpy } = vi.hoisted(() => ({ buildSpy: vi.fn() }));
vi.mock('./rosterLedgerJumps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./rosterLedgerJumps')>();
  return {
    ...actual,
    buildSlotJumpTargets: (...args: Parameters<typeof actual.buildSlotJumpTargets>) => {
      buildSpy(...args);
      return actual.buildSlotJumpTargets(...args);
    },
  };
});

// The card's C4 material jump writes same-route URL params — surface the live
// search string in the DOM so tests can assert on it (MemoryRouter never
// touches window.location).
function LocationProbe() {
  return <div data-testid="location-search">{useLocation().search}</div>;
}

/** The MemoryRouter search string the card's URL writes land in. */
function currentSearch() {
  return screen.getByTestId('location-search').textContent ?? '';
}

beforeEach(() => {
  // Radix Popper (BiSSourceSelector's popover) needs ResizeObserver, which
  // jsdom lacks.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  // jsdom has no matchMedia; emulate a desktop/hover environment so useDevice
  // (via the selectors' Tooltip) resolves without throwing.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover: hover'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
  useToastStore.setState({ toasts: [] });
  // C4/C7 jump tests seed the ledgers; give every test clean ones (a leaked
  // lootLog would silently outrank a material fixture — loot wins precedence).
  useLootTrackingStore.setState({ materialLog: [], lootLog: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Build a minimal-but-valid SnapshotPlayer. Six of eleven raid slots are owned,
 * so `isSlotComplete` reports 6/11 for the BiS line assertion.
 */
function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Tank One',
    job: 'PLD',
    role: 'tank',
    position: 'T1',
    tankRole: 'MT',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    userId: 'u1',
    bisLink: 'https://xivgear.app/x',
    gear: Array.from({ length: 11 }, (_, i) => ({
      slot: `s${i}`,
      bisSource: 'raid',
      hasItem: i < 6,
      isAugmented: false,
    })),
    tomeWeapon: {},
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

const actions: RosterCardActions = {
  onUpdate: vi.fn(),
  onCopy: vi.fn(),
  onDuplicate: vi.fn(),
};

function renderCard(
  player: SnapshotPlayer,
  extra: Partial<Parameters<typeof RosterCard>[0]> = {}
) {
  // MemoryRouter: the card's C4 material jump calls useSearchParams.
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <RosterCard
          player={player}
          userRole="owner"
          currentUserId="u1"
          isAdminAccess={false}
          canManage
          clipboardPlayer={null}
          reorderMode={false}
          groupId="g1"
          tierId="tier1"
          contentType="savage"
          actions={actions}
          {...extra}
        />
        <LocationProbe />
      </TooltipProvider>
    </MemoryRouter>
  );
}

describe('RosterCard', () => {
  it('renders identity, the BiS progress line, and an accessible progress bar', () => {
    renderCard(makePlayer());

    expect(screen.getByText('Tank One')).toBeInTheDocument();
    expect(screen.getByText(/6\/11 BiS/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('opens the kebab menu with the BiS import action', () => {
    // No BiS link → the audited kebab surfaces "Import BiS" (vs "Update BiS").
    // The progress line carries its own "Import BiS" button in this state
    // (one-axis split), so with the kebab open the label appears twice.
    renderCard(makePlayer({ bisLink: undefined }));

    expect(screen.getAllByText('Import BiS')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /player actions/i }));
    expect(screen.getAllByText('Import BiS')).toHaveLength(2);
  });

  it('releases the grid modal counter on unmount while an overlay is open', () => {
    // Regression: a card unmounting mid-overlay (e.g. an external refresh drops
    // the player while its modal is open) must still fire onModalClose, else the
    // grid's openModalCount leaks and stuck-disables reorder DnD until reload.
    const onModalOpen = vi.fn();
    const onModalClose = vi.fn();
    const { unmount } = render(
      <MemoryRouter>
        <TooltipProvider>
          <RosterCard
            player={makePlayer()}
            userRole="owner"
            currentUserId="u1"
            isAdminAccess={false}
            canManage
            clipboardPlayer={null}
            reorderMode={false}
            groupId="g1"
            tierId="tier1"
            contentType="savage"
            actions={actions}
            onModalOpen={onModalOpen}
            onModalClose={onModalClose}
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    // Open an overlay (the job picker) → the balanced open fires, close does not.
    fireEvent.click(screen.getByRole('button', { name: /change job/i }));
    expect(onModalOpen).toHaveBeenCalledTimes(1);
    expect(onModalClose).not.toHaveBeenCalled();

    // Unmount without closing the overlay → the cleanup must release the counter.
    unmount();
    expect(onModalClose).toHaveBeenCalledTimes(1);
  });
});

// A10: actions.onUpdate chains to tierStore.updatePlayer, which re-throws after
// rollback — commitName/commitJobChange previously void'd it (unhandled
// rejection → phantom /api/analytics/errors POST + silent failure).
describe("RosterCard — A10 void'd-promise fixes", () => {
  function renderWithActions(rejecting: RosterCardActions) {
    return render(
      <MemoryRouter>
        <TooltipProvider>
          <RosterCard
            player={makePlayer()}
            userRole="owner"
            currentUserId="u1"
            isAdminAccess={false}
            canManage
            clipboardPlayer={null}
            reorderMode={false}
            groupId="g1"
            tierId="tier1"
            contentType="savage"
            actions={rejecting}
          />
        </TooltipProvider>
      </MemoryRouter>
    );
  }

  it('commitName: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const rejecting: RosterCardActions = {
      onUpdate: vi.fn().mockRejectedValue(new Error('rename failed')),
      onCopy: vi.fn(),
      onDuplicate: vi.fn(),
    };
    renderWithActions(rejecting);
    fireEvent.doubleClick(screen.getByText('Tank One'));
    const input = screen.getByLabelText('Player name');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'rename failed',
      )).toBe(true);
    });
  });

  it('commitJobChange: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const rejecting: RosterCardActions = {
      onUpdate: vi.fn().mockRejectedValue(new Error('job change failed')),
      onCopy: vi.fn(),
      onDuplicate: vi.fn(),
    };
    renderWithActions(rejecting);
    fireEvent.click(screen.getByRole('button', { name: /change job/i }));
    // JobPicker (real, full-picker mode) — pick a different job than PLD.
    fireEvent.click(screen.getByText('WAR'));
    // Card-owned confirm modal → primary action commits.
    fireEvent.click(screen.getByRole('button', { name: 'Change Job' }));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'job change failed',
      )).toBe(true);
    });
  });

  // ── Density axis (Phase C C1, D-01) ──
  describe('density', () => {
    it('renders the pip strip (no gear table) at the default compact density', () => {
      renderCard(makePlayer());
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    // ── Compact gear strip (2026-07-28): one column per slot, icon above the
    //    pip, both centered — v1 showed icons only, v2 showed pips only. ──
    it('compact renders one column per gear slot, each with an icon above its pip', () => {
      renderCard(makePlayer());

      const strip = screen.getByTestId('compact-gear-strip');
      const columns = within(strip).getAllByTestId('compact-gear-slot');
      expect(columns).toHaveLength(11);
      // alt="" makes these presentational, so query by tag, not by role —
      // being unreachable to AT is the point (the pip carries the name).
      expect(columns[0].querySelector('img')).toBeInTheDocument();
      expect(within(columns[0]).getByRole('checkbox')).toBeInTheDocument();
    });

    it('compact shows the real item icon when the slot has one, the placeholder otherwise', () => {
      renderCard(
        makePlayer({
          gear: [
            { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false, itemIcon: '/i/42.png' },
            { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false },
          ] as unknown as SnapshotPlayer['gear'],
        })
      );

      const imgs = screen.getByTestId('compact-gear-strip').querySelectorAll('img');
      expect(imgs[0]).toHaveAttribute('src', '/i/42.png');
      expect(imgs[1]).toHaveAttribute('src', GEAR_SLOT_ICONS.body);
    });

    it('compact icons are decoration, not a second control', () => {
      renderCard(makePlayer());

      const icon = screen.getByTestId('compact-gear-strip').querySelector('img')!;
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).not.toHaveAttribute('tabindex');
      expect(icon).not.toHaveAttribute('role', 'button');
    });

    it('expanded density replaces the pips with the read-only gear table', () => {
      renderCard(
        makePlayer({
          gear: [
            {
              slot: 'head',
              bisSource: 'tome',
              hasItem: true,
              isAugmented: false,
              itemName: 'Test Helm',
              itemLevel: 730,
            },
          ] as unknown as SnapshotPlayer['gear'],
        }),
        { density: 'expanded' }
      );
      expect(screen.getByRole('table')).toBeInTheDocument();
      // Row headers come from GEAR_SLOT_NAMES; item detail renders inline.
      expect(screen.getByRole('rowheader', { name: 'Weapon' })).toBeInTheDocument();
      expect(screen.getByText(/Test Helm/)).toBeInTheDocument();
      expect(screen.getByText(/i730/)).toBeInTheDocument();
    });

    it('renders no per-card expand/collapse affordance (density is a global toggle)', () => {
      // Checkpoint ruling 2026-07-26: cards must never collapse individually.
      renderCard(makePlayer());
      expect(screen.queryByRole('button', { name: /expand card/i })).not.toBeInTheDocument();
      renderCard(makePlayer({ id: 'p2' }), { density: 'expanded' });
      expect(screen.queryByRole('button', { name: /collapse card/i })).not.toBeInTheDocument();
    });

    it('one axis per location: the progress line owns the BiS story (No BiS + Import button)', () => {
      renderCard(makePlayer({ id: 'p3', bisLink: undefined }));
      // The Import action sits ON the progress line as a real button…
      expect(screen.getByRole('button', { name: 'Import BiS' })).toBeInTheDocument();
      expect(screen.getByText('No BiS')).toBeInTheDocument();
    });

    it('one axis per location: the footer owns the claim story only', () => {
      // Unclaimed → footer shows Unclaimed + a bordered Assign button (the
      // assign kebab entries need the assign callbacks wired, as the real
      // actionsForPlayer factory always does).
      renderCard(makePlayer({ id: 'p4', userId: undefined }), {
        actions: {
          ...actions,
          onOwnerAssignPlayer: vi.fn(),
          onAdminAssignPlayer: vi.fn(),
        },
      });
      expect(screen.getByText('Unclaimed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();

      // Claimed → the footer's right side is empty (no BiS text, no needs-N).
      renderCard(makePlayer({ id: 'p5', bisLink: undefined }));
      expect(screen.queryByText(/needs \d/)).not.toBeInTheDocument();
    });
  });

  // ── On-card gear editing (Phase C C2, D-02) ──
  describe('gear editing', () => {
    /** A player whose gear uses REAL slot names so table rows bind to it. */
    function makeGearedPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
      return makePlayer({
        gear: [
          { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
          { slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: false },
        ] as unknown as SnapshotPlayer['gear'],
        ...overrides,
      });
    }

    function headCircle() {
      return within(
        screen.getByRole('rowheader', { name: /^Head/ }).closest('tr')!
      ).getByRole('checkbox');
    }

    it('expanded + owner: clicking a circle mutates through the shared gear path', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const player = makeGearedPlayer();
      renderCard(player, { density: 'expanded', actions: { ...actions, onUpdate } });

      fireEvent.click(headCircle());

      // One shared mutation path (plan §2.1 / DoD 2): the card must send
      // exactly what computeGearSlotUpdate produces for this cycle.
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const expected = computeGearSlotUpdate(player, 'head', fromGearState('have'));
      expect(onUpdate).toHaveBeenCalledWith(expected);
      const sentGear = (onUpdate.mock.calls[0][0] as Partial<SnapshotPlayer>).gear!;
      expect(sentGear.find((g) => g.slot === 'head')).toMatchObject({
        hasItem: true,
        currentSource: 'savage',
      });
    });

    it('member editing their OWN claimed card: circles are live', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      renderCard(makeGearedPlayer({ userId: 'u1' }), {
        density: 'expanded',
        userRole: 'member',
        currentUserId: 'u1',
        canManage: false,
        actions: { ...actions, onUpdate },
      });

      const circle = headCircle();
      expect(circle).toHaveAttribute('aria-disabled', 'false');
      fireEvent.click(circle);
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    });

    it("member on someone ELSE's card: circles stay read-only", () => {
      const onUpdate = vi.fn();
      renderCard(makeGearedPlayer({ userId: 'u9' }), {
        density: 'expanded',
        userRole: 'member',
        currentUserId: 'u1',
        canManage: false,
        actions: { ...actions, onUpdate },
      });

      const circle = headCircle();
      expect(circle).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(circle);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('emits player_gear_changed with the v2 shell field after the save resolves', async () => {
      const received: unknown[] = [];
      const unsub = eventBus.on(Events.PLAYER_GEAR_CHANGED, (data) => received.push(data));
      try {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        renderCard(makeGearedPlayer(), { density: 'expanded', actions: { ...actions, onUpdate } });

        fireEvent.click(headCircle());
        await waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]).toEqual({ slot: 'head', state: 'have', shell: 'v2' });
      } finally {
        unsub();
      }
    });

    it('does NOT emit when the save rejects', async () => {
      const received: unknown[] = [];
      const unsub = eventBus.on(Events.PLAYER_GEAR_CHANGED, (data) => received.push(data));
      try {
        const onUpdate = vi.fn().mockRejectedValue(new Error('save failed'));
        renderCard(makeGearedPlayer(), { density: 'expanded', actions: { ...actions, onUpdate } });

        fireEvent.click(headCircle());
        await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
        // Flush the rejection's microtask chain so a would-be emit has had
        // every chance to fire before we assert silence (a bare waitFor(0)
        // passes on its first synchronous evaluation and proves nothing).
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        expect(received).toHaveLength(0);
      } finally {
        unsub();
      }
    });

    // INVERTED 2026-07-28: compact pips used to be read-only in both shells —
    // "editing lives in the table". Density is now a DETAIL axis only, so the
    // same edit is available at either density through the same shared path.
    it('compact + owner: clicking a pip mutates through the shared gear path', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const player = makeGearedPlayer();
      renderCard(player, { actions: { ...actions, onUpdate } });

      const pip = within(screen.getAllByTestId('compact-gear-slot')[0]).getByRole('checkbox');
      expect(pip).not.toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(pip);

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(onUpdate.mock.calls[0][0]).toEqual(
        computeGearSlotUpdate(player, 'head', { hasItem: true, isAugmented: false }),
      );
    });

    // REVERSED 2026-07-28 (user ruling, after live use): the strip carried a
    // third row of BiS-source badges for one revision and it read as noise at
    // card size. Compact is TWO ROWS — icon, pip — and retargeting is the
    // expanded table's job again. This also subsumes the PR #203 finding that
    // the weapon column must never get the generic 4-way selector (which would
    // have been the first path in v2 able to CREATE a non-raid weapon source):
    // no column has one now, the weapon's least of all.
    it('carries NO BiS-source row — not a badge, not a selector, in any column', () => {
      renderCard(makePlayer({
        gear: [
          { slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false },
          { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
        ] as unknown as SnapshotPlayer['gear'],
        tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
      }));

      const strip = screen.getByTestId('compact-gear-strip');
      expect(within(strip).queryByTestId('compact-weapon-source')).not.toBeInTheDocument();
      expect(within(strip).queryByTestId('compact-tome-source')).not.toBeInTheDocument();
      expect(within(strip).queryByRole('button', { name: /BiS source/ })).not.toBeInTheDocument();
      // and every column is exactly icon + pip
      for (const col of within(strip).getAllByTestId('compact-gear-slot')) {
        expect(col.querySelectorAll('img')).toHaveLength(1);
        expect(within(col).getAllByRole('checkbox')).toHaveLength(1);
      }
    });

    // PR #203 review: hasHoverData also keys off the EQUIPPED fields, which the
    // spread carried over from the raid weapon — so the tome column used to open
    // a hover card describing the weapon beside it.
    it('the tome column never opens a hover card, even when the weapon is synced', () => {
      renderCard(
        makePlayer({
          gear: [{
            slot: 'weapon', bisSource: 'raid', hasItem: true, isAugmented: false,
            itemName: 'Axe', itemLevel: 795,
            equippedItemName: 'Synced Axe', equippedItemLevel: 790, equippedItemId: 42,
          }] as unknown as SnapshotPlayer['gear'],
          tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
        })
      );

      const cols = screen.getAllByTestId('compact-gear-slot');
      const tomeCol = cols.find((c) => c.getAttribute('data-column') === 'tome')!;
      // the raid weapon's icon IS a hover trigger; the tome column's is not
      expect(cols[0].querySelector('img')!.closest('[data-state]')).not.toBeNull();
      expect(tomeCol.querySelector('img')!.closest('[data-state]')).toBeNull();
    });

    // PR #203 review: the weapon's main row is ALWAYS the raid weapon, so it
    // takes the 2-state cycle the expanded table and legacy both hardcode.
    // Harmless while the pip was display-only; load-bearing now that it writes.
    it('the compact weapon pip cycles as raid even when the slot stores a tome source', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const player = makePlayer({
        gear: [{ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false }] as unknown as SnapshotPlayer['gear'],
      });
      renderCard(player, { actions: { ...actions, onUpdate } });

      const pip = within(screen.getAllByTestId('compact-gear-slot')[0]).getByRole('checkbox', { name: /Weapon/ });
      // A tome slot with hasItem would read "needs augmentation"; the weapon
      // must read Complete, i.e. no augment step exists for it.
      expect(pip).toHaveAttribute('aria-label', 'Weapon — Complete');

      fireEvent.click(pip);
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      // 2-state: Complete → Missing, never → augmented.
      expect(onUpdate.mock.calls[0][0].gear[0]).toMatchObject({ hasItem: false, isAugmented: false });
    });

    // PR #203 review: un-disabling the pips made them tab stops, and the
    // expanded table's row header (which names the slot) has no equivalent here.
    it('every compact pip names its own slot, so eleven tab stops are distinguishable', () => {
      renderCard(makePlayer({
        gear: [
          { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
          { slot: 'ring2', bisSource: 'raid', hasItem: false, isAugmented: false },
        ] as unknown as SnapshotPlayer['gear'],
      }));

      expect(screen.getByRole('checkbox', { name: 'Head — Missing' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'L. Ring — Missing' })).toBeInTheDocument();
    });

    it('the tome pip names itself, so the stacked pair is distinguishable', () => {
      renderCard(makePlayer({
        gear: [{ slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false }] as unknown as SnapshotPlayer['gear'],
        tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
      }));

      expect(screen.getByRole('checkbox', { name: 'Weapon — Missing' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Tome weapon — Missing' })).toBeInTheDocument();
    });

    // PR #203 review: a native title on the hover-card trigger stacks a browser
    // tooltip over the Radix item card.
    it('carries no native title on a column that already has the hover item card', () => {
      renderCard(
        makePlayer({
          gear: [{ slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false, itemName: 'Hat', itemLevel: 790 }] as unknown as SnapshotPlayer['gear'],
        }),
        { userRole: 'viewer', currentUserId: 'nobody' }
      );

      expect(screen.getAllByTestId('compact-gear-slot')[0]).not.toHaveAttribute('title');
    });

    // The interim tome weapon is a second state of the weapon slot, not a 12th
    // slot — so it stacks under the weapon's own pip. Compact echo of C4.
    it('renders no tome pip when the player is not pursuing one', () => {
      renderCard(makePlayer({ tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false } }));
      expect(screen.queryAllByTestId('compact-gear-slot').filter((c) => c.getAttribute('data-column') === 'tome')).toHaveLength(0);
      expect(screen.queryByRole('checkbox', { name: /Tome weapon/ })).not.toBeInTheDocument();
    });

    it('gives the tome weapon its own column, immediately after the weapon', () => {
      renderCard(
        makePlayer({
          gear: [
            { slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false },
            { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false },
          ] as unknown as SnapshotPlayer['gear'],
          tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
        })
      );

      const columns = screen.getAllByTestId('compact-gear-slot');
      // weapon, tome, head — the tome column sits beside the weapon it belongs to
      expect(columns.map((c) => c.getAttribute('data-column'))).toEqual(['slot', 'tome', 'slot']);
      expect(within(columns[1]).getByRole('checkbox', { name: /Tome weapon/ })).toBeInTheDocument();
    });

    it('the compact tome pip emits NO analytics (the C2 ruling covers gear slots only)', async () => {
      const received: unknown[] = [];
      const unsub = eventBus.on(Events.PLAYER_GEAR_CHANGED, (d) => received.push(d));
      try {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        renderCard(
          makePlayer({
            gear: [{ slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false }] as unknown as SnapshotPlayer['gear'],
            tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
          }),
          { actions: { ...actions, onUpdate } }
        );

        fireEvent.click(screen.getByRole('checkbox', { name: /^Tome weapon/ }));
        await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
        // Flush the resolve chain so a would-be emit had every chance to fire.
        await new Promise((r) => setTimeout(r, 0));
        expect(received).toHaveLength(0);
      } finally {
        unsub();
      }
    });

    it('the tome pip writes the tomeWeapon field, never a gear-slot payload', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      renderCard(
        makePlayer({
          gear: [{ slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false }] as unknown as SnapshotPlayer['gear'],
          tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
        }),
        { actions: { ...actions, onUpdate } }
      );

      fireEvent.click(screen.getByRole('checkbox', { name: /^Tome weapon/ }));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(onUpdate.mock.calls[0][0]).toEqual({
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      });
      expect(onUpdate.mock.calls[0][0]).not.toHaveProperty('gear');
    });

    it('compact pips cycle from the keyboard (Enter and Space)', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      renderCard(makeGearedPlayer(), { actions: { ...actions, onUpdate } });

      const pip = within(screen.getAllByTestId('compact-gear-slot')[0]).getByRole('checkbox');
      fireEvent.keyDown(pip, { key: 'Enter' });
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      fireEvent.keyDown(pip, { key: ' ' });
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
    });

    it("compact + member on someone else's card: pips stay read-only", () => {
      const onUpdate = vi.fn();
      renderCard(makeGearedPlayer({ userId: 'someone-else' }), {
        userRole: 'member',
        currentUserId: 'u1',
        actions: { ...actions, onUpdate },
      });

      const pip = within(screen.getAllByTestId('compact-gear-slot')[0]).getByRole('checkbox');
      expect(pip).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(pip);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('compact + member on their OWN card: pips are live', () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      renderCard(makeGearedPlayer({ userId: 'u1' }), {
        userRole: 'member',
        currentUserId: 'u1',
        actions: { ...actions, onUpdate },
      });

      fireEvent.click(within(screen.getAllByTestId('compact-gear-slot')[0]).getByRole('checkbox'));
      return waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    });

    // ── BiS-source tools (Phase C C3, D-03) ──
    it('a source selection flows through the shared path with the legacy reset shape', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const player = makeGearedPlayer();
      renderCard(player, { density: 'expanded', actions: { ...actions, onUpdate } });

      const headRow = screen.getByRole('rowheader', { name: /^Head/ }).closest('tr')!;
      fireEvent.click(within(headRow).getByRole('button', { name: /BiS source/ }));
      // Bare slot (no item data) → no confirm, straight through.
      fireEvent.click(screen.getByRole('button', { name: /^Tome:/ }));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      // Changing source resets progress + item metadata (legacy
      // GearTable.handleSourceChange shape) through computeGearSlotUpdate.
      const expected = computeGearSlotUpdate(player, 'head', {
        bisSource: 'tome',
        hasItem: false,
        isAugmented: false,
        currentSource: undefined,
        itemName: undefined,
        itemLevel: undefined,
        itemIcon: undefined,
        itemStats: undefined,
      });
      expect(onUpdate).toHaveBeenCalledWith(expected);
    });

    it('re-selecting the current source sends a plain bisSource update (no reset)', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const player = makeGearedPlayer();
      renderCard(player, { density: 'expanded', actions: { ...actions, onUpdate } });

      const headRow = screen.getByRole('rowheader', { name: /^Head/ }).closest('tr')!;
      fireEvent.click(within(headRow).getByRole('button', { name: /BiS source/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Raid:/ }));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(onUpdate).toHaveBeenCalledWith(computeGearSlotUpdate(player, 'head', { bisSource: 'raid' }));
    });

    it('the per-slot Fix corrects bisSource while PRESERVING progress and metadata', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const player = makePlayer({
        gear: [
          {
            slot: 'head',
            bisSource: 'raid',
            hasItem: true,
            isAugmented: false,
            itemName: 'Archeo Kingdom Coat of Fending',
            itemLevel: 770,
          },
        ] as unknown as SnapshotPlayer['gear'],
      });
      renderCard(player, { density: 'expanded', actions: { ...actions, onUpdate } });

      fireEvent.click(screen.getByRole('button', { name: 'Fix BiS source to Crafted' }));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(onUpdate).toHaveBeenCalledWith(computeGearSlotUpdate(player, 'head', { bisSource: 'crafted' }));
      const sentGear = (onUpdate.mock.calls[0][0] as Partial<SnapshotPlayer>).gear!;
      expect(sentGear.find((g) => g.slot === 'head')).toMatchObject({
        bisSource: 'crafted',
        hasItem: true,
        itemName: 'Archeo Kingdom Coat of Fending',
      });
    });

    it('the fix-all banner shows the count and bulk-corrects in ONE update', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const player = makePlayer({
        gear: [
          { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false, itemName: 'Archeo Kingdom Coat of Fending', itemLevel: 770 },
          { slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Bygone Brass Brais of Maiming', itemLevel: 780 },
          { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false },
        ] as unknown as SnapshotPlayer['gear'],
      });
      renderCard(player, { density: 'expanded', actions: { ...actions, onUpdate } });

      expect(screen.getByText('2 slots need BiS source updates')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Update BiS Source/ }));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const sent = (onUpdate.mock.calls[0][0] as Partial<SnapshotPlayer>).gear!;
      expect(sent.find((g) => g.slot === 'head')).toMatchObject({ bisSource: 'crafted', hasItem: true });
      expect(sent.find((g) => g.slot === 'legs')).toMatchObject({ bisSource: 'base_tome', hasItem: true });
      expect(sent.find((g) => g.slot === 'body')).toMatchObject({ bisSource: 'raid' });
    });

    it('the banner is expanded-only and absent when nothing is miscategorized', () => {
      const miscat = makePlayer({
        id: 'p7',
        gear: [
          { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false, itemName: 'Archeo Kingdom Coat of Fending', itemLevel: 770 },
        ] as unknown as SnapshotPlayer['gear'],
      });
      // Compact density → no banner even with a fixable slot.
      renderCard(miscat);
      expect(screen.queryByText(/need(s)? BiS source update/)).not.toBeInTheDocument();

      // Expanded but everything correct → no banner.
      renderCard(makeGearedPlayer({ id: 'p8' }), { density: 'expanded' });
      expect(screen.queryByText(/need(s)? BiS source update/)).not.toBeInTheDocument();
    });

    // ── Tome-weapon sub-row (Phase C C4, D-04) ──
    describe('tome weapon', () => {
      /** A player with a real weapon slot + explicit tomeWeapon state. */
      function makeTomePlayer(
        tome: Partial<SnapshotPlayer['tomeWeapon']> = {},
        overrides: Partial<SnapshotPlayer> = {}
      ): SnapshotPlayer {
        return makePlayer({
          gear: [
            { slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false },
          ] as unknown as SnapshotPlayer['gear'],
          tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false, ...tome },
          ...overrides,
        });
      }

      function weaponRow() {
        return screen.getByRole('rowheader', { name: /^Weapon/ }).closest('tr')!;
      }
      function tomeRow() {
        return screen.getByRole('rowheader', { name: /Tome Weapon/ }).closest('tr')!;
      }

      /** A material entry that marks p1's tome weapon (universal tomestone form). */
      function tomeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
        return {
          id: 42,
          tierSnapshotId: 't1',
          weekNumber: 3,
          floor: 'floor3',
          materialType: 'universal_tomestone',
          recipientPlayerId: 'p1',
          recipientPlayerName: 'Tank One',
          method: 'priority',
          slotAugmented: null,
          createdAt: '',
          createdByUserId: '',
          createdByUsername: '',
          ...overrides,
        } as MaterialLogEntry;
      }

      it('the + toggle mutates through the LEGACY tomeWeapon shape (never the gear path)', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        renderCard(makeTomePlayer(), { density: 'expanded', actions: { ...actions, onUpdate } });

        fireEvent.click(within(weaponRow()).getByRole('button', { name: '+' }));

        await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
        // PlayerCard.handleTomeWeaponChange parity: a tomeWeapon spread, NOT a
        // computeGearSlotUpdate gear array.
        expect(onUpdate).toHaveBeenCalledWith({
          tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
        });
      });

      it('the sub-row circle cycles hasItem/isAugmented through the same legacy shape', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        renderCard(makeTomePlayer({ pursuing: true, hasItem: true }), {
          density: 'expanded',
          actions: { ...actions, onUpdate },
        });

        fireEvent.click(within(tomeRow()).getByRole('checkbox'));

        await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
        expect(onUpdate).toHaveBeenCalledWith({
          tomeWeapon: { pursuing: true, hasItem: true, isAugmented: true },
        });
      });

      it('tomeWeapon changes emit NO analytics event (the C2 ruling covers gear slots only)', async () => {
        const received: unknown[] = [];
        const unsub = eventBus.on(Events.PLAYER_GEAR_CHANGED, (d) => received.push(d));
        try {
          const onUpdate = vi.fn().mockResolvedValue(undefined);
          renderCard(makeTomePlayer({ pursuing: true }), {
            density: 'expanded',
            actions: { ...actions, onUpdate },
          });

          fireEvent.click(within(weaponRow()).getByRole('button', { name: '+' }));
          fireEvent.click(within(tomeRow()).getByRole('checkbox'));
          await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
          // Flush the resolve chain so a would-be emit had every chance to fire.
          await new Promise((r) => setTimeout(r, 0));
          expect(received).toHaveLength(0);
        } finally {
          unsub();
        }
      });

      it("member on someone ELSE's card: the + toggle and sub-row circle stay read-only", () => {
        const onUpdate = vi.fn();
        renderCard(makeTomePlayer({ pursuing: true }, { userId: 'u9' }), {
          density: 'expanded',
          userRole: 'member',
          currentUserId: 'u1',
          canManage: false,
          actions: { ...actions, onUpdate },
        });

        const plus = within(weaponRow()).getByRole('button', { name: '+' });
        expect(plus).toBeDisabled();
        fireEvent.click(plus);
        const circle = within(tomeRow()).getByRole('checkbox');
        expect(circle).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(circle);
        expect(onUpdate).not.toHaveBeenCalled();
      });

      it('Alt+Click on the sub-row icon jumps via same-route URL params', () => {
        useLootTrackingStore.setState({ materialLog: [tomeMaterialEntry()] });
        renderCard(makeTomePlayer({ pursuing: true }), { density: 'expanded' });

        fireEvent.click(screen.getByRole('link', { name: /Tome Weapon/ }), { altKey: true, detail: 1 });

        // The jump = the Loot spine tab (PageMode 'gear') + History sub-view +
        // the highlight params LootHistoryTable.tsx:69-103 consumes.
        const params = new URLSearchParams(currentSearch());
        expect(params.get('tab')).toBe('gear');
        expect(params.get('lview')).toBe('history');
        expect(params.get('entry')).toBe('42');
        expect(params.get('entryType')).toBe('material');
      });

      it('a slotAugmented=tome_weapon entry lights the jump (second predicate branch)', () => {
        // Director F6: the universal-tomestone branch is covered above; this
        // fixture exercises the slotAugmented === 'tome_weapon' branch.
        useLootTrackingStore.setState({
          materialLog: [tomeMaterialEntry({ id: 77, materialType: 'twine', slotAugmented: 'tome_weapon' })],
        });
        renderCard(makeTomePlayer({ pursuing: true }), { density: 'expanded' });

        fireEvent.click(screen.getByRole('link', { name: /Tome Weapon/ }), { altKey: true, detail: 1 });

        const params = new URLSearchParams(currentSearch());
        expect(params.get('entry')).toBe('77');
        expect(params.get('entryType')).toBe('material');
      });

      it("another player's material entry does not light the jump (no link, Alt+Click is a no-op)", () => {
        useLootTrackingStore.setState({
          materialLog: [tomeMaterialEntry({ recipientPlayerId: 'p9', slotAugmented: 'tome_weapon' })],
        });
        renderCard(makeTomePlayer({ pursuing: true }), { density: 'expanded' });

        expect(screen.queryByRole('link', { name: /Tome Weapon/ })).not.toBeInTheDocument();
        const before = currentSearch();
        fireEvent.click(within(tomeRow()).getByText('Tome Weapon'), { altKey: true, detail: 1 });
        expect(currentSearch()).toBe(before);
      });
    });

    it('the compact ICON carries the hover item card, and the pip does not', () => {
      // The hover card moved off the column and onto the icon (2026-07-28): the
      // pip now has its own cycle-hint tooltip, and one trigger for both meant
      // hovering the control explained the item instead.
      renderCard(
        makePlayer({
          id: 'p6',
          gear: [
            { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false, itemName: 'Hover Helm', itemLevel: 730 },
            { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false },
          ] as unknown as SnapshotPlayer['gear'],
        })
      );

      // Radix stamps its Trigger wrapper with data-state when the hover card is
      // wired; the bare slot gets no wrapper.
      const icons = [...screen.getByTestId('compact-gear-strip').querySelectorAll('img')];
      expect(icons.filter((i) => i.closest('[data-state]'))).toHaveLength(1);
      // The pip has a trigger of its OWN (the cycle hint) rather than sharing
      // the icon's — that separation is the whole fix.
      const pip = within(screen.getAllByTestId('compact-gear-slot')[0]).getByRole('checkbox');
      const pipTrigger = pip.closest('[data-state]');
      const iconTrigger = icons[0].closest('[data-state]');
      expect(pipTrigger).not.toBeNull();
      expect(pipTrigger).not.toBe(iconTrigger);
    });
  });
});

describe('RosterCard — C5 metrics · badges · identity', () => {
  beforeEach(() => {
    useSharedBisStore.setState({ targets: {}, loading: {} });
  });

  describe('badges (D-09)', () => {
    it('shows the SUB tag for substitutes only', () => {
      const { unmount } = renderCard(makePlayer({ isSubstitute: true }));
      expect(screen.getByText('SUB')).toBeInTheDocument();
      unmount();

      renderCard(makePlayer({ isSubstitute: false }));
      expect(screen.queryByText('SUB')).not.toBeInTheDocument();
    });

    it('shows the +N weapon-priority tag only beyond the main job', () => {
      // Legacy parity (R-081): the count excludes the main job, so two
      // priorities render "+1" and a single priority renders nothing.
      const { unmount } = renderCard(
        makePlayer({
          weaponPriorities: [{ job: 'PLD' }, { job: 'DRK' }] as SnapshotPlayer['weaponPriorities'],
        })
      );
      expect(screen.getByText('+1')).toBeInTheDocument();
      unmount();

      renderCard(
        makePlayer({
          weaponPriorities: [{ job: 'PLD' }] as SnapshotPlayer['weaponPriorities'],
        })
      );
      expect(screen.queryByText('+1')).not.toBeInTheDocument();
    });

    it('keeps the header tags legible without hover (PR review round 7)', () => {
      // SUB and "+N" carry their meaning entirely in a tooltip, and Tooltip
      // renders bare children on no-hover devices — the sr-only text is what
      // survives there and for AT.
      renderCard(
        makePlayer({
          isSubstitute: true,
          weaponPriorities: [{ job: 'PLD' }, { job: 'DRK' }] as SnapshotPlayer['weaponPriorities'],
        })
      );
      expect(screen.getByText(/Substitute — a backup/)).toBeInTheDocument();
      expect(screen.getByText(/additional weapon priorit/)).toBeInTheDocument();
      // …and the sr-only expansion needs a separator, or the name computes as
      // "SUBSubstitute — …" (round 9).
      expect(screen.getByText('SUB').closest('span')?.textContent).toMatch(
        /^SUB Substitute — a backup/
      );
    });

    it('renders the BiS link as a real external anchor on the progress line', () => {
      renderCard(makePlayer({ bisLink: 'https://xivgear.app/?page=sl|xyz' }));

      // WCAG 2.5.3 (Label in Name, round 9): the accessible name must contain
      // the visible word, so voice control's "click BiS" matches.
      const link = screen.getByRole('link', { name: 'BiS — Open in XIVGear' });
      expect(link).toHaveAttribute('href', 'https://xivgear.app/?page=sl|xyz');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('omits the BiS link affordance when the player has no bisLink', () => {
      renderCard(makePlayer({ bisLink: undefined }));
      expect(
        screen.queryByRole('link', { name: /Open (in|curated|BiS)/ })
      ).not.toBeInTheDocument();
    });

    it("footer claim story: 'You' when the card is claimed by the current user", () => {
      renderCard(makePlayer({ userId: 'u1' }));
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.queryByText('Unclaimed')).not.toBeInTheDocument();
    });

    it('exposes the membership role to AT without hover (PR review round 4)', () => {
      // The role's only home is the tooltip, and Tooltip vanishes on no-hover
      // devices — the badges carry sr-only role text so AT always hears it.
      const { unmount } = renderCard(makePlayer({ userId: 'u1' }));
      expect(screen.getByText('(owner)')).toBeInTheDocument();
      // …and the expansion needs its own separator, or the name computes as
      // "You(owner)" (round 10).
      expect(screen.getByText('You').closest('span')?.textContent).toBe('You (owner)');
      unmount();

      renderCard(
        makePlayer({
          userId: 'u2',
          linkedUser: {
            id: 'u2',
            discordId: 'd2',
            discordUsername: 'bram',
            displayName: 'Bram',
            membershipRole: 'lead',
          },
        })
      );
      expect(screen.getByText('(lead)')).toBeInTheDocument();
      expect(screen.getByText('Bram').closest('span')?.parentElement?.textContent).toBe(
        'Bram (lead)'
      );
    });

    it("footer claim story: the linked user's name when claimed by someone else", () => {
      renderCard(
        makePlayer({
          userId: 'u2',
          linkedUser: {
            id: 'u2',
            discordId: 'd2',
            discordUsername: 'bram',
            displayName: 'Bram',
            membershipRole: 'lead',
          },
        })
      );
      expect(screen.getByText('Bram')).toBeInTheDocument();
      expect(screen.queryByText('You')).not.toBeInTheDocument();
    });

    it('falls back to a generic Claimed tag when the linked user is not hydrated (round 5)', () => {
      // `linked_user` is optional in the API schema, so a claimed card can
      // arrive with only `userId`. The footer owns the whole claim story now —
      // it must never go blank on a claimed card.
      renderCard(makePlayer({ userId: 'u2', linkedUser: undefined }));
      expect(screen.getByText('Claimed')).toBeInTheDocument();
      expect(screen.queryByText('Unclaimed')).not.toBeInTheDocument();
      expect(screen.queryByText('You')).not.toBeInTheDocument();
    });
  });

  describe('now-vs-BiS metrics (D-10)', () => {
    it('prefers the equipped average when at least half the slots carry sync data', () => {
      // 6 of 11 slots (>= ceil(11/2)) with equipped iLv 730 → readout says 730.
      renderCard(
        makePlayer({
          gear: Array.from({ length: 11 }, (_, i) => ({
            slot: `s${i}`,
            bisSource: 'raid',
            hasItem: i < 6,
            isAugmented: false,
            equippedItemLevel: i < 6 ? 730 : undefined,
          })) as unknown as SnapshotPlayer['gear'],
        })
      );
      expect(screen.getByText('730')).toBeInTheDocument();
    });

    it('wires the breakdown panel behind the iLvl readout', () => {
      renderCard(
        makePlayer({
          gear: Array.from({ length: 11 }, (_, i) => ({
            slot: `s${i}`,
            bisSource: 'raid',
            hasItem: i < 6,
            isAugmented: false,
            equippedItemLevel: i < 6 ? 730 : undefined,
          })) as unknown as SnapshotPlayer['gear'],
        })
      );
      // Radix stamps the Trigger wrapper with data-state when the hover panel
      // is wired (same probe as the C2 pip-hover test).
      expect(screen.getByText('730').closest('[data-state]')).not.toBeNull();
    });

    it('opens the breakdown from keyboard focus (PR review round 4)', async () => {
      // The trigger must be focusable with an accessible name — Radix opens
      // the panel on focus, giving keyboard users the breakdown.
      renderCard(
        makePlayer({
          gear: Array.from({ length: 11 }, (_, i) => ({
            slot: `s${i}`,
            bisSource: 'raid',
            hasItem: i < 6,
            isAugmented: false,
            equippedItemLevel: i < 6 ? 730 : undefined,
          })) as unknown as SnapshotPlayer['gear'],
        })
      );
      // The trigger must not carry an aria-label: it would replace the number
      // AT is meant to read. The framing is sr-only text alongside it (round 8).
      const trigger = screen
        .getByText(/average item level breakdown/i)
        .closest('[tabindex="0"]') as HTMLElement;
      expect(trigger).not.toBeNull();
      expect(trigger).not.toHaveAttribute('aria-label');
      fireEvent.focus(trigger);
      // Radix renders the open content twice (portal + visually-hidden copy).
      expect((await screen.findAllByText('Average Item Level')).length).toBeGreaterThan(0);
    });

    it('marks an equipped-derived readout with the accent discriminator (director F3)', () => {
      // Legacy PlayerCardHeader colored the number to say WHICH metric it is
      // (accent = what the player has equipped). The hover alone is not a
      // visible discriminator.
      renderCard(
        makePlayer({
          gear: Array.from({ length: 11 }, (_, i) => ({
            slot: `s${i}`,
            bisSource: 'raid',
            hasItem: i < 6,
            isAugmented: false,
            equippedItemLevel: i < 6 ? 730 : undefined,
          })) as unknown as SnapshotPlayer['gear'],
        })
      );
      expect(screen.getByText('730')).toHaveClass('text-accent');
    });

    it('falls back to the BiS-target metric below the sync-coverage threshold (director F10)', () => {
      // 5 of 11 synced slots is under ceil(11/2): the equipped average must
      // NOT win. (With the test tier the BiS-target average is 0 -> "—",
      // styled as the non-equipped readout.)
      renderCard(
        makePlayer({
          gear: Array.from({ length: 11 }, (_, i) => ({
            slot: `s${i}`,
            bisSource: 'raid',
            hasItem: i < 6,
            isAugmented: false,
            equippedItemLevel: i < 5 ? 730 : undefined,
          })) as unknown as SnapshotPlayer['gear'],
        })
      );
      expect(screen.queryByText('730')).not.toBeInTheDocument();
      const placeholder = screen.getByText('—');
      expect(placeholder).not.toHaveClass('text-accent');
    });

    it('leaves the placeholder readout un-wired when there is no iLv to explain', () => {
      renderCard(makePlayer());
      expect(screen.getByText('—').closest('[data-state]')).toBeNull();
    });
  });

  describe('identity (D-11, lean: portrait + title, expanded only)', () => {
    const lodestone = {
      lodestoneId: '123',
      lodestoneName: 'Krile Baldesion',
      lodestoneServer: 'Balmung',
      lodestoneAvatarUrl: 'https://img2.finalfantasyxiv.com/f/abc.jpg',
    };

    it('shows the Lodestone portrait on the expanded card', () => {
      renderCard(makePlayer(lodestone), { density: 'expanded' });
      const img = screen.getByAltText('Tank One');
      expect(img).toHaveAttribute('src', lodestone.lodestoneAvatarUrl);
    });

    it('keeps the compact card portrait-free (initials fallback)', () => {
      renderCard(makePlayer(lodestone));
      expect(screen.queryByAltText('Tank One')).not.toBeInTheDocument();
    });

    it('shows the roster title on the expanded card only', () => {
      const { unmount } = renderCard(
        makePlayer({ rosterTitle: 'Shield of the Static' }),
        { density: 'expanded' }
      );
      expect(screen.getByText('Shield of the Static')).toBeInTheDocument();
      unmount();

      renderCard(makePlayer({ rosterTitle: 'Shield of the Static' }));
      expect(screen.queryByText('Shield of the Static')).not.toBeInTheDocument();
    });
  });

  describe('sync line (D-12 rider, leaner R-072)', () => {
    const twoHoursAgo = () => new Date(Date.now() - 2 * 3600_000).toISOString();

    it('names the character on the footer sync line, with the age as its own segment', () => {
      // Two segments (director F5): the NAME truncates at narrow widths, the
      // age never does — both facts survive a crowded footer.
      renderCard(
        makePlayer({
          lodestoneId: '123',
          lodestoneName: 'Krile Baldesion',
          lodestoneServer: 'Balmung',
          lastSync: twoHoursAgo(),
        })
      );
      expect(screen.getByText('Krile Baldesion')).toBeInTheDocument();
      expect(screen.getByText(/synced 2h ago/)).toBeInTheDocument();
    });

    it('wires the sync detail tooltip behind the linked line, not the unlinked one', () => {
      const { unmount } = renderCard(
        makePlayer({
          lodestoneId: '123',
          lodestoneName: 'Krile Baldesion',
          lodestoneServer: 'Balmung',
          lastSync: twoHoursAgo(),
        })
      );
      expect(
        screen.getByText('Krile Baldesion').closest('[data-state]')
      ).not.toBeNull();
      unmount();

      renderCard(makePlayer());
      expect(screen.getByText('Not synced').closest('[data-state]')).toBeNull();
    });

    it('recognizes a Player Hub sync with no Lodestone identity (PR review)', () => {
      // _auto_link_bis_from_hub populates lastSync/equipped gear WITHOUT
      // lodestone fields — the footer must not say "Not synced" while the
      // headline shows the synced equipped average.
      renderCard(
        makePlayer({
          lastSync: twoHoursAgo(),
          lastSyncSource: 'player_hub',
          lastSyncedJob: 'PLD',
          gear: Array.from({ length: 11 }, (_, i) => ({
            slot: `s${i}`,
            bisSource: 'raid',
            hasItem: false,
            isAugmented: false,
            equippedItemLevel: i < 6 ? 730 : undefined,
          })) as unknown as SnapshotPlayer['gear'],
        })
      );
      expect(screen.queryByText('Not synced')).not.toBeInTheDocument();
      expect(screen.getByText('Player Hub')).toBeInTheDocument();
      expect(screen.getByText(/synced 2h ago/)).toBeInTheDocument();
    });

    it('flags a job mismatch on a Player Hub sync too (PR review)', () => {
      renderCard(
        makePlayer({
          lastSync: twoHoursAgo(),
          lastSyncSource: 'player_hub',
          lastSyncedJob: 'WAR',
          job: 'PLD',
        })
      );
      expect(screen.getByTestId('roster-sync-mismatch')).toBeInTheDocument();
    });

    it('flags a job mismatch between the last sync and the card job', () => {
      const { unmount } = renderCard(
        makePlayer({
          lodestoneId: '123',
          lodestoneName: 'Krile Baldesion',
          lastSync: twoHoursAgo(),
          lastSyncedJob: 'WAR',
          job: 'PLD',
        })
      );
      expect(screen.getByTestId('roster-sync-mismatch')).toBeInTheDocument();
      unmount();

      renderCard(
        makePlayer({
          lodestoneId: '123',
          lodestoneName: 'Krile Baldesion',
          lastSync: twoHoursAgo(),
          lastSyncedJob: 'pld',
          job: 'PLD',
        })
      );
      expect(screen.queryByTestId('roster-sync-mismatch')).not.toBeInTheDocument();
    });

    it('opens the sync detail from the keyboard (PR review round 7)', async () => {
      renderCard(
        makePlayer({
          lodestoneId: '123',
          lodestoneName: 'Krile Baldesion',
          lodestoneServer: 'Balmung',
          lastSync: twoHoursAgo(),
        })
      );

      // No aria-label: the character name and sync age inside the trigger are
      // the information AT should hear (round 8).
      const trigger = screen.getByText(/sync details/i).closest('[tabindex="0"]') as HTMLElement;
      expect(trigger).not.toBeNull();
      expect(trigger).not.toHaveAttribute('aria-label');
      fireEvent.focus(trigger);
      // Radix renders the open content twice (portal + visually-hidden copy).
      expect((await screen.findAllByText(/Balmung/)).length).toBeGreaterThan(0);
    });

    it('does not repeat the provenance when the detail header already names it (round 7)', async () => {
      const openDetail = async () => {
        fireEvent.focus(screen.getByText(/sync details/i).closest('[tabindex="0"]') as HTMLElement);
        // Radix renders the open content twice (portal + visually-hidden copy).
        await screen.findAllByText(/Last synced 2h ago/);
      };

      // No Lodestone identity → the tooltip header names the source, so the
      // detail line must not say it a second time.
      const { unmount } = renderCard(
        makePlayer({ lastSync: twoHoursAgo(), lastSyncSource: 'player_hub', lastSyncedJob: 'PLD' })
      );
      await openDetail();
      expect(screen.getAllByText('Player Hub sync')).toHaveLength(2);
      expect(screen.getAllByText('Last synced 2h ago · as PLD').length).toBeGreaterThan(0);
      unmount();

      // Scheduled sync with no identity: the header names the provider through
      // the same labels rather than falling back to a generic string.
      const second = renderCard(
        makePlayer({ lastSync: twoHoursAgo(), lastSyncSource: 'auto_xivapi' })
      );
      await openDetail();
      expect(screen.getAllByText('Scheduled Lodestone sync').length).toBeGreaterThan(0);
      second.unmount();

      // WITH identity the header names character • server, so the detail keeps
      // carrying the provenance.
      renderCard(
        makePlayer({
          lodestoneId: '123',
          lodestoneName: 'Krile Baldesion',
          lodestoneServer: 'Balmung',
          lastSync: twoHoursAgo(),
          lastSyncSource: 'tomestone',
        })
      );
      await openDetail();
      expect(screen.getAllByText('Last synced 2h ago · Lodestone sync').length).toBeGreaterThan(0);
    });
  });

  describe('active BiS target chip (D-01 remainder, expanded only)', () => {
    const makeTarget = (overrides: Partial<SharedBiSTargetSet> = {}): SharedBiSTargetSet =>
      ({
        id: 'bt1',
        ownerType: 'roster_member_job',
        ownerId: 'p1',
        job: 'PLD',
        name: '7.2 Savage BiS',
        purpose: 'savage',
        sourceType: 'xivgear',
        importStatus: 'imported',
        isActive: true,
        isPublic: false,
        itemLevel: 735,
        createdAt: '',
        updatedAt: '',
        ...overrides,
      }) as SharedBiSTargetSet;

    const seedStore = (targets: SharedBiSTargetSet[]) => {
      useSharedBisStore.setState({ targets: { 'roster_member_job:p1': targets }, loading: {} });
    };

    it('shows the active target on the expanded card', () => {
      seedStore([makeTarget()]);
      renderCard(makePlayer(), { density: 'expanded' });
      expect(
        screen.getByRole('button', { name: /Target: 7\.2 Savage BiS · iLv 735/ })
      ).toBeInTheDocument();
    });

    it('counts additional same-job targets', () => {
      seedStore([makeTarget(), makeTarget({ id: 'bt2', name: 'Alt set', isActive: false })]);
      renderCard(makePlayer(), { density: 'expanded' });
      expect(screen.getByRole('button', { name: /\(\+1\)/ })).toBeInTheDocument();
    });

    it('stays off the compact card and off cards with no populated store', () => {
      seedStore([makeTarget()]);
      const { unmount } = renderCard(makePlayer());
      expect(screen.queryByRole('button', { name: /Target:/ })).not.toBeInTheDocument();
      unmount();

      useSharedBisStore.setState({ targets: {}, loading: {} });
      renderCard(makePlayer(), { density: 'expanded' });
      expect(screen.queryByRole('button', { name: /Target:/ })).not.toBeInTheDocument();
    });

    it('opens the BiS Targets manager', async () => {
      // The modal fetches on mount; give it a quiet network.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
      seedStore([makeTarget()]);
      renderCard(makePlayer(), { density: 'expanded' });

      fireEvent.click(screen.getByRole('button', { name: /Target: 7\.2 Savage BiS/ }));
      expect(await screen.findByText(/BiS Targets —/)).toBeInTheDocument();
    });
  });
});

// ── C7 (D-15): the job-change confirm's third option ──
// Legacy's confirm offered three buttons — "Change Job & Update BiS",
// "Change Job Only", Cancel (PlayerCard.tsx:800-840). v2 expresses the same
// three outcomes as the radio's three modes; picking the import mode relabels
// the commit button to legacy's exact string (user ruling 2026-07-27) and
// hands off to the same BiS import modal the kebab opens.
describe('RosterCard — job change → BiS import (C7, D-15)', () => {
  function freshActions(): RosterCardActions {
    return { onUpdate: vi.fn().mockResolvedValue(undefined), onCopy: vi.fn(), onDuplicate: vi.fn() };
  }

  /** Open the confirm by picking WAR over the player's PLD. */
  function openJobChangeConfirm() {
    fireEvent.click(screen.getByRole('button', { name: /change job/i }));
    fireEvent.click(screen.getByText('WAR'));
  }

  it('commits the job change and opens the BiS import when the update-BiS mode is chosen', async () => {
    const cardActions = freshActions();
    renderCard(makePlayer({ bisLink: undefined }), { actions: cardActions });

    openJobChangeConfirm();
    fireEvent.click(screen.getByRole('radio', { name: /update bis for the new job/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Change Job & Update BiS' }));

    await waitFor(() => {
      expect(cardActions.onUpdate).toHaveBeenCalledWith({ job: 'WAR', role: 'tank' });
    });
    // The hand-off: the same import modal the kebab's "Import BiS" opens.
    expect(await screen.findByText('Import BiS for Tank One')).toBeInTheDocument();
  });

  it('leaves the BiS link untouched in the update-BiS mode (the import replaces it)', async () => {
    const cardActions = freshActions();
    renderCard(makePlayer({ bisLink: 'https://etro.gg/gearset/abc' }), { actions: cardActions });

    openJobChangeConfirm();
    fireEvent.click(screen.getByRole('radio', { name: /update bis for the new job/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Change Job & Update BiS' }));

    await waitFor(() => {
      expect(cardActions.onUpdate).toHaveBeenCalledWith({ job: 'WAR', role: 'tank' });
    });
  });

  it('keeps the plain "Change Job" label and opens no import in the keep mode', async () => {
    const cardActions = freshActions();
    renderCard(makePlayer({ bisLink: undefined }), { actions: cardActions });

    openJobChangeConfirm();
    expect(screen.getByRole('button', { name: 'Change Job' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change Job' }));

    await waitFor(() => {
      expect(cardActions.onUpdate).toHaveBeenCalledWith({ job: 'WAR', role: 'tank' });
    });
    expect(screen.queryByText('Import BiS for Tank One')).not.toBeInTheDocument();
  });
});

// ── C7 (D-05): gear slot → ledger jumps, wired at the card ──
// The table renders the affordance; the CARD resolves which entry a slot
// points at (from the loot/material logs) and writes the same-route URL params
// the Loot screen's History view consumes — the C4 jump pattern, generalised.
describe('RosterCard — slot ledger jumps (C7, D-05)', () => {
  const gearWithHead = [
    { slot: 'head' as const, bisSource: 'raid' as const, hasItem: true, isAugmented: false },
  ];

  function lootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
    return {
      id: 51,
      tierSnapshotId: 't1',
      weekNumber: 2,
      floor: 'floor1',
      itemSlot: 'head',
      recipientPlayerId: 'p1',
      recipientPlayerName: 'Tank One',
      method: 'drop',
      isExtra: false,
      createdAt: '2026-07-01T00:00:00Z',
      createdByUserId: 'u1',
      createdByUsername: 'owner',
      ...overrides,
    };
  }

  it('Alt+Click on a slot with a loot entry jumps to that entry in the History view', () => {
    useLootTrackingStore.setState({ lootLog: [lootEntry()] });
    renderCard(makePlayer({ gear: gearWithHead }), { density: 'expanded' });

    fireEvent.click(screen.getByRole('link', { name: /Head/ }), { altKey: true, detail: 1 });

    const params = new URLSearchParams(currentSearch());
    expect(params.get('tab')).toBe('gear');
    expect(params.get('lview')).toBe('history');
    expect(params.get('entry')).toBe('51');
    expect(params.get('entryType')).toBe('loot');
  });

  it("another player's loot entry never lights a slot jump", () => {
    useLootTrackingStore.setState({ lootLog: [lootEntry({ recipientPlayerId: 'p9' })] });
    renderCard(makePlayer({ gear: gearWithHead }), { density: 'expanded' });

    expect(screen.queryByRole('link', { name: /Head/ })).not.toBeInTheDocument();
  });

  it('the right-click menu jumps to the material entry for an augmented slot', () => {
    useLootTrackingStore.setState({
      lootLog: [],
      materialLog: [
        {
          id: 63,
          tierSnapshotId: 't1',
          weekNumber: 3,
          floor: 'floor2',
          materialType: 'twine',
          recipientPlayerId: 'p1',
          recipientPlayerName: 'Tank One',
          method: 'drop',
          slotAugmented: 'head',
          createdAt: '2026-07-01T00:00:00Z',
          createdByUserId: 'u1',
          createdByUsername: 'owner',
        } satisfies MaterialLogEntry,
      ],
    });
    renderCard(makePlayer({ gear: gearWithHead }), { density: 'expanded' });

    fireEvent.contextMenu(screen.getByRole('link', { name: /Head/ }), { clientX: 20, clientY: 30 });
    fireEvent.click(screen.getByText('Jump to Material Entry'));

    const params = new URLSearchParams(currentSearch());
    expect(params.get('entry')).toBe('63');
    expect(params.get('entryType')).toBe('material');
  });

  it('does not scan the ledgers at all while the card is compact', () => {
    // The resolver walks both logs for 11 slots per card; a compact card never
    // mounts the gear table, so that work has no consumer (PR #200 review).
    useLootTrackingStore.setState({ lootLog: [lootEntry()] });
    buildSpy.mockClear();
    renderCard(makePlayer({ gear: gearWithHead }));
    expect(buildSpy).not.toHaveBeenCalled();

    buildSpy.mockClear();
    renderCard(makePlayer({ gear: gearWithHead }), { density: 'expanded' });
    expect(buildSpy).toHaveBeenCalled();
  });

  it('the compact card carries no slot jumps (the gear table is the jump surface)', () => {
    useLootTrackingStore.setState({ lootLog: [lootEntry()] });
    renderCard(makePlayer({ gear: gearWithHead }));

    expect(screen.queryByRole('link', { name: /Head/ })).not.toBeInTheDocument();
  });
});

// ── C7 (D-05): the kebab's "Edit Books" jump ──
describe('RosterCard — Edit Books jump (C7, D-05)', () => {
  it('navigates to this player\'s row in the Books ledger', () => {
    renderCard(makePlayer());

    fireEvent.click(screen.getByRole('button', { name: /player actions/i }));
    fireEvent.click(screen.getByText('Edit Books'));

    const params = new URLSearchParams(currentSearch());
    expect(params.get('tab')).toBe('gear');
    expect(params.get('lview')).toBe('history');
    expect(params.get('book')).toBe('p1');
  });

  it('never carries a stale entry highlight into the Books jump', () => {
    // The two jumps write the same route: a books jump arriving after a ledger
    // jump must not leave `entry`/`entryType` behind to re-pulse a loot row.
    useLootTrackingStore.setState({
      materialLog: [
        {
          id: 63,
          tierSnapshotId: 't1',
          weekNumber: 3,
          floor: 'floor2',
          materialType: 'twine',
          recipientPlayerId: 'p1',
          recipientPlayerName: 'Tank One',
          method: 'drop',
          slotAugmented: 'head',
          createdAt: '2026-07-01T00:00:00Z',
          createdByUserId: 'u1',
          createdByUsername: 'owner',
        } satisfies MaterialLogEntry,
      ],
    });
    renderCard(
      makePlayer({
        gear: [{ slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false }],
      }),
      { density: 'expanded' }
    );

    fireEvent.click(screen.getByRole('link', { name: /Head/ }), { altKey: true, detail: 1 });
    expect(new URLSearchParams(currentSearch()).get('entry')).toBe('63');

    fireEvent.click(screen.getByRole('button', { name: /player actions/i }));
    fireEvent.click(screen.getByText('Edit Books'));

    const params = new URLSearchParams(currentSearch());
    expect(params.get('book')).toBe('p1');
    expect(params.get('entry')).toBeNull();
    expect(params.get('entryType')).toBeNull();
  });

  it('never carries a stale book highlight into a ledger jump', () => {
    // The mirror of the case above: one navigation, one highlight.
    useLootTrackingStore.setState({
      lootLog: [
        {
          id: 51,
          tierSnapshotId: 't1',
          weekNumber: 2,
          floor: 'floor1',
          itemSlot: 'head',
          recipientPlayerId: 'p1',
          recipientPlayerName: 'Tank One',
          method: 'drop',
          isExtra: false,
          createdAt: '2026-07-01T00:00:00Z',
          createdByUserId: 'u1',
          createdByUsername: 'owner',
        } satisfies LootLogEntry,
      ],
    });
    renderCard(
      makePlayer({
        gear: [{ slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false }],
      }),
      { density: 'expanded' }
    );

    fireEvent.click(screen.getByRole('button', { name: /player actions/i }));
    fireEvent.click(screen.getByText('Edit Books'));
    expect(new URLSearchParams(currentSearch()).get('book')).toBe('p1');

    fireEvent.click(screen.getByRole('link', { name: /Head/ }), { altKey: true, detail: 1 });

    const params = new URLSearchParams(currentSearch());
    expect(params.get('entry')).toBe('51');
    expect(params.get('book')).toBeNull();
  });
});

// ── C7 (D-55 roster half): the modifier affordances ──
// R-062 (Shift+Click the card copies its deep link) and R-076 (the kebab
// tooltip that teaches the modifiers). Ruled 2026-07-26: these are superuser
// affordances — shortcuts and right-click, discovered over time. The kebab's
// "Copy URL" item STAYS (user ruling 2026-07-27): a menu item is not the
// "dedicated button" the ruling de-emphasizes, and it is the only
// keyboard-reachable route to the same link.
describe('RosterCard — modifier affordances (C7, D-55)', () => {
  it('Shift+Click on the card copies its deep link', () => {
    const onCopyUrl = vi.fn();
    renderCard(makePlayer(), { actions: { ...actions, onCopyUrl } });

    fireEvent.click(screen.getByText('Tank One'), { shiftKey: true });
    expect(onCopyUrl).toHaveBeenCalledTimes(1);
  });

  it('a plain click never copies', () => {
    const onCopyUrl = vi.fn();
    renderCard(makePlayer(), { actions: { ...actions, onCopyUrl } });

    fireEvent.click(screen.getByText('Tank One'));
    expect(onCopyUrl).not.toHaveBeenCalled();
  });

  it('keeps the kebab "Copy URL" item as the keyboard-reachable route', () => {
    const onCopyUrl = vi.fn();
    renderCard(makePlayer(), { actions: { ...actions, onCopyUrl } });

    fireEvent.click(screen.getByRole('button', { name: /player actions/i }));
    fireEvent.click(screen.getByText('Copy URL'));
    expect(onCopyUrl).toHaveBeenCalledTimes(1);
  });

  it('a Shift+Click inside the card menu does not ALSO copy the link', async () => {
    // React bubbles synthetic events through the REACT tree, so the portalled
    // ContextMenu's clicks still reach the card's Shift handler: Shift+Click
    // "Copy URL" would fire the item AND the card handler — two clipboard
    // writes, two toasts, on exactly the item the D-55 ruling kept as the
    // announced route to the link (PR #200 review).
    const onCopyUrl = vi.fn();
    renderCard(makePlayer(), { actions: { ...actions, onCopyUrl } });

    fireEvent.click(screen.getByRole('button', { name: /player actions/i }));
    fireEvent.click(screen.getByText('Copy URL'), { shiftKey: true });

    expect(onCopyUrl).toHaveBeenCalledTimes(1);
  });

  it('teaches the modifiers on the kebab (R-076)', async () => {
    renderCard(makePlayer(), { actions: { ...actions, onCopyUrl: vi.fn() } });

    fireEvent.focus(screen.getByRole('button', { name: /player actions/i }));
    // Radix renders tooltip content twice — the visible popup and the
    // visually-hidden copy it wires as aria-describedby.
    expect((await screen.findAllByText('Copy link')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shift+Click').length).toBeGreaterThan(0);
    expect(screen.getAllByText('More options').length).toBeGreaterThan(0);
  });

  it('does not teach a copy shortcut the card cannot perform', () => {
    // No onCopyUrl → no Shift+Click behaviour → the hint must not claim one.
    renderCard(makePlayer());

    fireEvent.focus(screen.getByRole('button', { name: /player actions/i }));
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
  });
});
