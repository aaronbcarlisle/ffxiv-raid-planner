/**
 * MorePage — flip-P3 Task 4 fold-ins (dead More-page deep links, D-P3-2/spec review).
 *
 * 1. Split Planner card is gone entirely — the split-clear capability was
 *    dropped this task (D-P3-2), so the shortcut has nowhere left to go.
 * 2. Integrations card no longer routes to the deleted legacy ScheduleTab's
 *    calendar/integrations sub-tab (dead deep link — zero readers once
 *    ScheduleTab was deleted). It now opens the Settings panel directly on
 *    the Integrations tab.
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
      onSetGearSubTab={noop}
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

  it('does not render a Split Planner card (split-clear capability dropped)', () => {
    renderMorePage();
    expect(screen.queryByText('Split Planner')).toBeNull();
    expect(screen.queryByText(/Open Split Planner/i)).toBeNull();
  });

  it('calls onOpenIntegrations (settings-panel open with the integrations tab) when the Integrations card is clicked', () => {
    const onOpenIntegrations = vi.fn();
    renderMorePage({ onOpenIntegrations });

    fireEvent.click(screen.getByText('Integrations'));

    expect(onOpenIntegrations).toHaveBeenCalledTimes(1);
  });

  it('keeps the Integrations card copy unchanged', () => {
    renderMorePage();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText(/Connect Discord and other services/i)).toBeInTheDocument();
  });
});
