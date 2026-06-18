/**
 * SplitClearPlanner — unit tests
 *
 * State model:
 *   State 1 — Empty/Compose: mode on, no draft, no saved assignments
 *   State 2 — Draft Review:  draft exists (board hidden)
 *   State 3 — Manage Mode:   board shown (after Apply or "Start manually")
 *
 * Note: JSDOM does not apply CSS media queries. Both the hidden sm:block desktop
 * table and sm:hidden mobile cards render simultaneously. Use getAllBy* for any
 * content that appears in both layouts; getBy* only for unique content.
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

  // ── State 1 — Empty / Compose ───────────────────────────────────────────────

  it('shows the Split Clear Composer empty state when mode is on with no saved assignments', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />
    );
    // Header + empty state card both say "Split Clear Composer" — check for >0 matches
    expect(screen.getAllByText(/split clear composer/i).length).toBeGreaterThan(0);
    // Subtitle is unique to the empty state card
    expect(screen.getByText(/plan main\/alt runs/i)).toBeTruthy();
  });

  it('empty state shows Generate draft and Start manually buttons', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    expect(screen.getByRole('button', { name: /generate draft/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /start manually/i })).toBeTruthy();
  });

  it('empty state does not show the assignment board', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    expect(screen.queryByTestId('split-clear-board')).toBeNull();
  });

  it('Start manually opens the assignment board', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /start manually/i }));
    await waitFor(() => {
      expect(screen.getByTestId('split-clear-board')).toBeTruthy();
    });
  });

  // ── State 2 — Draft Review ──────────────────────────────────────────────────

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

  it('draft review shows Run A and Run B panels', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /run a panel/i })).toBeTruthy();
      expect(screen.getByRole('region', { name: /run b panel/i })).toBeTruthy();
    });
  });

  it('draft review does not show the manual board simultaneously', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    expect(screen.queryByTestId('split-clear-board')).toBeNull();
  });

  it('confidence badge shows amber/warning label (not red) when data is incomplete', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      // With no alts and no priority data the confidence is 'low' → "Needs review"
      expect(screen.getByText(/needs review/i)).toBeTruthy();
    });
  });

  it('clicking Dismiss hides the draft panel', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    // Use the Dismiss button in the apply bar (not the X close button)
    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('split-clear-draft-panel')).toBeNull();
    });
  });

  it('Dismiss with no saved assignments returns to empty state', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
    await waitFor(() => {
      // Subtitle text is unique to the empty state card (not in the header)
      expect(screen.getByText(/plan main\/alt runs/i)).toBeTruthy();
    });
  });

  it('Regenerate replaces draft with a fresh one', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    // Regenerate button is inside the draft review apply bar
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    await waitFor(() => {
      // Draft panel should still be visible (replaced, not dismissed)
      expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy();
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
      // "Needs review" (low) or "Medium confidence" / "High confidence"
      const el = screen.queryByText(/needs review|confidence/i);
      expect(el).toBeTruthy();
    });
  });

  // ── Issue summary ────────────────────────────────────────────────────────────

  it('issue list shows no-alt info when players lack alts', async () => {
    const p = makePlayer({ id: 'p1' });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      // "No Run B character" appears in the issue summary list
      expect(screen.getByText(/no run b character/i)).toBeTruthy();
    });
  });

  it('apply bar shows change summary text', async () => {
    const p = makePlayer({ id: 'p1', lodestoneName: 'Main Name', lodestoneServer: 'Tonberry' });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      expect(screen.getByText(/updates 1 player/i)).toBeTruthy();
    });
  });

  it('apply bar shows overwrite warning when existing assignments would be changed', async () => {
    const p = makePlayer({ id: 'p1', lodestoneName: 'Lodestone Name', lodestoneServer: 'Tonberry' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment({ mainCharacterName: 'OldName' })],
    };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => {
      expect(screen.getByText(/existing manual edits will be overwritten/i)).toBeTruthy();
    });
  });

  // ── Apply draft ──────────────────────────────────────────────────────────────

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

  it('Apply draft opens the assignment board after completing', async () => {
    const p = makePlayer({ id: 'p1' });
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[p]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByTestId('split-clear-draft-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /apply draft/i }));
    await waitFor(() => {
      expect(screen.getByTestId('split-clear-board')).toBeTruthy();
    });
  });

  // ── State 3 — Manage Mode ───────────────────────────────────────────────────

  it('renders the assignment board when saved assignments exist', () => {
    const player = makePlayer({ id: 'p1', name: 'Aldric Stormcrest', job: 'WAR' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment()],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getByTestId('split-clear-board')).toBeTruthy();
    // Player appears in both desktop table and mobile card in JSDOM
    expect(screen.getAllByText('Aldric Stormcrest').length).toBeGreaterThan(0);
  });

  it('renders two player names in the board when both have saved assignments', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Aldric Stormcrest', job: 'WAR' }),
      makePlayer({ id: 'p2', name: 'Mirela Voss', job: 'WHM', sortOrder: 1 }),
    ];
    splitClearStoreState.data = {
      enabled: true,
      assignments: [
        makeAssignment({ snapshotPlayerId: 'p1', id: 'a1' }),
        makeAssignment({ snapshotPlayerId: 'p2', id: 'a2' }),
      ],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={players} canEdit={true} />
    );
    expect(screen.getAllByText('Aldric Stormcrest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mirela Voss').length).toBeGreaterThan(0);
  });

  it('shows compact warning chips when player has no alt character', () => {
    const player = makePlayer({ id: 'p1', name: 'TankPlayer', job: 'GNB' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment({ altCharacterName: null, altCharacterWorld: null })],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    // Compact chip label "No alt" (full text in aria-label)
    expect(screen.getAllByText('No alt').length).toBeGreaterThan(0);
  });

  it('shows warning chip when run A and run B use the same slot type', () => {
    const player = makePlayer({ id: 'p1', name: 'DualMain', job: 'DRG' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment({ runACharacter: 'main', runBCharacter: 'main' })],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    // Compact chip label "Duplicate"
    expect(screen.getAllByText('Duplicate').length).toBeGreaterThan(0);
  });

  it('shows warning chip when loot target is funnel_job without a job specified', () => {
    const player = makePlayer({ id: 'p1', name: 'FunnelPlayer', job: 'RDM' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment({ lootTarget: 'funnel_job', lootTargetJob: null })],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getAllByText('No loot job').length).toBeGreaterThan(0);
  });

  it('shows Ready chip for a fully configured assignment', () => {
    const player = makePlayer({ id: 'p1', name: 'AllGood', job: 'SCH' });
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment()],
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[player]} canEdit={true} />
    );
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
  });

  it('renders the manual-tracking disclaimer footer when board is shown', () => {
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment()], // has assignments → board auto-shows
    };
    render(
      <SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />
    );
    expect(screen.getByText(/weekly clears, lockouts, and chest eligibility are manual/i)).toBeTruthy();
    expect(screen.getByText(/does not claim alt-character or lockout coverage/i)).toBeTruthy();
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
    expect(screen.getByText(/1\/3 with alts/i)).toBeTruthy();
  });

  it('Generate draft button appears in header when manage board is shown', async () => {
    splitClearStoreState.data = {
      enabled: true,
      assignments: [makeAssignment()], // board auto-shows
    };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);
    // Board is shown, Generate draft should appear in header
    expect(screen.getByRole('button', { name: /generate draft/i })).toBeTruthy();
  });

  // ── Blur-save (PATCH safety) ─────────────────────────────────────────────────

  it('saves text fields as partial updates on blur', async () => {
    splitClearStoreState.data = { enabled: true, assignments: [makeAssignment()] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={true} />);

    // JSDOM renders both desktop and mobile; grab the first input (desktop table)
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

  it('member/viewer cannot generate or apply draft', () => {
    splitClearStoreState.data = { enabled: true, assignments: [] };
    render(<SplitClearPlanner groupId={GROUP_ID} players={[makePlayer()]} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /generate draft/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /start manually/i })).toBeNull();
  });
});
