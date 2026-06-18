/**
 * SplitClearPlanner — unit tests
 *
 * Verifies:
 *   - Split mode off → disabled empty-state message rendered, no table
 *   - Split mode on → table rendered with all players
 *   - No alt character → warning shown
 *   - Run A and Run B same slot → warning shown
 *   - Overview/header summary counts alts correctly
 *   - Non-editor sees no Toggle (permission guard)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SplitClearPlanner } from './SplitClearPlanner';
import type { SnapshotPlayer } from '../../types';
import type { SplitClearData } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Warrior Main',
    job: 'WAR',
    role: 'tank',
    position: 'T1',
    configured: true,
    sortOrder: 0,
    gear: [],
    tomeWeapon: { hasTomeWeapon: false, isAugmented: false },
    weaponPriorities: [],
    isSubstitute: false,
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    snapshotPlayerId: 'p1',
    mainCharacterName: 'WarriorMain',
    mainCharacterWorld: 'Tonberry',
    altCharacterName: 'WarriorAlt',
    altCharacterWorld: 'Tonberry',
    runACharacter: 'main' as const,
    runBCharacter: 'alt' as const,
    lootTarget: 'normal' as const,
    lootTargetJob: null,
    runACleared: false,
    runBCleared: false,
    notes: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Store mock state ───────────────────────────────────────────────────────────

const splitClearStoreState: {
  data: SplitClearData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchData: ReturnType<typeof vi.fn>;
  toggleMode: ReturnType<typeof vi.fn>;
  updateAssignment: ReturnType<typeof vi.fn>;
  resetWeek: ReturnType<typeof vi.fn>;
  clearData: ReturnType<typeof vi.fn>;
} = {
  data: null,
  isLoading: false,
  isSaving: false,
  error: null,
  fetchData: vi.fn(),
  toggleMode: vi.fn(),
  updateAssignment: vi.fn(),
  resetWeek: vi.fn(),
  clearData: vi.fn(),
};

vi.mock('../../stores/splitClearStore', () => ({
  useSplitClearStore: () => splitClearStoreState,
}));

vi.mock('../ui/JobIcon', () => ({ JobIcon: () => null }));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SplitClearPlanner', () => {
  const GROUP_ID = 'g1';

  beforeEach(() => {
    vi.clearAllMocks();
    splitClearStoreState.data = null;
    splitClearStoreState.isLoading = false;
    splitClearStoreState.isSaving = false;
    splitClearStoreState.error = null;
    splitClearStoreState.updateAssignment.mockResolvedValue(undefined);
    splitClearStoreState.toggleMode.mockResolvedValue(undefined);
    splitClearStoreState.resetWeek.mockResolvedValue(undefined);
  });

  it('renders nothing when data is null', () => {
    splitClearStoreState.data = null;
    const { container } = render(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows a compact enable action to editors when split mode is off', () => {
    splitClearStoreState.data = { enabled: false, assignments: [] };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />
    );
    expect(screen.getByText(/optional main\/alt planning/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /enable split planning/i })).toBeTruthy();
    expect(screen.queryByTestId('split-clear-board')).toBeNull();
  });

  it('stays hidden for non-editors when split mode is off', () => {
    splitClearStoreState.data = { enabled: false, assignments: [] };
    const { container } = render(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the table with all players when mode is on', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Aldric Stormcrest', job: 'WAR' }),
      makePlayer({ id: 'p2', name: 'Mirela Voss', job: 'WHM', sortOrder: 1 }),
    ];
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={players} canEdit={true} />
    );
    expect(screen.getByTestId('split-clear-board')).toBeTruthy();
    expect(screen.getByText('Aldric Stormcrest')).toBeTruthy();
    expect(screen.getByText('Mirela Voss')).toBeTruthy();
  });

  it('shows warning when player has no alt character', () => {
    const player = makePlayer({ id: 'p1', name: 'TankPlayer', job: 'GNB' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment({ altCharacterName: null, altCharacterWorld: null })],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getByText(/no alt character/i)).toBeTruthy();
  });

  it('shows warning when run A and run B use the same slot type', () => {
    const player = makePlayer({ id: 'p1', name: 'DualMain', job: 'DRG' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [
        makeAssignment({
          runACharacter: 'main',
          runBCharacter: 'main',
        }),
      ],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getByText(/same character is assigned to both runs/i)).toBeTruthy();
  });

  it('shows warning when loot target is funnel_job without a job specified', () => {
    const player = makePlayer({ id: 'p1', name: 'FunnelPlayer', job: 'RDM' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [
        makeAssignment({
          lootTarget: 'funnel_job',
          lootTargetJob: null,
        }),
      ],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getByText(/loot target job is not selected/i)).toBeTruthy();
  });

  it('summary counts alts assigned correctly', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'P1', sortOrder: 0 }),
      makePlayer({ id: 'p2', name: 'P2', sortOrder: 1 }),
      makePlayer({ id: 'p3', name: 'P3', sortOrder: 2 }),
    ];
    splitClearStoreState.data = {
      enabled: true,
      assignments: [
        makeAssignment({ snapshotPlayerId: 'p1', altCharacterName: 'AltOne', id: 'a1' }),
        // p2 has assignment but no alt
        { ...makeAssignment({ snapshotPlayerId: 'p2', id: 'a2' }), altCharacterName: null },
        // p3 has no assignment at all
      ],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={players} canEdit={true} />
    );
    // 1 out of 3 have alts
    expect(screen.getByText(/1\/3 members have alts assigned/i)).toBeTruthy();
  });

  it('does not show the Toggle for non-editors', () => {
    splitClearStoreState.data = { enabled: false, assignments: [] };
    const { container } = render(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={false} />
    );
    // The Toggle is rendered inside a "Split mode" label wrapper — check it's absent
    expect(container.querySelector('[aria-label="split mode"]')).toBeNull();
    const allText = container.textContent ?? '';
    expect(allText).not.toMatch(/split mode/i);
  });

  it('shows Reset Week button only to editors when mode is on', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };

    const { rerender } = render(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={true} />
    );
    expect(screen.getByText(/reset week/i)).toBeTruthy();

    rerender(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={false} />
    );
    expect(screen.queryByText(/reset week/i)).toBeNull();
  });

  it('renders "OK" status for fully configured assignment', () => {
    const player = makePlayer({ id: 'p1', name: 'AllGood', job: 'SCH' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment()],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('renders the manual-tracking disclaimer footer', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={true} />
    );
    expect(screen.getByText(/weekly clears, lockouts, and chest eligibility are manual/i)).toBeTruthy();
    expect(screen.getByText(/does not claim alt-character or lockout coverage/i)).toBeTruthy();
  });

  it('saves text fields as partial updates on blur', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [makeAssignment()] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);

    const input = screen.getByPlaceholderText('Character name');
    fireEvent.change(input, { target: { value: 'Updated Main' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(splitClearStoreState.updateAssignment).toHaveBeenCalledWith(
        GROUP_ID,
        'p1',
        { mainCharacterName: 'Updated Main' },
      );
    });
  });
});
