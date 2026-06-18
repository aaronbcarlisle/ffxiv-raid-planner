/**
 * SplitClearPlanner — unit tests
 *
 * Coverage:
 *   - Split mode off → enable CTA (editor) or hidden (viewer)
 *   - Split mode on → assistant card + board both render
 *   - Source strip shows roster/alt/priority chips when draft exists
 *   - Confidence badge renders with draft
 *   - Issue list renders no-alt summary
 *   - Apply bar shows change summary text
 *   - Warnings shown per player (desktop + mobile in JSDOM, so use getAllBy*)
 *   - Readiness summary text matches new "with alts" format
 *   - Apply draft calls updateAssignment for each player
 *   - Dismiss clears draft panel
 *   - Blur-save preserves field-level PATCH safety
 *   - Member/viewer cannot generate or apply draft
 *
 * Note: JSDOM does not apply CSS media queries, so both the desktop table
 * and mobile cards render simultaneously in tests. Use getAllBy* for content
 * that appears in both layouts; use getBy* only for content that is unique.
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

// ── Store mock ─────────────────────────────────────────────────────────────────

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

  // ── Mode / visibility ───────────────────────────────────────────────────────

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

  // ── Board / mode on ─────────────────────────────────────────────────────────

  it('renders the board and both player names when mode is on', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Aldric Stormcrest', job: 'WAR' }),
      makePlayer({ id: 'p2', name: 'Mirela Voss', job: 'WHM', sortOrder: 1 }),
    ];
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={players} canEdit={true} />
    );
    // Desktop table rendered with testid
    expect(screen.getByTestId('split-clear-board')).toBeTruthy();
    // Players appear in both desktop and mobile in JSDOM — at least one instance each
    expect(screen.getAllByText('Aldric Stormcrest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mirela Voss').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText(/no alt character/i).length).toBeGreaterThan(0);
  });

  it('shows warning when run A and run B use the same slot type', () => {
    const player = makePlayer({ id: 'p1', name: 'DualMain', job: 'DRG' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment({ runACharacter: 'main', runBCharacter: 'main' })],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getAllByText(/same character is assigned to both runs/i).length).toBeGreaterThan(0);
  });

  it('shows warning when loot target is funnel_job without a job specified', () => {
    const player = makePlayer({ id: 'p1', name: 'FunnelPlayer', job: 'RDM' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment({ lootTarget: 'funnel_job', lootTargetJob: null })],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getAllByText(/loot target job is not selected/i).length).toBeGreaterThan(0);
  });

  it('readiness summary shows alt count in "X/Y with alts" format', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'P1', sortOrder: 0 }),
      makePlayer({ id: 'p2', name: 'P2', sortOrder: 1 }),
      makePlayer({ id: 'p3', name: 'P3', sortOrder: 2 }),
    ];
    splitClearStoreState.data = {
      enabled: true,
      assignments: [
        makeAssignment({ snapshotPlayerId: 'p1', altCharacterName: 'AltOne', id: 'a1' }),
        { ...makeAssignment({ snapshotPlayerId: 'p2', id: 'a2' }), altCharacterName: null },
      ],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={players} canEdit={true} />
    );
    // The assistant card header shows "1/3 with alts"
    expect(screen.getByText(/1\/3 with alts/i)).toBeTruthy();
  });

  it('does not show the Toggle for non-editors', () => {
    splitClearStoreState.data = { enabled: false, assignments: [] };
    const { container } = render(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={false} />
    );
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

  it('shows Ready status for a fully configured assignment', () => {
    const player = makePlayer({ id: 'p1', name: 'AllGood', job: 'SCH' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment()],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    // "Ready" appears in both desktop status column and mobile card badge
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
  });

  it('renders the manual-tracking disclaimer footer', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[]} canEdit={true} />
    );
    expect(screen.getByText(/weekly clears, lockouts, and chest eligibility are manual/i)).toBeTruthy();
    expect(screen.getByText(/does not claim alt-character or lockout coverage/i)).toBeTruthy();
  });

  // ── Draft generation ─────────────────────────────────────────────────────────

  it('shows Generate draft button to editors when mode is on', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    expect(screen.getByRole('button', { name: /generate draft/i })).toBeTruthy();
  });

  it('hides Generate draft button from non-editors', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /generate draft/i })).toBeNull();
  });

  it('clicking Generate draft shows the draft panel', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    expect(screen.queryByTestId('split-clear-draft-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy();
    });
  });

  it('clicking Dismiss hides the draft panel', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('split-clear-draft-panel')).toBeNull();
    });
  });

  it('draft panel shows a Suggested badge per player', async () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Knight One', job: 'WAR' }),
      makePlayer({ id: 'p2', name: 'Knight Two', job: 'GNB', sortOrder: 1 }),
    ];
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={players} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      const badges = screen.getAllByText('Suggested');
      expect(badges).toHaveLength(2);
    });
  });

  it('clicking Apply draft calls updateAssignment for each player', async () => {
    const p = makePlayer({
      id: 'p1',
      lodestoneName: 'Kaito Nakamura',
      lodestoneServer: 'Tonberry',
    });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /apply draft/i }));
    await waitFor(() => {
      expect(splitClearStoreState.updateAssignment).toHaveBeenCalledWith(
        GROUP_ID,
        'p1',
        expect.objectContaining({ mainCharacterName: 'Kaito Nakamura' }),
      );
    });
  });

  it('Apply draft hides the draft panel after completing', async () => {
    const p = makePlayer({ id: 'p1' });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /apply draft/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('split-clear-draft-panel')).toBeNull();
    });
  });

  it('draft shows "Funnel to main" for player whose weapon is not yet received', async () => {
    const p = makePlayer({
      id: 'p1',
      job: 'DRG',
      weaponPriorities: [{ job: 'DRG', received: false }],
    });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      expect(screen.getByText(/funnel to main/i)).toBeTruthy();
    });
  });

  // ── Source strip + confidence ────────────────────────────────────────────────

  it('source strip shows Roster chip when draft exists', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      expect(screen.getByText(/roster 1\/1/i)).toBeTruthy();
    });
  });

  it('source strip shows Alts chip reflecting how many players have alts', async () => {
    const p = makePlayer({ id: 'p1' });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      // No existing alt data → "Alts 0/1"
      expect(screen.getByText(/alts 0\/1/i)).toBeTruthy();
    });
  });

  it('confidence badge renders when draft exists', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      // At least one confidence level badge must appear
      const confidence = screen.queryByText(/confidence/i);
      expect(confidence).toBeTruthy();
    });
  });

  // ── Issue list + apply bar ───────────────────────────────────────────────────

  it('issue list shows no-alt info when players lack alts', async () => {
    const p = makePlayer({ id: 'p1' });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    // "No alt character" appears in both the draft issue list and the board
    // warning column (getSplitClearWarnings treats missing assignment as no-alt),
    // so use getAllByText which returns the full set without throwing on >1 match.
    await waitFor(() => {
      expect(screen.getAllByText(/no alt character/i).length).toBeGreaterThan(0);
    });
  });

  it('apply bar shows change summary text', async () => {
    const p = makePlayer({ id: 'p1', lodestoneName: 'Main Name', lodestoneServer: 'Tonberry' });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      // Change summary should mention "Updates" and player count
      expect(screen.getByText(/updates 1 player/i)).toBeTruthy();
    });
  });

  it('button label changes to "Regenerate" after first draft', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /regenerate/i })).toBeTruthy();
    });
  });

  // ── Blur-save (PATCH safety) ─────────────────────────────────────────────────

  it('saves text fields as partial updates on blur', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [makeAssignment()] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);

    // JSDOM renders both desktop and mobile layouts; grab the first match (desktop table)
    const inputs = screen.getAllByPlaceholderText('Character name');
    const input = inputs[0];
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
