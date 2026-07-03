// `@testing-library/user-event` is not a dependency of this project — every
// existing test in this codebase drives interactions via `fireEvent` (see
// `components/loot/WeekScopeControl.test.tsx`), so we follow that
// established convention here. Radix menu items render via a portal, so
// assertions query `screen` directly rather than scoping to a row container.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionList, type SessionListProps } from './SessionList';
import { useToastStore } from '../../stores/toastStore';
import type { SessionOccurrence } from './scheduleWeek';
import type { ScheduleSession } from '../../types';

function makeSession(overrides: Partial<ScheduleSession> = {}): ScheduleSession {
  return {
    id: 's1', staticGroupId: 'g1', createdById: 'u1', title: 'Raid',
    description: null, startTime: '2026-07-07T20:00:00.000Z', endTime: '2026-07-07T22:30:00.000Z',
    timezone: 'UTC', isRecurring: false, recurrenceRule: null,
    category: 'raid', contentId: null, contentName: null, bannerUrl: null,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', rsvps: [],
    ...overrides,
  } as ScheduleSession;
}

function occ(session: ScheduleSession, occursAt: string = session.startTime): SessionOccurrence {
  return { session, occursAt };
}

function renderList(overrides: Partial<SessionListProps> = {}) {
  const props: SessionListProps = {
    occurrences: [],
    isCurrentWeek: true,
    members: [],
    currentUserId: null,
    canManage: false,
    canRsvp: false,
    shareCode: 'SHARE1',
    staticName: 'Test Static',
    highlightedSessionId: null,
    nextSessionHint: null,
    onJumpToWeek: vi.fn(),
    onRsvp: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onManageOccurrences: vi.fn(),
    onAddSession: vi.fn(),
    ...overrides,
  };
  return render(<SessionList {...props} />);
}

function openKebab() {
  // Radix DropdownMenu trigger — driven via keyDown per established convention
  // (see WeekScopeControl.test.tsx / LootEntryRow.test.tsx); a plain click
  // does not flip the trigger's data-state in jsdom, so keyDown Enter is used
  // to open the menu; item selection itself is still driven via fireEvent.click.
  fireEvent.keyDown(screen.getByRole('button', { name: 'Session actions' }), { key: 'Enter' });
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  useToastStore.setState({ toasts: [] });
  vi.useRealTimers();
});

