import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { RosterCard } from './RosterCard';
import { TooltipProvider } from '../primitives';
import type { RosterCardActions } from '../../hooks/useRosterCardActions';
import type { MaterialLogEntry, SnapshotPlayer } from '../../types';
import { useToastStore } from '../../stores/toastStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useSharedBisStore } from '../../stores/sharedBisStore';
import type { SharedBiSTargetSet } from '../../types';
import { eventBus, Events } from '../../lib/eventBus';
import { computeGearSlotUpdate, fromGearState } from '../../utils/calculations';

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
  // C4 material-jump tests seed the material log; give every test a clean one.
  useLootTrackingStore.setState({ materialLog: [] });
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

    it('compact pips stay read-only even for an owner (editing lives in the table)', () => {
      const onUpdate = vi.fn();
      renderCard(makeGearedPlayer(), { actions: { ...actions, onUpdate } });

      const pips = screen.getAllByRole('checkbox');
      expect(pips.length).toBeGreaterThan(0);
      for (const pip of pips) {
        expect(pip).toHaveAttribute('aria-disabled', 'true');
      }
      fireEvent.click(pips[0]);
      expect(onUpdate).not.toHaveBeenCalled();
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

    it('compact pips with item data carry the hover item-card wiring (inspect, not edit)', () => {
      // Legacy compact parity (R-065 hover leg): the pip strip supports
      // INSPECTION via the hover item card while staying non-editing.
      renderCard(
        makePlayer({
          id: 'p6',
          gear: [
            { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false, itemName: 'Hover Helm', itemLevel: 730 },
            { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false },
          ] as unknown as SnapshotPlayer['gear'],
        })
      );

      const pips = screen.getAllByRole('checkbox');
      // Radix stamps its Trigger wrapper with data-state when the hover card is
      // wired; the bare slot gets no wrapper.
      const wired = pips.filter((p) => p.closest('[data-state]'));
      expect(wired).toHaveLength(1);
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

    it('renders the BiS link as a real external anchor on the progress line', () => {
      renderCard(makePlayer({ bisLink: 'https://xivgear.app/?page=sl|xyz' }));

      const link = screen.getByRole('link', { name: 'Open in XIVGear' });
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
      const trigger = screen.getByLabelText('Average item level breakdown');
      expect(trigger).toHaveAttribute('tabindex', '0');
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
