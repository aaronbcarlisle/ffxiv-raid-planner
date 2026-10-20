/**
 * ProgressPage (S2a-2·F1 Task TF1) — header, the tier row and the members-only
 * card. No farm data yet. The shared week clock is seeded on the real loot store
 * (the page reads it like Home does); the api client is mocked so the R-S2-19
 * test can record every request a non-member's render makes.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  // S2a-3b·H3 (R-T-3, E-6): the row moved into the matrix. The name stays in its rowheader,
  // "Week n" moved to the status line that Open board (now a link-variant Button) is described by.
  it("shows the tier name in the tier row's rowheader, the week on its status line, and Open board navigates to the board", () => {
    const { onNavigate } = renderPage();
    const row = screen.getByTestId('progress-tier-row');
    const header = within(row).getByRole('rowheader');
    expect(header).toHaveTextContent(tierName);
    expect(header).not.toHaveTextContent('Week');
    const openBoard = within(row).getByRole('button', { name: 'Open board' });
    expect(openBoard).toHaveAccessibleDescription(/Week 11/);
    fireEvent.click(openBoard);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('roster', { rview: 'board' });
  });

  it('shows no week on the tier row while the week is unknown, and the status line still reads', () => {
    seedWeek(null);
    renderPage();
    const row = screen.getByTestId('progress-tier-row');
    expect(row).not.toHaveTextContent('Week');
    // This tier has no players, so the BiS part is all there is.
    expect(within(row).getByRole('button', { name: 'Open board' })).toHaveAccessibleDescription('No BiS set');
  });

  it('a member with no farms sees the matrix holding the tier row, and no empty state', () => {
    renderPage({ userRole: 'member', canManage: false });
    const matrix = screen.getByTestId('progress-matrix');
    expect(within(matrix).getByTestId('progress-tier-row')).toBeInTheDocument();
    expect(screen.queryByTestId('members-only-card')).not.toBeInTheDocument();
    expect(screen.queryByText(/no farms|nothing yet|get started/i)).not.toBeInTheDocument();
  });

  it('puts the matrix first in the Progress content, the tier row its first body row (DOM order)', () => {
    renderPage({ userRole: null, canManage: false });
    const matrix = screen.getByTestId('progress-matrix');
    const content = matrix.parentElement!;
    expect(content.firstElementChild).toBe(matrix);
    expect(matrix.querySelector('tbody > tr')).toBe(screen.getByTestId('progress-tier-row'));
    // The members-only card is a later sibling, so "first" is not merely "only".
    expect(content.children.length).toBeGreaterThan(1);
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
