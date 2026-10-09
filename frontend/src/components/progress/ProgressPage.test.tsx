/**
 * ProgressPage (S2a-2·F1 Task TF1) — header, the tier row and the members-only
 * card. No farm data yet. The shared week clock is seeded on the real loot store
 * (the page reads it like Home does); the api client is mocked so the R-S2-19
 * test can record every request a non-member's render makes.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import { api } from '../../services/api';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import { getTierById } from '../../gamedata';
import { ProgressPage } from './ProgressPage';
import type { StaticGroup, TierSnapshot } from '../../types';

const group = {
  id: 'g1',
  name: 'Dev Test Static',
  shareCode: 'DEVTST',
  settings: {},
  userRole: 'owner',
  members: [],
} as unknown as StaticGroup;

const tier = { id: 't1', staticGroupId: 'g1', tierId: 'aac-cruiserweight' } as unknown as TierSnapshot;
const tierName = getTierById('aac-cruiserweight')!.name;

/** Seeds the shared week clock: `week` for this (static, tier), or unresolved. */
function seedWeek(week: number | null) {
  useLootTrackingStore.setState(
    week === null
      ? { currentWeek: 1, weekClockKey: null }
      : { currentWeek: week, weekClockKey: weekClockKeyOf('g1', 'aac-cruiserweight') },
  );
}

function renderPage(props: Partial<Parameters<typeof ProgressPage>[0]> = {}) {
  const onNavigate = vi.fn();
  render(
    <MemoryRouter>
      <ProgressPage
        group={group}
        tier={tier}
        canManage={true}
        userRole="owner"
        currentUserId="u1"
        isViewingAs={false}
        onNavigate={onNavigate}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onNavigate };
}

beforeEach(() => {
  vi.clearAllMocks();
  seedWeek(11);
});

describe('ProgressPage', () => {
  it('renders the screen, the "Progress" header and the week subtitle', () => {
    renderPage();
    expect(screen.getByTestId('progress-screen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    expect(
      screen.getByText('Every track Dev Test Static is working on, the tier first · Week 11'),
    ).toBeInTheDocument();
  });

  it('drops the "· Week" tail while the week is unknown', () => {
    seedWeek(null);
    renderPage();
    expect(
      screen.getByText('Every track Dev Test Static is working on, the tier first'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Week/)).not.toBeInTheDocument();
  });

  it('shows the tier name and week on the tier row, and Open board navigates to the board', () => {
    const { onNavigate } = renderPage();
    const row = screen.getByTestId('progress-tier-row');
    expect(row).toHaveTextContent(tierName);
    expect(row).toHaveTextContent('Week 11');
    fireEvent.click(screen.getByRole('button', { name: 'Open board' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('roster', { rview: 'board' });
  });

  it('shows no week on the tier row while the week is unknown', () => {
    seedWeek(null);
    renderPage();
    expect(screen.getByTestId('progress-tier-row')).not.toHaveTextContent('Week');
  });

  it('a member with no farms sees the tier row first and no empty state', () => {
    renderPage({ userRole: 'member', canManage: false });
    expect(screen.getByTestId('progress-tier-row')).toBeInTheDocument();
    expect(screen.queryByTestId('members-only-card')).not.toBeInTheDocument();
    expect(screen.queryByText(/no farms|nothing yet|get started/i)).not.toBeInTheDocument();
  });

  it('has no Objectives / Farms switch (P-12)', () => {
    renderPage();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /objectives|farms/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /objectives|farms/i })).not.toBeInTheDocument();
  });

  it('shows outsiders the members-only card and fires no collection request (R-S2-19)', () => {
    renderPage({ userRole: null, canManage: false });
    expect(screen.getByTestId('progress-tier-row')).toBeInTheDocument();
    expect(screen.getByTestId('members-only-card')).toHaveTextContent(
      'Farms are shared with members of Dev Test Static.',
    );
    const requested = [api.get, api.post, api.put, api.patch, api.delete].flatMap((fn) =>
      (fn as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0])),
    );
    expect(requested.filter((url) => url.includes('/collection-'))).toEqual([]);
  });
});
