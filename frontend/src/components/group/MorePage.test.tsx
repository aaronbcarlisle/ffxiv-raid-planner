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
import { render, screen, fireEvent } from '@testing-library/react';
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
});
