/**
 * Home (ring0 `home/`) — the redesigned weekly-loop dashboard.
 *
 * The F6b assembly: a "This week" page header (dynamic subtitle), a 3-card hero
 * (next session + RSVP · this week's loot · roster readiness), and a two-region
 * dashboard (actionable left: "Needs your attention" + BiS-by-role; ambient
 * right: recent activity + a display-only Track card). Wired in behind
 * `?shell=v2` as the `overview` slot on `GroupViewContent` (see NewShell).
 *
 * Boundary discipline (ring0): composes `home/` siblings + shared `ui/`
 * components + the existing shell `PageHeader`, and reads STORES directly for
 * the data the legacy prop contract never carried (schedule / loot / join
 * requests / mount farm / auth). It NEVER imports a ring1 (`schedule`/
 * `split-clear`) or ring3 (`mount-farms`/`collections`) component — the mount
 * data comes from `mountFarmStore` (a store), never `components/mount-farms/*`.
 *
 * Fetch-on-mount mirrors `StaticHomeTab`'s membership-gated effect: members get
 * sessions/loot/progress; group-requests fetch only when `canManage` (so
 * applicants/non-members never trigger a 403).
 */

import { useEffect, useMemo } from 'react';
import { AlertTriangle, CalendarPlus, Inbox, UserPlus } from 'lucide-react';
import type { PageMode, RsvpStatus, StaticGroup, TierSnapshot } from '../../types';

import { PageHeader } from '../layout/PageHeader';
import { CardShell } from '../ui/CardShell';
import { TwoRegionDashboard } from '../ui/TwoRegionDashboard';
import { AttentionRow } from '../ui/AttentionRow';
import { SessionRsvpCard } from '../ui/SessionRsvpCard';
import { EmptyStateInvite } from '../ui/EmptyStateInvite';
import { Tag } from '../ui/Tag';

import { WeeklyLootSummaryCard } from './WeeklyLootSummaryCard';
import { RosterReadinessCard } from './RosterReadinessCard';
import { RoleBisCard } from './RoleBisCard';
import { StaticActivityFeed } from './StaticActivityFeed';
import { TrackCard } from './TrackCard';

import { useScheduleStore } from '../../stores/scheduleStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { useAuthStore } from '../../stores/authStore';
import { useWeeklyLootSummary } from '../../hooks/useWeeklyLootSummary';
import { relativeTime } from '../../utils/staticActivity';
import { getAllTrialIds } from '../../gamedata';

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
  const pageLedger = useLootTrackingStore((s) => s.pageLedger);
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);
  const fetchLootLog = useLootTrackingStore((s) => s.fetchLootLog);
  const fetchPageLedger = useLootTrackingStore((s) => s.fetchPageLedger);

  const fetchProgress = useMountFarmStore((s) => s.fetchProgress);

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
      if (tierId) {
        fetchLootLog(group.id, tierId);
        fetchPageLedger(group.id, tierId);
      }
    }
  }, [
    group.id,
    group.userRole,
    canManage,
    tierId,
    fetchGroupRequests,
    fetchSessions,
    fetchProgress,
    fetchLootLog,
    fetchPageLedger,
  ]);

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

      {/* HERO — the weekly loop at a glance (collapses below ~1180px) */}
      <div className="grid grid-cols-1 gap-4 min-[1181px]:grid-cols-[1.15fr_1.15fr_1fr]">
        {heroSession}
        <WeeklyLootSummaryCard tierId={tierId} onLogWeek={() => onNavigate('gear')} />
        <RosterReadinessCard />
      </div>

      {/* DASHBOARD — actionable (left) + ambient (right) */}
      <div className="mt-4">
        <TwoRegionDashboard
          main={
            <div className="flex flex-col gap-4">
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
            </div>
          }
          side={
            <div className="flex flex-col gap-4">
              <StaticActivityFeed />
              <TrackCard />
            </div>
          }
        />
      </div>
    </div>
  );
}
