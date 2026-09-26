/**
 * Home (ring0 `home/`) — the redesigned weekly-loop dashboard.
 *
 * The F6b assembly, R-E2-G revised: a "This week" page header (dynamic
 * subtitle) and ONE grid — a 3-card hero row (next session + RSVP · this
 * week's loot · roster readiness) over a second row where the actionable
 * stack (Needs your attention + BiS-by-role + Team Summary) spans the first
 * two columns and the ambient stack (loot fairness + recent activity + a
 * display-only Track card) is the third. Wired in as the `overview` slot on
 * `GroupViewContent` (see NewShell).
 *
 * Boundary discipline (ring0): composes `home/` siblings + `loot/`'s
 * `FairnessSummary` (D14, R-40 — its one reuse outside `loot/`) + shared `ui/`
 * components + the existing shell `PageHeader`, and reads STORES directly for
 * the data the legacy prop contract never carried (schedule / loot / join
 * requests / mount farm / auth / static-character). It NEVER imports a ring1
 * (`schedule`/`split-clear`) or ring3 (`mount-farms`/`collections`) component —
 * the mount data comes from `mountFarmStore` (a store), never
 * `components/mount-farms/*`.
 *
 * Fetch-on-mount mirrors `StaticHomeTab`'s membership-gated effect: members get
 * sessions/loot/progress/page+material balances; group-requests fetch only when
 * `canManage` (so applicants/non-members never trigger a 403); registrations
 * fetch for any member (not tier-gated) to feed Team Summary's role chips.
 * D14 (R-D14-C): fairness renders for ANYONE who can view (Home only mounts
 * for someone who already has view access, member or not), so a NON-member
 * branch fetches the loot log, page ledger and material log read-only,
 * mirroring Loot's own unconditional mount-fetch (`Loot.tsx:641-643`) —
 * balances, registrations and `TeamSummaryCard` stay member-only.
 */

import { useEffect, useMemo } from 'react';
import { AlertTriangle, CalendarPlus, Inbox, Scale, UserPlus } from 'lucide-react';
import type { PageMode, RsvpStatus, StaticGroup, TierSnapshot } from '../../types';

import { PageHeader } from '../layout/PageHeader';
import { CardShell } from '../ui/CardShell';
import { AttentionRow } from '../ui/AttentionRow';
import { SessionRsvpCard } from '../ui/SessionRsvpCard';
import { EmptyStateInvite } from '../ui/EmptyStateInvite';
import { Tag } from '../ui/Tag';

import { WeeklyLootSummaryCard } from './WeeklyLootSummaryCard';
import { RosterReadinessCard } from './RosterReadinessCard';
import { RoleBisCard } from './RoleBisCard';
import { TeamSummaryCard } from './TeamSummaryCard';
import { StaticActivityFeed } from './StaticActivityFeed';
import { TrackCard } from './TrackCard';
import { FairnessSummary } from '../loot/FairnessSummary';

import { useScheduleStore } from '../../stores/scheduleStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { useWeeklyLootSummary } from '../../hooks/useWeeklyLootSummary';
import { relativeTime } from '../../utils/staticActivity';
import { getAllTrialIds } from '../../gamedata';
import { getTierById } from '../../gamedata/raid-tiers';
import { DEFAULT_SETTINGS } from '../../utils/constants';

export interface HomeProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  /** Gates the join-request attention rows + any manage-only affordance. */
  canManage: boolean;
  /** Navigate to a primary tab (optionally with extra URL params). */
  onNavigate: (tab: PageMode, extra?: Record<string, string>) => void;
  /** Opens Settings ▸ Recruitment ▸ Requests (now live via the v2 settings host). */
  onOpenRequests: () => void;
}

/** One built attention item — the data behind a rendered <AttentionRow/>. */
interface AttentionItem {
  key: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  meta?: string;
  action: { label: string; onClick: () => void; variant?: 'ghost' | 'accent-subtle' };
}

