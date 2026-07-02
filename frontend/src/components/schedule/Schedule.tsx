/**
 * Schedule — the F6e Schedule screen composition (spec §5.6). This is the file
 * the v2 shell's `schedule` slot mounts (Task 9).
 *
 * Owns the screen's assembly risk: ONE fetcher topology (sessions on
 * mount/group-change; availability per scoped raid-week; cancelled exceptions
 * batched per recurring session), the shared raid-week clock scoped like Loot
 * (follows the clock until the user steps), the two-region layout, the modal
 * host (create/edit · recurring-delete choice · confirm-delete · manage
 * occurrences), and `?sessionId=` deep-link parity with legacy ScheduleTab.
 *
 * The Schedule week IS the loot week — both read `useWeekClock`, so "the same
 * week drives loot" is literal, not a slogan.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../primitives';
import { ConfirmModal, Modal, TwoRegionDashboard } from '../ui';
import { PageHeader } from '../layout/PageHeader';
import { useModal } from '../../hooks/useModal';
import { useWeekClock } from '../../hooks/useWeekClock';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { toast } from '../../stores/toastStore';
import { getTierById } from '../../gamedata';
import { computeNextOccurrence, getOccurrenceDateKey } from '../../utils/recurrence';
import {
  computeAvailabilityRecommendations,
  getNextNDates,
  getUtcDateRange,
} from './availabilityUtils';
import {
  deriveRecurringSummary,
  findNextSessionWeek,
  localSlotKeyOf,
  sessionOccurrencesInRange,
  weekOfDate,
  type SessionOccurrence,
} from './scheduleWeek';
import { WeekNavigatorStrip } from './WeekNavigatorStrip';
import { SessionList } from './SessionList';
import { AvailabilityHeatmap } from './AvailabilityHeatmap';
import { BestTimesCard } from './BestTimesCard';
import { PersonLayerEntryPoint } from './PersonLayerEntryPoint';
import { CreateSessionModal } from './CreateSessionModal';
import { OccurrenceListModal } from './OccurrenceListModal';
import type {
  AvailabilityRecommendation,
} from './availabilityUtils';
import type {
  ScheduleSession,
  ScheduleSessionCreate,
  RsvpStatus,
  StaticGroup,
  TierSnapshot,
} from '../../types';

const DAY_MS = 86_400_000;

export interface ScheduleProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  /** owner | lead | adminAccess — session CRUD + propose + occurrences. */
  canManage: boolean;
  currentUserId: string | null;
}

