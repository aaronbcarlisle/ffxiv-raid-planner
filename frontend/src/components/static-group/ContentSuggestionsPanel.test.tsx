/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentSuggestionsPanel } from './ContentSuggestionsPanel';
import type { ContentSuggestion } from '../../stores/contentSuggestionStore';

// ─── Store mock ──────────────────────────────────────────────────────────────

const fetchSuggestions = vi.fn();
const createSuggestion = vi.fn();
const updateSuggestion = vi.fn();
const deleteSuggestion = vi.fn();
const upsertVote = vi.fn();
const deleteVote = vi.fn();
const promoteToGoal = vi.fn();

let mockSuggestions: ContentSuggestion[] = [];
let mockLoading = false;
let mockError: string | null = null;

vi.mock('../../stores/contentSuggestionStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/contentSuggestionStore')>(
    '../../stores/contentSuggestionStore'
  );
  return {
    ...actual,
    useContentSuggestionStore: () => ({
      suggestions: mockSuggestions,
      loading: mockLoading,
      error: mockError,
      fetchSuggestions,
      createSuggestion,
      updateSuggestion,
      deleteSuggestion,
      upsertVote,
      deleteVote,
      promoteToGoal,
    }),
  };
});

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const emptySummary = {
  mustHave: 0, want: 0, willing: 0, notInterested: 0, avoid: 0,
  total: 0, conflictCount: 0,
};

