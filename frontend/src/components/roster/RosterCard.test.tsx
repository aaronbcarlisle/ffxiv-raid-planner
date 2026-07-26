import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RosterCard } from './RosterCard';
import { TooltipProvider } from '../primitives';
import type { RosterCardActions } from '../../hooks/useRosterCardActions';
import type { SnapshotPlayer } from '../../types';
import { useToastStore } from '../../stores/toastStore';
import { eventBus, Events } from '../../lib/eventBus';
import { computeGearSlotUpdate, fromGearState } from '../../utils/calculations';

beforeEach(() => {
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
  return render(
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
    </TooltipProvider>
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
        await waitFor(() => expect(received).toHaveLength(0));
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
  });
});
