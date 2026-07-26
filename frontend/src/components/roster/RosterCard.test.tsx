import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RosterCard } from './RosterCard';
import { TooltipProvider } from '../primitives';
import type { RosterCardActions } from '../../hooks/useRosterCardActions';
import type { SnapshotPlayer } from '../../types';
import { useToastStore } from '../../stores/toastStore';

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
    renderCard(makePlayer({ bisLink: undefined }));

    fireEvent.click(screen.getByRole('button', { name: /player actions/i }));

    expect(screen.getByText('Import BiS')).toBeInTheDocument();
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

    it('shows the per-card chevron only when the override callback is wired, and fires it', () => {
      renderCard(makePlayer());
      expect(screen.queryByRole('button', { name: /expand card/i })).not.toBeInTheDocument();

      const onToggleDensity = vi.fn();
      renderCard(makePlayer({ id: 'p2' }), { onToggleDensity });
      const chevron = screen.getByRole('button', { name: /expand card/i });
      expect(chevron).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(chevron);
      expect(onToggleDensity).toHaveBeenCalledTimes(1);
    });

    it('labels the chevron "Collapse card" while expanded', () => {
      renderCard(makePlayer(), { density: 'expanded', onToggleDensity: vi.fn() });
      expect(screen.getByRole('button', { name: /collapse card/i })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });
  });
});