describe('SessionList', () => {
  it('promotes the first upcoming occurrence in the current week to "Next session"; later occurrences show their own title', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T00:00:00.000Z'));
    const s1 = makeSession({
      id: 's1', title: 'First Session',
      startTime: '2026-07-07T20:00:00.000Z', endTime: '2026-07-07T22:00:00.000Z',
    });
    const s2 = makeSession({
      id: 's2', title: 'Second Session',
      startTime: '2026-07-08T20:00:00.000Z', endTime: '2026-07-08T22:00:00.000Z',
    });
    renderList({ occurrences: [occ(s1), occ(s2)], isCurrentWeek: true });
    expect(screen.getByText('Next session')).toBeInTheDocument();
    expect(screen.getByText('Second Session')).toBeInTheDocument();
    expect(screen.queryByText('First Session')).not.toBeInTheDocument();
  });

  it('renders no "Next session" title anywhere when isCurrentWeek is false', () => {
    const s1 = makeSession({ id: 's1', title: 'First Session' });
    const s2 = makeSession({ id: 's2', title: 'Second Session' });
    renderList({ occurrences: [occ(s1), occ(s2)], isCurrentWeek: false });
    expect(screen.queryByText('Next session')).not.toBeInTheDocument();
    expect(screen.getByText('First Session')).toBeInTheDocument();
    expect(screen.getByText('Second Session')).toBeInTheDocument();
  });

  it('displays the occurrence date, not the base session start, for a recurring occurrence', () => {
    const session = makeSession({
      id: 'rec1', title: 'Recurring Raid', isRecurring: true,
      startTime: '2026-06-02T20:00:00.000Z', endTime: '2026-06-02T22:00:00.000Z', timezone: 'UTC',
    });
    renderList({ occurrences: [occ(session, '2026-07-07T20:00:00.000Z')], isCurrentWeek: false });
    const dayTime = screen.getByTestId('session-daytime').textContent ?? '';
    expect(dayTime).toMatch(/Jul 7/);
    expect(dayTime).not.toMatch(/Jun 2/);
  });

  it('applies highlight-pulse to the wrapper matching highlightedSessionId, at the schedule-session-{id} anchor', () => {
    const session = makeSession({ id: 'hl1' });
    renderList({ occurrences: [occ(session)], highlightedSessionId: 'hl1' });
    const wrapper = document.getElementById('schedule-session-hl1');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('highlight-pulse');
  });

  it('does not apply highlight-pulse when highlightedSessionId does not match', () => {
    const session = makeSession({ id: 'hl1' });
    renderList({ occurrences: [occ(session)], highlightedSessionId: 'other' });
    expect(document.getElementById('schedule-session-hl1')).not.toHaveClass('highlight-pulse');
  });

  it('assigns the schedule-session-{id} anchor to only the EARLIEST occurrence of a recurring session with multiple BYDAY days in the same week', () => {
    // A single session rendering twice in one scoped week (e.g. BYDAY=MO,WE)
    // must not produce two elements sharing the same DOM id.
    const session = makeSession({ id: 'rec', title: 'Recurring Raid', isRecurring: true });
    const earlier = occ(session, '2026-07-06T20:00:00.000Z');
    const later = occ(session, '2026-07-08T20:00:00.000Z');
    renderList({ occurrences: [earlier, later], isCurrentWeek: false });

    const matches = document.querySelectorAll('[id="schedule-session-rec"]');
    expect(matches.length).toBe(1);
    // The anchored element wraps the earliest occurrence's card, not the later one.
    expect(matches[0].textContent).toMatch(/Jul 6/);
  });

  it('restricts highlight-pulse to the anchored (first) occurrence when a session renders more than once', () => {
    const session = makeSession({ id: 'rec', isRecurring: true });
    const earlier = occ(session, '2026-07-06T20:00:00.000Z');
    const later = occ(session, '2026-07-08T20:00:00.000Z');
    renderList({ occurrences: [earlier, later], isCurrentWeek: false, highlightedSessionId: 'rec' });

    const highlighted = document.querySelectorAll('.highlight-pulse');
    expect(highlighted.length).toBe(1);
    expect(highlighted[0].id).toBe('schedule-session-rec');
  });

  it('kebab: Edit fires onEdit(session), and Manage occurrences shows only for recurring + canManage', async () => {
    const onEdit = vi.fn();
    const session = makeSession({ id: 's1', isRecurring: true });
    renderList({ occurrences: [occ(session)], canManage: true, onEdit });
    openKebab();
    expect(await screen.findByRole('menuitem', { name: 'Manage occurrences' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(session);
  });

  it('kebab: hides Manage occurrences for a non-recurring session even when canManage', async () => {
    const session = makeSession({ id: 's1', isRecurring: false });
    renderList({ occurrences: [occ(session)], canManage: true });
    openKebab();
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Manage occurrences' })).not.toBeInTheDocument();
  });

  it('kebab: Delete fires onDelete(occ)', async () => {
    const onDelete = vi.fn();
    const session = makeSession({ id: 's1' });
    const occurrence = occ(session);
    renderList({ occurrences: [occurrence], canManage: true, onDelete });
    openKebab();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(occurrence);
  });

  it('kebab: canManage=false hides Edit/Delete but keeps Share and Copy for Discord', async () => {
    const session = makeSession({ id: 's1' });
    renderList({ occurrences: [occ(session)], canManage: false });
    openKebab();
    expect(await screen.findByRole('menuitem', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy for Discord' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('Copy for Discord writes markdown containing the title and the schedule link', async () => {
    const session = makeSession({ id: 'sess-9', title: 'Raid' });
    renderList({ occurrences: [occ(session)], shareCode: 'SHARE1' });
    openKebab();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy for Discord' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(text).toContain('**Raid**');
    expect(text).toContain('?tab=schedule&sessionId=sess-9');
  });

  it('Share falls back to clipboard (no navigator.share in jsdom), including the link', async () => {
    const session = makeSession({ id: 'sess-5' });
    renderList({ occurrences: [occ(session)], shareCode: 'SHARE1' });
    openKebab();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(text).toContain('?tab=schedule&sessionId=sess-5');
  });

  it('Share: a rejected clipboard write shows an error toast and no success toast', async () => {
    // F6d copyLink precedent (Loot.test.tsx): a rejecting clipboard must NOT
    // fire the success toast nor escape as an unhandled rejection.
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const session = makeSession({ id: 'sess-5' });
    renderList({ occurrences: [occ(session)] });
    openKebab();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && t.message === 'Failed to copy')).toBe(true);
    });
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(false);
  });

  it('Copy for Discord: a rejected clipboard write shows an error toast and no success toast', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const session = makeSession({ id: 'sess-9' });
    renderList({ occurrences: [occ(session)] });
    openKebab();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy for Discord' }));
    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && t.message === 'Failed to copy Discord message')).toBe(true);
    });
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(false);
  });

  it('renders the empty-state invite and fires onJumpToWeek from the next-session hint button', () => {
    const onJumpToWeek = vi.fn();
    const onAddSession = vi.fn();
    renderList({
      occurrences: [],
      canManage: true,
      onAddSession,
      onJumpToWeek,
      nextSessionHint: { week: 3, occursAt: '2026-07-14T20:00:00.000Z' },
    });
    expect(screen.getByText('No sessions this week')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add session' })).toBeInTheDocument();
    const hintButton = screen.getByRole('button', { name: /Week 3/ });
    fireEvent.click(hintButton);
    expect(onJumpToWeek).toHaveBeenCalledWith(3);
  });

  it('empty state: no "Add session" action and a member-facing description when canManage is false', () => {
    renderList({ occurrences: [], canManage: false });
    expect(screen.queryByRole('button', { name: 'Add session' })).not.toBeInTheDocument();
    expect(screen.getByText(/appear here to RSVP/)).toBeInTheDocument();
  });

  it('omits the RSVP button strip for a viewer (members provided, canRsvp=false)', () => {
    const session = makeSession({ id: 's1' });
    renderList({
      occurrences: [occ(session)],
      members: [{ userId: 'u1', username: 'Alice' }],
      canRsvp: false,
    });
    expect(screen.queryByRole('button', { name: /i'm in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tentative/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /can't make it/i })).not.toBeInTheDocument();
  });
});
