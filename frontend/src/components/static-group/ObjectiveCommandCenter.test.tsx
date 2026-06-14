/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObjectiveCommandCenter } from './ObjectiveCommandCenter';
import type { ObjectiveCommandCard } from '../../stores/objectiveCommandStore';

// ─── Store mock ───────────────────────────────────────────────────────────────

const fetchCards = vi.fn();

let mockCards: ObjectiveCommandCard[] = [];
let mockLoading = false;
let mockError: string | null = null;

vi.mock('../../stores/objectiveCommandStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/objectiveCommandStore')>(
    '../../stores/objectiveCommandStore'
  );
  return {
    ...actual,
    useObjectiveCommandStore: () => ({
      cards: mockCards,
      loading: mockLoading,
      error: mockError,
      fetchCards,
    }),
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<ObjectiveCommandCard> = {}): ObjectiveCommandCard {
  return {
    id: 'obj-1',
    title: 'Clear DSR',
    category: 'ultimate_clear',
    priority: 'required',
    rosterReadiness: { ready: 8, total: 8 },
    goalAlignment: { aligned: 5, partial: 2, conflicts: 0 },
    bisReadiness: null,
    linkedCollectionGoal: null,
    nextSession: {
      id: 'sess-1',
      date: '2026-06-20T18:00:00Z',
      title: 'Prog Night',
    },
    nextAction: 'Ready for next raid',
    nextActionTarget: null,
    ...overrides,
  };
}

const onNavigate = vi.fn();

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ObjectiveCommandCenter', () => {
  beforeEach(() => {
    mockCards = [];
    mockLoading = false;
    mockError = null;
    fetchCards.mockClear();
    onNavigate.mockClear();
  });

  it('calls fetchCards on mount when isMember is true', () => {
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(fetchCards).toHaveBeenCalledWith('group-1');
  });

  it('does not call fetchCards when isMember is false', () => {
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember={false}
        onNavigate={onNavigate}
      />,
    );
    expect(fetchCards).not.toHaveBeenCalled();
  });

  it('renders empty state when no cards', () => {
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByTestId('objective-command-empty')).toBeDefined();
    expect(screen.getByText('No objectives set')).toBeDefined();
  });

  it('renders cards when data is available', () => {
    mockCards = [makeCard({ title: 'Clear The Epic of Alexander' })];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByTestId('objective-command-cards')).toBeDefined();
    expect(screen.getByText('Clear The Epic of Alexander')).toBeDefined();
  });

  it('shows priority badge and category chip', () => {
    mockCards = [makeCard({ priority: 'required', category: 'ultimate_clear' })];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText('Required')).toBeDefined();
    expect(screen.getByText('Ultimate — Clear')).toBeDefined();
  });

  it('shows next session when present', () => {
    mockCards = [
      makeCard({
        nextSession: { id: 's1', date: '2026-06-20T18:00:00Z', title: 'Friday Prog' },
      }),
    ];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText(/Friday Prog/)).toBeDefined();
  });

  it('shows "No session scheduled" when nextSession is null', () => {
    mockCards = [makeCard({ nextSession: null, nextAction: 'Schedule session', nextActionTarget: 'schedule' })];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText('No session scheduled')).toBeDefined();
  });

  it('hides BiS row when bisReadiness is null', () => {
    mockCards = [makeCard({ bisReadiness: null })];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    // BiS row should not appear
    expect(screen.queryByText(/BiS/)).toBeNull();
  });

  it('shows BiS readiness when public targets exist', () => {
    mockCards = [makeCard({ bisReadiness: { ready: 6, missing: 2 } })];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText(/BiS/)).toBeDefined();
    expect(screen.getByText('6/8')).toBeDefined();
  });

  it('shows CTA button when nextActionTarget is set', () => {
    mockCards = [
      makeCard({ nextAction: 'Schedule session', nextActionTarget: 'schedule' }),
    ];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText('Go')).toBeDefined();
    expect(screen.getByText('Schedule session')).toBeDefined();
  });

  it('hides CTA button when nextActionTarget is null (ready)', () => {
    mockCards = [makeCard({ nextAction: 'Ready for next raid', nextActionTarget: null })];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.queryByText('Go')).toBeNull();
    expect(screen.getByText('Ready for next raid')).toBeDefined();
  });

  it('renders loading skeleton when loading with no cards', () => {
    mockLoading = true;
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByTestId('objective-command-loading')).toBeDefined();
  });

  it('renders multiple cards', () => {
    mockCards = [
      makeCard({ id: 'obj-1', title: 'Clear TEA' }),
      makeCard({ id: 'obj-2', title: 'Farm Mount', category: 'savage_mount', priority: 'preferred' }),
    ];
    render(
      <ObjectiveCommandCenter
        groupId="group-1"
        isMember
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText('Clear TEA')).toBeDefined();
    expect(screen.getByText('Farm Mount')).toBeDefined();
  });
});