/** A configured roster slot has no BiS imported when no gear slot carries a bisSource. */
function hasBis(gear: { bisSource?: unknown }[]): boolean {
  return gear.some((s) => s.bisSource !== null && s.bisSource !== undefined);
}

export function Home({ group, tier, canManage, onNavigate, onOpenRequests }: HomeProps) {
  // ── Store reads ──────────────────────────────────────────────────────────
  const sessions = useScheduleStore((s) => s.sessions);
  const submitRsvp = useScheduleStore((s) => s.submitRsvp);
  const fetchSessions = useScheduleStore((s) => s.fetchSessions);

  const groupRequests = useJoinRequestStore((s) => s.groupRequests);
  const fetchGroupRequests = useJoinRequestStore((s) => s.fetchGroupRequests);

  const lootLog = useLootTrackingStore((s) => s.lootLog);
  const materialLog = useLootTrackingStore((s) => s.materialLog);
  const pageLedger = useLootTrackingStore((s) => s.pageLedger);
  // F2 (PR #272 review, declined): loaded for every viewer by NewShell's tier
  // effect (`pages/NewShell.tsx:270`, `fetchCurrentWeek`), on cold load and on
  // every tier switch — not fetched here.
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);
  const fetchLootLog = useLootTrackingStore((s) => s.fetchLootLog);
  const fetchPageLedger = useLootTrackingStore((s) => s.fetchPageLedger);
  const fetchMaterialLog = useLootTrackingStore((s) => s.fetchMaterialLog);
  const fetchPageBalances = useLootTrackingStore((s) => s.fetchPageBalances);
  const fetchMaterialBalances = useLootTrackingStore((s) => s.fetchMaterialBalances);

  const fetchProgress = useMountFarmStore((s) => s.fetchProgress);

  const fetchRegistrations = useStaticCharacterStore((s) => s.fetchRegistrations);

  const userId = useAuthStore((s) => s.user?.id);

  const tierId = tier?.tierId;

  // ── Fetch-on-mount (membership-gated, mirrors StaticHomeTab) ──────────────
  // These endpoints require membership. Applicants / non-members have no
  // userRole, so the fetches are skipped to avoid 403 spam. Group-requests are
  // manage-only.
  useEffect(() => {
    if (!group.id) return;
    const isMember = !!group.userRole;
    if (canManage) fetchGroupRequests(group.id);
    if (isMember) {
      fetchSessions(group.id);
      fetchProgress(group.id, getAllTrialIds());
      // Not tier-gated (feeds Team Summary's "Mains only" chips even before a
      // tier is picked); swallows its own errors (staticCharacterStore).
      void fetchRegistrations(group.id);
      if (tierId) {
        // A3 (A10 shape, Roster/Loot mount-fetch precedent): fetchLootLog,
        // fetchPageLedger, fetchPageBalances and fetchMaterialBalances re-throw
        // after recording store error state, but this screen never renders
        // lootTrackingStore.error — surface ONE toast for the group (Promise.all
        // attaches handlers to every member, so nothing escapes unhandled).
        void Promise.all([
          fetchLootLog(group.id, tierId),
          fetchPageLedger(group.id, tierId),
          fetchPageBalances(group.id, tierId),
          fetchMaterialBalances(group.id, tierId),
        ]).catch(() => toast.error('Failed to load loot data'));
        // fetchMaterialLog re-throws on failure (lootTrackingStore) — swallow like
        // the ScheduleTab mount-fetch precedent so this new call can't become an
        // unhandled-rejection site. Feeds the activity feed only; non-fatal.
        void fetchMaterialLog(group.id, tierId).catch(() => undefined);
      }
    } else if (tierId) {
      // R-D14-C: fairness renders for anyone who can view, and Home only
      // mounts for someone who already has view access (member or not) — so
      // a non-member still needs its three logs, read-only. Same error
      // handling as Loot's own unconditional mount-fetch (`Loot.tsx:641-643`):
      // one Promise.all, one toast. Balances, registrations and Team Summary
      // stay member-only (unchanged above).
      void Promise.all([
        fetchLootLog(group.id, tierId),
        fetchPageLedger(group.id, tierId),
        fetchMaterialLog(group.id, tierId),
      ]).catch(() => toast.error('Failed to load loot data'));
    }
  }, [
    group.id,
    group.userRole,
    canManage,
    tierId,
    fetchGroupRequests,
    fetchSessions,
    fetchProgress,
    fetchRegistrations,
    fetchLootLog,
    fetchPageLedger,
    fetchPageBalances,
    fetchMaterialBalances,
    fetchMaterialLog,
  ]);

  // ── FairnessSummary inputs (R-D14-D — same derivations as Loot's mount,
  // `Loot.tsx:1216-1224` before D14 moved the card here) ────────────────────
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...group.settings }), [group.settings]);
  const mainRosterPlayers = useMemo(
    () => (tier?.players ?? []).filter((p) => p.configured && !p.isSubstitute),
    [tier?.players],
  );
  const fairnessFloors = useMemo(
    () => (tier ? (getTierById(tier.tierId)?.floors ?? []) : []),
    [tier],
  );

  // ── Next session (first upcoming, ascending) ──────────────────────────────
  const nextSession = useMemo(() => {
    const now = new Date().toISOString();
    return (
      sessions
        .filter((s) => s.startTime >= now)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null
    );
  }, [sessions]);

  const currentUserRsvp = nextSession?.rsvps.find((r) => r.userId === userId)?.status;

  const summary = useWeeklyLootSummary({ tierId, lootLog, pageLedger, week: currentWeek });

  // ── Dynamic subtitle: next-session · floors-left · loot-through ───────────
  const subtitle = useMemo(() => {
    const parts: string[] = [];

    if (nextSession) {
      const start = new Date(nextSession.startTime);
      if (!Number.isNaN(start.getTime())) {
        const day = start.toLocaleDateString(undefined, { weekday: 'long' });
        const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        parts.push(`${day} ${time} raid`);
      }
    }

    if (summary.length > 0) {
      const floorsLeft = summary.filter((f) => !f.cleared).length;
      parts.push(
        floorsLeft > 0
          ? `${floorsLeft} floor${floorsLeft === 1 ? '' : 's'} left to clear`
          : 'all floors cleared',
      );
    }

    const weekLoot = lootLog.filter((e) => e.weekNumber === currentWeek);
    if (weekLoot.length > 0) {
      const latest = weekLoot.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      const through = new Date(latest.createdAt);
      if (!Number.isNaN(through.getTime())) {
        parts.push(`loot logged through ${through.toLocaleDateString(undefined, { weekday: 'long' })}`);
      }
    }

    return parts.length > 0 ? parts.join(' · ') : undefined;
  }, [nextSession, summary, lootLog, currentWeek]);

  // ── "Needs your attention" items ──────────────────────────────────────────
  // Order (spec §5.7): BiS-blocking first, then unclaimed, then join requests.
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const players = tier?.players ?? [];
    const items: AttentionItem[] = [];

    // (a) claimed raiders missing BiS → "Import BiS"
    players
      .filter((p) => p.configured && !p.isSubstitute && p.userId && !hasBis(p.gear))
      .slice(0, 3)
      .forEach((p) => {
        const detail = [p.job, p.position ?? p.role].filter(Boolean).join(' · ');
        items.push({
          key: `nobis-${p.id}`,
          icon: <AlertTriangle size={18} />,
          title: (
            <>
              {p.name}
              {detail && <span className="font-normal text-text-tertiary"> · {detail}</span>}
            </>
          ),
          meta: "No BiS imported — priority can't be calculated",
          action: { label: 'Import BiS', onClick: () => onNavigate('roster'), variant: 'accent-subtle' },
        });
      });

    // (b) configured-but-unlinked slots → "Assign" (manage-only action)
    if (canManage) {
      players
        .filter((p) => p.configured && !p.userId)
        .slice(0, 3)
        .forEach((p) => {
          items.push({
            key: `unclaimed-${p.id}`,
            icon: <UserPlus size={18} />,
            title: (
              <>
                {p.name}
                {p.isSubstitute && (
                  <span className="ml-2 align-middle">
                    <Tag variant="label">SUB</Tag>
                  </span>
                )}
              </>
            ),
            meta: 'Unclaimed — not linked to a Discord member',
            action: { label: 'Assign', onClick: () => onNavigate('roster'), variant: 'ghost' },
          });
        });
    }

    // (c) pending join requests (manage-only) → "Review"
    if (canManage) {
      groupRequests
        .filter((r) => r.status === 'pending' || r.status === 'under_review')
        .slice(0, 3)
        .forEach((r) => {
          const name = r.characterNameAtApply || r.requester?.displayName || 'Adventurer';
          items.push({
            key: `request-${r.id}`,
            icon: <Inbox size={18} />,
            title: <>Join request — {name}</>,
            meta: `Applied ${relativeTime(r.createdAt)}`,
            action: { label: 'Review', onClick: onOpenRequests, variant: 'ghost' },
          });
        });
    }

    return items;
  }, [tier?.players, groupRequests, canManage, onNavigate, onOpenRequests]);

  // ── Hero next-session card (RSVP) or empty-state invite ───────────────────
  const heroSession = nextSession ? (
    <SessionRsvpCard
      session={nextSession}
      currentUserRsvp={currentUserRsvp}
      onRsvp={(status: RsvpStatus) => submitRsvp(group.id, nextSession.id, status)}
    />
  ) : (
    <CardShell title="Next session">
      <EmptyStateInvite
        icon={<CalendarPlus className="h-5 w-5" />}
        title="No upcoming session"
        description="Schedule one so the team can RSVP."
        action={{ label: 'Add session', onClick: () => onNavigate('schedule') }}
      />
    </CardShell>
  );

  return (
    <div>
      <PageHeader title="This week" subtitle={subtitle} />

      {/* R-E2-G: one grid — the hero row (collapses below ~1180px) and the
          dashboard row (actionable stack spans cols 1-2, ambient stack is
          col 3) share it, so a single `gap-4` sets the spacing everywhere.
          No grid-level `items-start`: the hero row's three cards keep
          stretching to equal height; `self-start` sits only on the two
          dashboard-row stacks below. */}
      <div className="grid grid-cols-1 gap-4 min-[1181px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
        {heroSession}
        <WeeklyLootSummaryCard tierId={tierId} onLogWeek={() => onNavigate('gear')} />
        <RosterReadinessCard />

        {/* DASHBOARD — actionable (spans cols 1-2) + ambient (col 3) */}
        <div className="flex flex-col gap-4 self-start min-[1181px]:col-span-2">
          <CardShell title="Needs your attention" icon={<AlertTriangle size={14} />}>
            {attentionItems.length === 0 ? (
              <EmptyStateInvite
                icon={<AlertTriangle className="h-5 w-5" />}
                title="You're all caught up"
                description="No BiS, roster, or recruitment items need you right now."
              />
            ) : (
              <div className="flex flex-col divide-y divide-border-subtle">
                {attentionItems.map((item) => (
                  <AttentionRow
                    key={item.key}
                    icon={item.icon}
                    title={item.title}
                    meta={item.meta}
                    action={item.action}
                  />
                ))}
              </div>
            )}
          </CardShell>
          <RoleBisCard />
          {group.userRole && <TeamSummaryCard groupId={group.id} tierId={tierId} />}
        </div>
        <div className="flex flex-col gap-4 self-start">
          {tier && (
            <CardShell title="Loot fairness" icon={<Scale size={14} />}>
              <FairnessSummary
                players={mainRosterPlayers}
                settings={settings}
                lootLog={lootLog}
                materialLog={materialLog}
                pageLedger={pageLedger}
                currentWeek={currentWeek}
                floors={fairnessFloors}
              />
            </CardShell>
          )}
          <StaticActivityFeed />
          <TrackCard />
        </div>
      </div>
    </div>
  );
}