/** Local midnight of today — the anchor for the null-anchor rolling window. */
function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function Schedule({ group, tier, canManage, currentUserId }: ScheduleProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    sessions,
    fetchSessions,
    submitRsvp,
    createSession,
    updateSession,
    deleteSession,
    createException,
  } = useScheduleStore();
  const { data, fetchAvailability } = useAvailabilityStore();

  // ── Clock + scope (Loot pattern): follow the shared clock until the user
  // steps a week; the override is NOT URL-synced (spec §5.6). ─────────────────
  const clock = useWeekClock(group.id, tier?.tierId);
  const [scopedWeekOverride, setScopedWeekOverride] = useState<number | null>(null);
  const scopedWeek = scopedWeekOverride ?? clock.currentWeek;

  const tierLabel = tier ? getTierById(tier.tierId)?.name : undefined;

  // ── Week dates: anchored weeks use the UTC calendar dates of the range; a
  // null anchor falls back to the rolling 7-day window (spec §2.a). ───────────
  const range = clock.rangeOfWeek(scopedWeek);
  const weekDates = useMemo(
    () =>
      range
        ? Array.from({ length: 7 }, (_, i) =>
            new Date(range.start.getTime() + i * DAY_MS).toISOString().slice(0, 10),
          )
        : getNextNDates(7),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range?.start.getTime()],
  );

  // A single synthetic-vs-real range so occurrence derivation shares ONE code
  // path: the null-anchor case is just `sessionOccurrencesInRange` over a
  // today→+6d window (spec §2.a). Stable across renders (deps == weekDates key).
  const effectiveRange = useMemo(() => {
    if (range) return range;
    const start = startOfTodayLocal();
    return { start, end: new Date(start.getTime() + 6 * DAY_MS) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.start.getTime()]);

  // ── Fetch topology (spec §2.j.3) ────────────────────────────────────────────
  // NO clearSessions() anywhere: the legacy tab clears the shared store on
  // unmount, which would wipe Home's copy of the same store. Deliberately not
  // replicated — the store is shell-shared now.
  useEffect(() => {
    void fetchSessions(group.id);
  }, [group.id, fetchSessions]);

  useEffect(() => {
    const { startDate, endDate } = getUtcDateRange(weekDates);
    void fetchAvailability(group.id, startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, weekDates.join(','), fetchAvailability]);

  // ── Cancelled exceptions, batched per recurring session (plan confirmation 1).
  // `recurringKey` keeps the effect dep array honest (a stable sorted id string);
  // `getState()` inside the effect avoids depending on the whole `sessions` array.
  const [cancelledBySession, setCancelledBySession] = useState<Map<string, ReadonlySet<string>>>(
    () => new Map(),
  );
  const [exceptionsRefresh, setExceptionsRefresh] = useState(0);
  const recurringKey = useMemo(
    () => sessions.filter((s) => s.isRecurring && s.recurrenceRule).map((s) => s.id).sort().join(','),
    [sessions],
  );

  useEffect(() => {
    const ids = recurringKey ? recurringKey.split(',') : [];
    if (ids.length === 0) {
      setCancelledBySession(new Map());
      return;
    }
    let alive = true;
    void Promise.all(
      ids.map(async (id) => {
        try {
          const ex = await useScheduleStore.getState().fetchExceptions(group.id, id);
          return [id, new Set(ex.filter((e) => e.type === 'cancelled').map((e) => e.occurrenceDate))] as const;
        } catch {
          return [id, new Set<string>()] as const;
        }
      }),
    ).then((entries) => {
      if (alive) setCancelledBySession(new Map(entries));
    });
    return () => {
      alive = false;
    };
  }, [group.id, recurringKey, exceptionsRefresh]);

  // ── Derivations ─────────────────────────────────────────────────────────────
  const occurrences = useMemo(
    () => sessionOccurrencesInRange(sessions, effectiveRange, cancelledBySession),
    [sessions, effectiveRange, cancelledBySession],
  );
  const recurringSummary = useMemo(() => deriveRecurringSummary(sessions), [sessions]);
  const nextSessionHint =
    occurrences.length === 0 && range
      ? findNextSessionWeek(sessions, clock.rangeOfWeek, scopedWeek, clock.currentWeek + 12, cancelledBySession)
      : null;

  const members = useMemo(() => (group.members ?? []).filter((m) => m.role !== 'viewer'), [group.members]);
  const gridMembers = useMemo(
    () =>
      members.map((m) => ({
        userId: m.userId,
        username: m.user?.displayName ?? m.user?.discordUsername ?? null,
      })),
    [members],
  );
  const canRsvp = !!currentUserId && !!group.userRole && group.userRole !== 'viewer';

  const scheduledSlotIds = useMemo(
    () => new Set(occurrences.map((o) => localSlotKeyOf(o.occursAt))),
    [occurrences],
  );

  const [durationMinutes, setDurationMinutes] = useState(120);
  const recommendations = useMemo(
    () => computeAvailabilityRecommendations(data, members, weekDates, durationMinutes),
    [data, members, weekDates, durationMinutes],
  );

  // ── RSVP ────────────────────────────────────────────────────────────────────
  const handleRsvp = async (sessionId: string, status: RsvpStatus) => {
    try {
      await submitRsvp(group.id, sessionId, status);
    } catch {
      toast.error('Failed to save RSVP');
    }
  };

  // ── ?sessionId= deep link (legacy parity ScheduleTab.tsx:154-179) ────────────
  const handledRef = useRef<string | null>(null);
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);
  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    if (handledRef.current === sessionId) return;
    handledRef.current = sessionId;

    const instant =
      session.isRecurring && session.recurrenceRule
        ? computeNextOccurrence(
            session.startTime,
            session.recurrenceRule,
            new Date(),
            cancelledBySession.get(session.id),
            session.timezone,
          )?.toISOString() ?? session.startTime
        : session.startTime;

    const week = weekOfDate(clock.weekStartDate, instant);
    if (week != null) setScopedWeekOverride(Math.min(week, clock.currentWeek + 12));
    setHighlightedSessionId(sessionId);

    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`schedule-session-${sessionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    const clearTimer = window.setTimeout(() => setHighlightedSessionId(null), 5000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [sessions, searchParams, cancelledBySession, clock.weekStartDate, clock.currentWeek]);

  // ── Create / edit modal ─────────────────────────────────────────────────────
  const createModal = useModal();
  const [editSession, setEditSession] = useState<ScheduleSession | null>(null);
  const [createDraft, setCreateDraft] = useState<ScheduleSessionCreate | null>(null);

  const openCreate = () => {
    setEditSession(null);
    setCreateDraft(null);
    createModal.open();
  };
  const openEdit = (session: ScheduleSession) => {
    setEditSession(session);
    setCreateDraft(null);
    createModal.open();
  };
  const closeCreate = () => {
    createModal.close();
    setEditSession(null);
    setCreateDraft(null);
  };
  const handlePropose = (draft: ScheduleSessionCreate) => {
    setCreateDraft(draft);
    setEditSession(null);
    createModal.open();
  };
  const handleProposeRec = (rec: AvailabilityRecommendation) => {
    // Viewer-local one-off draft (spec §2.g). The legacy recurring /
    // reference-timezone draft is deliberately NOT reproduced.
    setCreateDraft({
      title: 'Raid session',
      description: `${rec.availableCount}/${rec.totalMembers} available in this window.`,
      startTime: rec.startIso,
      endTime: rec.endIso,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isRecurring: false,
    });
    setEditSession(null);
    createModal.open();
  };

  const handleSubmit = async (submission: ScheduleSessionCreate) => {
    try {
      if (editSession) {
        await updateSession(group.id, editSession.id, submission);
        toast.success('Session updated');
      } else {
        await createSession(group.id, submission);
        toast.success('Session created');
      }
      closeCreate();
    } catch {
      // The store rethrows; keep the modal open on failure.
      toast.error('Failed to save session');
    }
  };

  // ── Delete flow (feature-audit row 4 parity) ─────────────────────────────────
  const [deleteChoice, setDeleteChoice] = useState<SessionOccurrence | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScheduleSession | null>(null);

  const handleDelete = (occ: SessionOccurrence) => {
    if (occ.session.isRecurring) setDeleteChoice(occ);
    else setConfirmDelete(occ.session);
  };

  // v2 cancels the RENDERED occurrence (not legacy's "next occurrence") — an
  // improvement (documented in the PR body).
  const handleCancelOccurrence = async (occ: SessionOccurrence) => {
    const { session, occursAt } = occ;
    const key = getOccurrenceDateKey(occursAt, session.timezone);
    try {
      await createException(group.id, session.id, { occurrenceDate: key, type: 'cancelled' });
      toast.success('Occurrence cancelled');
      setCancelledBySession((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(session.id) ?? []);
        set.add(key);
        next.set(session.id, set);
        return next;
      });
    } catch {
      toast.error('Failed to cancel occurrence');
    } finally {
      setDeleteChoice(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteSession(group.id, confirmDelete.id);
      toast.success('Session deleted');
    } catch {
      toast.error('Failed to delete session');
    } finally {
      setConfirmDelete(null);
    }
  };

  // ── Manage occurrences ───────────────────────────────────────────────────────
  const [occurrenceSession, setOccurrenceSession] = useState<ScheduleSession | null>(null);

  return (
    <div data-testid="schedule-screen">
      <PageHeader
        icon={<Calendar size={14} className="text-accent" />}
        title="Schedule"
        subtitle="This week's sessions and when everyone's free · the same week drives loot"
      />

      <WeekNavigatorStrip
        clock={clock}
        scopedWeek={scopedWeek}
        onScopedWeekChange={setScopedWeekOverride}
        tierLabel={tierLabel}
        recurringSummary={recurringSummary}
        canManage={canManage}
        onAddSession={openCreate}
      />

      <TwoRegionDashboard
        main={
          <SessionList
            occurrences={occurrences}
            isCurrentWeek={clock.isCurrent(scopedWeek)}
            members={gridMembers}
            currentUserId={currentUserId}
            canManage={canManage}
            canRsvp={canRsvp}
            shareCode={group.shareCode}
            staticName={group.name}
            highlightedSessionId={highlightedSessionId}
            nextSessionHint={nextSessionHint}
            onJumpToWeek={(w) => setScopedWeekOverride(w)}
            onRsvp={handleRsvp}
            onEdit={openEdit}
            onDelete={handleDelete}
            onManageOccurrences={setOccurrenceSession}
            onAddSession={openCreate}
          />
        }
        side={
          <div className="grid gap-3.5">
            <AvailabilityHeatmap
              data={data}
              members={members}
              weekDates={weekDates}
              sessions={occurrences}
              canManage={canManage}
              onProposeSession={handlePropose}
            />
            <BestTimesCard
              recommendations={recommendations}
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
              scheduledSlotIds={scheduledSlotIds}
              canManage={canManage}
              onProposeSession={handleProposeRec}
            />
            <PersonLayerEntryPoint
              title="Your availability"
              description="Your typical week lives on your profile — leads pull it into this static's grid."
              actionLabel="Edit"
              onAction={() => navigate('/profile?tab=availability')}
            />
          </div>
        }
      />

      {/* CreateSessionModal inits its form state ONCE from props — mount it
          conditionally so each open path (create/edit/propose) re-seeds it. */}
      {createModal.isOpen && (
        <CreateSessionModal
          isOpen
          onClose={closeCreate}
          onSubmit={handleSubmit}
          editSession={editSession}
          initialDraft={createDraft}
        />
      )}

      {deleteChoice && (
        <Modal isOpen onClose={() => setDeleteChoice(null)} title="Delete recurring session">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              This is a recurring session. Cancel only the shown occurrence, or delete the entire series?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => handleCancelOccurrence(deleteChoice)}>
                Cancel just this occurrence
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmDelete(deleteChoice.session);
                  setDeleteChoice(null);
                }}
              >
                Delete entire series
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen
          variant="danger"
          title="Delete session"
          message={`Delete "${confirmDelete.title}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {occurrenceSession && (
        <OccurrenceListModal
          isOpen
          onClose={() => {
            setOccurrenceSession(null);
            // Re-run the exceptions effect so cancellations made in the modal
            // reflect in the scoped-week list.
            setExceptionsRefresh((n) => n + 1);
          }}
          session={occurrenceSession}
          groupId={group.id}
          canManage={canManage}
        />
      )}
    </div>
  );
}