function makeSuggestion(overrides: Partial<ContentSuggestion> = {}): ContentSuggestion {
  return {
    id: 'sug-1',
    staticGroupId: 'group-1',
    category: 'savage_bis',
    title: 'Farm full BiS this tier',
    description: null,
    status: 'open',
    suggestedByUserId: 'user-1',
    suggestedByDisplayName: 'Warrior of Light',
    promotedGoalId: null,
    voteSummary: { ...emptySummary },
    currentUserVote: null,
    createdAt: '2026-06-13T00:00:00Z',
    updatedAt: '2026-06-13T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ContentSuggestionsPanel', () => {
  beforeEach(() => {
    mockSuggestions = [];
    mockLoading = false;
    mockError = null;
    fetchSuggestions.mockReset();
    createSuggestion.mockReset();
    updateSuggestion.mockReset();
    deleteSuggestion.mockReset();
    upsertVote.mockReset();
    deleteVote.mockReset();
    promoteToGoal.mockReset();

    // Radix UI Select (and Modal via useDevice) require window.matchMedia in jsdom
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  // ── Render basics ────────────────────────────────────────────────────────

  it('renders header and Suggest button', () => {
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText('Content Suggestions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suggest/i })).toBeInTheDocument();
  });

  it('calls fetchSuggestions on mount', () => {
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(fetchSuggestions).toHaveBeenCalledWith('group-1');
  });

  // ── Empty states ─────────────────────────────────────────────────────────

  it('shows empty state message when no open suggestions', () => {
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText(/no open suggestions/i)).toBeInTheDocument();
  });

  it('shows error when store reports one', () => {
    mockError = 'Failed to load suggestions';
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText('Failed to load suggestions')).toBeInTheDocument();
  });

  // ── Suggestion list ───────────────────────────────────────────────────────

  it('renders suggestion title and author', () => {
    mockSuggestions = [makeSuggestion()];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText('Farm full BiS this tier')).toBeInTheDocument();
    expect(screen.getByText(/Warrior of Light/)).toBeInTheDocument();
  });

  it('renders category badge', () => {
    mockSuggestions = [makeSuggestion({ category: 'ultimate_clear' })];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText('Ultimate — Clear')).toBeInTheDocument();
  });

  it('renders vote buttons for open suggestions', () => {
    mockSuggestions = [makeSuggestion()];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText('Must Have')).toBeInTheDocument();
    expect(screen.getByText('Want')).toBeInTheDocument();
    expect(screen.getByText('Willing')).toBeInTheDocument();
    expect(screen.getByText('Not Interested')).toBeInTheDocument();
    expect(screen.getByText('Avoid')).toBeInTheDocument();
  });

  it('filters promoted suggestions from the default open view', () => {
    // Default filter is 'open' — promoted suggestions should not appear at all.
    // This verifies the filter is active and non-open rows are excluded.
    mockSuggestions = [
      makeSuggestion({ id: 'open-1', title: 'Open suggestion' }),
      makeSuggestion({ id: 'promoted-1', title: 'Promoted suggestion', status: 'promoted' }),
    ];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText('Open suggestion')).toBeInTheDocument();
    expect(screen.queryByText('Promoted suggestion')).toBeNull();
    // Vote buttons appear only for the visible open suggestion
    expect(screen.getByText('Must Have')).toBeInTheDocument();
  });

  it('shows vote counts when non-zero', () => {
    mockSuggestions = [
      makeSuggestion({
        voteSummary: { ...emptySummary, mustHave: 3, total: 3 },
      }),
    ];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText(/3 votes/i)).toBeInTheDocument();
  });

  it('shows conflict indicator when present', () => {
    mockSuggestions = [
      makeSuggestion({
        voteSummary: { ...emptySummary, avoid: 2, conflictCount: 2, total: 2 },
      }),
    ];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText(/2 conflicts/i)).toBeInTheDocument();
  });

  // ── Management actions — only visible to canManage=true ──────────────────

  it('does not show manage actions for regular members', () => {
    mockSuggestions = [makeSuggestion()];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.queryByLabelText('Close suggestion')).toBeNull();
    expect(screen.queryByLabelText('Delete suggestion')).toBeNull();
    expect(screen.queryByLabelText('Promote to goal')).toBeNull();
  });

  it('shows close and promote buttons for leads on open suggestions', () => {
    mockSuggestions = [makeSuggestion()];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={true} />);
    expect(screen.getByLabelText('Close suggestion')).toBeInTheDocument();
    expect(screen.getByLabelText('Promote to goal')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete suggestion')).toBeInTheDocument();
  });

  it('does not show close/promote buttons on open suggestions for non-managers', () => {
    // canManage=false → management actions hidden regardless of status
    mockSuggestions = [makeSuggestion()];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.queryByLabelText('Close suggestion')).toBeNull();
    expect(screen.queryByLabelText('Promote to goal')).toBeNull();
    expect(screen.queryByLabelText('Delete suggestion')).toBeNull();
  });

  // ── Suggest modal trigger ────────────────────────────────────────────────

  it('opens SuggestContentModal when Suggest button is clicked', () => {
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    fireEvent.click(screen.getByRole('button', { name: /suggest/i }));
    expect(screen.getByText('Suggest Content')).toBeInTheDocument();
  });

  // ── Status filter ────────────────────────────────────────────────────────

  it('shows only matching-status suggestions', () => {
    mockSuggestions = [
      makeSuggestion({ id: 'sug-open', title: 'Open suggestion', status: 'open' }),
      makeSuggestion({ id: 'sug-closed', title: 'Closed suggestion', status: 'closed' }),
    ];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    // Default filter is 'open'
    expect(screen.getByText('Open suggestion')).toBeInTheDocument();
    expect(screen.queryByText('Closed suggestion')).toBeNull();
  });

  // ── Description expand ───────────────────────────────────────────────────

  it('shows expand button when description exists', () => {
    mockSuggestions = [makeSuggestion({ description: 'This would help us clear faster.' })];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByLabelText('Expand details')).toBeInTheDocument();
  });

  it('does not show expand button without description', () => {
    mockSuggestions = [makeSuggestion({ description: null })];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.queryByLabelText('Expand details')).toBeNull();
  });

  it('reveals description after clicking expand', () => {
    mockSuggestions = [makeSuggestion({ description: 'This would help us clear faster.' })];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    fireEvent.click(screen.getByLabelText('Expand details'));
    expect(screen.getByText('This would help us clear faster.')).toBeInTheDocument();
  });

  // ── Multiple suggestions ─────────────────────────────────────────────────

  it('renders all visible suggestions', () => {
    mockSuggestions = [
      makeSuggestion({ id: 'sug-1', title: 'Farm BiS' }),
      makeSuggestion({ id: 'sug-2', title: 'Clear TOP' }),
    ];
    render(<ContentSuggestionsPanel groupId="group-1" canManage={false} />);
    expect(screen.getByText('Farm BiS')).toBeInTheDocument();
    expect(screen.getByText('Clear TOP')).toBeInTheDocument();
  });
});
