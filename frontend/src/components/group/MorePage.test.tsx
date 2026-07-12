/**
 * MorePage — flip-P3 Task 4 fold-ins, updated for the Phase R dual shell.
 *
 * 1. Split Planner card is prop-gated: v2 dropped the capability from the
 *    More page (D-P3-2), so the card renders ONLY when the caller wires the
 *    optional `onOpenSplitPlanner` handler. The legacy shell does
 *    (GroupViewContent passes it when no roster slot is present — see
 *    GroupViewContent.slots.test.tsx for that wiring); v2 never does, so
 *    without the prop the card must stay absent.
 * 2. Integrations card no longer routes to the legacy ScheduleTab's
 *    calendar/integrations sub-tab. It now opens the Settings panel directly
 *    on the Integrations tab (both shells — the caller supplies the handler).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemberRole } from '../../types';

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (selector: (s: { pendingCount: number; groupRequests: unknown[] }) => unknown) =>
    selector({ pendingCount: 0, groupRequests: [] }),
}));
vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: (selector: (s: { settings: null }) => unknown) => selector({ settings: null }),
}));
vi.mock('../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (selector: (s: { lootLog: unknown[] }) => unknown) => selector({ lootLog: [] }),
}));

import { MorePage } from './MorePage';

const noop = () => {};

function renderMorePage(overrides: Partial<Parameters<typeof MorePage>[0]> = {}) {
  return render(
    <MorePage
      onOpenSettings={noop}
      onNavigate={noop}
      onOpenLootHistory={noop}
      onOpenIntegrations={noop}
      onOpenPlugin={noop}
      canManage={true}
      userRole={'owner' as MemberRole}
      {...overrides}
    />
  );
}

describe('MorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no matchMedia; ConfirmModal -> Modal -> useDevice needs it
    // (Modal's hooks run even while isOpen is false). Same stub as
    // WeekScopeControl.test.tsx.
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
      }))
    );
  });

  it('does not render the Split Planner card when onOpenSplitPlanner is not wired (v2 shell)', () => {
    renderMorePage();
    expect(screen.queryByText('Split Planner')).toBeNull();
    expect(screen.queryByText(/Open Split Planner/i)).toBeNull();
  });

  it('renders the Split Planner card when onOpenSplitPlanner is wired (legacy shell) and clicking it fires the handler', () => {
    const onOpenSplitPlanner = vi.fn();
    renderMorePage({ onOpenSplitPlanner });

    expect(screen.getByText('Split Planner')).toBeInTheDocument();
    expect(screen.getByText(/Open Split Planner/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Split Planner'));

    expect(onOpenSplitPlanner).toHaveBeenCalledTimes(1);
  });

  it('does not render the Switch to classic UI section when onSwitchToClassicUi is not wired (legacy shell)', () => {
    renderMorePage();
    expect(screen.queryByRole('button', { name: /switch to classic ui/i })).toBeNull();
    expect(screen.queryByText('Interface')).toBeNull();
  });

  it('renders the Switch to classic UI button at all viewports when onSwitchToClassicUi is wired (v2) and clicking fires it', () => {
    const onSwitchToClassicUi = vi.fn();
    renderMorePage({ onSwitchToClassicUi });

    const button = screen.getByRole('button', { name: /switch to classic ui/i });
    // All-viewports contract (approved skim §6.5): no responsive hiding on the
    // button or its section — on mobile this is the ONLY v2→legacy path.
    expect(button.className).not.toMatch(/(^|\s)(hidden|sm:hidden|max-sm:hidden)(\s|$)/);
    expect(button.closest('section')?.className ?? '').not.toMatch(/(^|\s)(hidden|sm:hidden|max-sm:hidden)(\s|$)/);
    fireEvent.click(button);
    expect(onSwitchToClassicUi).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenIntegrations (settings-panel open with the integrations tab) when the Integrations card is clicked', () => {
    const onOpenIntegrations = vi.fn();
    renderMorePage({ onOpenIntegrations });

    fireEvent.click(screen.getByText('Integrations'));

    expect(onOpenIntegrations).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenLootHistory (not onNavigate/onSetGearSubTab) when the Loot History card is clicked', () => {
    const onOpenLootHistory = vi.fn();
    const onNavigate = vi.fn();
    renderMorePage({ onOpenLootHistory, onNavigate });

    fireEvent.click(screen.getByText('Loot History'));

    expect(onOpenLootHistory).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('keeps the Integrations card copy unchanged', () => {
    renderMorePage();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText(/Connect Discord and other services/i)).toBeInTheDocument();
  });

  // ── Danger Zone (Phase A Task 5 / A4) ──

  it("owner: Delete Static opens the settings panel on the real 'static' tab (not the dead 'danger' id)", () => {
    const onOpenSettings = vi.fn();
    renderMorePage({ onOpenSettings });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Static' }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledWith('static');
  });

  it('owner: Archive Static is removed outright (no button, no Coming-soon placeholder)', () => {
    renderMorePage();
    expect(screen.queryByText('Archive Static')).toBeNull();
  });

  it('owner: never sees Leave Static, even when onLeaveStatic is wired', () => {
    renderMorePage({ onLeaveStatic: vi.fn() });
    expect(screen.queryByText('Leave Static')).toBeNull();
  });

  it('member: clicking Leave Static opens the confirm modal; confirming calls onLeaveStatic (settings panel never involved)', async () => {
    const onLeaveStatic = vi.fn().mockResolvedValue(undefined);
    const onOpenSettings = vi.fn();
    renderMorePage({ userRole: 'member' as MemberRole, canManage: false, onLeaveStatic, onOpenSettings });

    fireEvent.click(screen.getByRole('button', { name: 'Leave Static' }));

    // The confirm modal opens with the unlink warning; nothing fired yet.
    expect(screen.getByText(/claimed will be unlinked/i)).toBeInTheDocument();
    expect(onLeaveStatic).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Leave Static' }));

    await waitFor(() => expect(onLeaveStatic).toHaveBeenCalledTimes(1));
    expect(onOpenSettings).not.toHaveBeenCalled();
    // The modal closes after the handler resolves.
    await waitFor(() => expect(screen.queryByText(/claimed will be unlinked/i)).toBeNull());
  });

  it('member: cancelling the confirm modal closes it without calling onLeaveStatic', async () => {
    const onLeaveStatic = vi.fn();
    renderMorePage({ userRole: 'member' as MemberRole, canManage: false, onLeaveStatic });

    fireEvent.click(screen.getByRole('button', { name: 'Leave Static' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/claimed will be unlinked/i)).toBeNull());
    expect(onLeaveStatic).not.toHaveBeenCalled();
  });

  it('member: Leave Static (and the then-empty Danger Zone) are absent when onLeaveStatic is not wired', () => {
    renderMorePage({ userRole: 'member' as MemberRole, canManage: false });
    expect(screen.queryByText('Leave Static')).toBeNull();
    expect(screen.queryByText('Danger Zone')).toBeNull();
  });
});
