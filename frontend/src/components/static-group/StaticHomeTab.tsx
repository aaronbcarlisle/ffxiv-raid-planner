/* eslint-disable design-system/no-raw-button */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bell,
  Calendar,
  ChevronRight,
  Mail,
  Plug,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Check,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { MountFarmData, FarmScore } from '../../stores/mountFarmStore';
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import { getAllTrialIds, getTierById, getTrialById } from '../../gamedata';
import type { MountFarmTrial } from '../../gamedata';
import { getJobDisplayName } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';
import { SafeAvatar } from '../ui/SafeAvatar';
import { ReadinessBadge } from '../profile/ReadinessBadge';
import { JoinRequestReviewModal } from './JoinRequestReviewModal';
import { CreateCollectionGoalModal } from './CreateCollectionGoalModal';
import type { JoinRequest, PageMode, SnapshotPlayer, StaticGroup, TierSnapshot } from '../../types';
import { normalizeApplicationSnapshot } from '../../utils/applicationSnapshot';
import { api } from '../../services/api';

// ─── Prop types ───────────────────────────────────────────────────────────────

interface StaticHomeTabProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  onNavigate: (tab: PageMode) => void;
  canManage: boolean;
  /** Opens Settings → Requests tab. */
  onOpenRequests?: () => void;
  /** Opens Schedule tab with farm duty context pre-filled in CreateSessionModal. */
  onScheduleFarm?: (trial: MountFarmTrial) => void;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function rosterAvgIlv(players: SnapshotPlayer[]): number | null {
  const active = players.filter((p) => p.configured && !p.isSubstitute);
  if (!active.length) return null;
  let total = 0, count = 0;
  for (const p of active) {
    const iLvs = p.gear
      .map((s) => s.equippedItemLevel ?? s.itemLevel)
      .filter((v): v is number => v != null);
    if (iLvs.length) { total += iLvs.reduce((a, b) => a + b, 0) / iLvs.length; count++; }
  }
  return count > 0 ? Math.round(total / count) : null;
}

function playerIlv(p: SnapshotPlayer): number | null {
  const iLvs = p.gear
    .map((s) => s.equippedItemLevel ?? s.itemLevel)
    .filter((v): v is number => v != null);
  return iLvs.length > 0 ? Math.round(iLvs.reduce((a, b) => a + b, 0) / iLvs.length) : null;
}

type GearReadiness = 'ready' | 'in_progress' | 'needs_gear' | 'unknown';

function playerGearReadiness(p: SnapshotPlayer): GearReadiness {
  const configured = p.gear.filter((s) => s.bisSource !== null && s.bisSource !== undefined);
  if (!configured.length) return 'unknown';
  const have = configured.filter((s) => s.hasItem);
  const pct = have.length / configured.length;
  if (pct >= 1) return 'ready';
  if (pct >= 0.5) return 'in_progress';
  return 'needs_gear';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function sessionCountdown(startIso: string): string {
  const diff = new Date(startIso).getTime() - Date.now();
  if (diff < 0) return 'In progress';
  const h = diff / 3600000;
  if (h < 1) return `in ${Math.round(diff / 60000)}m`;
  if (h < 24) return `in ${Math.floor(h)}h`;
  return `in ${Math.ceil(h / 24)}d`;
}

// ─── Activity log API type ───────────────────────────────────────────────────

interface ActivityLogItem {
  id: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorDisplay: 'named' | 'anonymous' | 'system';
  eventType: string;
  trialId: string | null;
  label: string;
  createdAt: string;
}

// ─── Activity privacy model ───────────────────────────────────────────────────
//
// Visibility rules for Static Overview:
//   'static'  — safe to show to all static members
//   'leaders' — only owner/lead should see (not currently shown in Overview)
//   'private' — personal-only, must NOT appear in Static Overview
//   'public'  — safe for anyone
//
// Actor display rules:
//   'named'     — actor name is shown (explicit manual action)
//   'anonymous' — plugin-sourced: show "A member" to prevent personal sync leakage
//   'system'    — no actor (system/aggregate event)

type ActivityVisibility = 'private' | 'leaders' | 'static' | 'public';
type ActivityActorDisplay = 'named' | 'anonymous' | 'system';

interface StaticActivityItem {
  key: string;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  actorDisplay: ActivityActorDisplay;
  visibility: ActivityVisibility;
  type: 'mount_progress' | 'plugin_sync';
  icon: 'mount' | 'currency' | 'tracking' | 'plugin';
  label: string;
  createdAt: string;
  time: string;
}

function deriveActivityItems(
  data: MountFarmData,
  currentUserId?: string | null,
  activityDisplayMode?: 'named' | 'anonymous' | null,
): StaticActivityItem[] {
  interface FlatEntry {
    key: string;
    createdAt: string;
    icon: StaticActivityItem['icon'];
    label: string;
    actorDisplay: ActivityActorDisplay;
    visibility: ActivityVisibility;
    type: StaticActivityItem['type'];
    actorUserId?: string | null;
    actorDisplayName?: string | null;
  }

  const flat: FlatEntry[] = [];
  let pluginSyncAt: string | null = null;

  for (const trial of data.trials) {
    const trialInfo = getTrialById(trial.trialId);
    const dutyName = trialInfo?.dutyName ?? trial.trialId;
    const mountName = trialInfo?.mountName ?? 'mount';

    for (const mp of trial.memberProgress) {
      if (!mp.updatedAt) continue;

      const ownerPlugin = mp.ownershipSource === 'plugin';
      const totemPlugin = mp.totemSource === 'plugin';
      const isPlugin = ownerPlugin || totemPlugin;

      if (isPlugin) {
        // Aggregate the latest plugin sync timestamp for the system row
        if (mp.lastPluginSyncAt && (!pluginSyncAt || mp.lastPluginSyncAt > pluginSyncAt)) {
          pluginSyncAt = mp.lastPluginSyncAt;
        }
        // Plugin-sourced individual rows: actor name is NOT shown (privacy rule).
        // Personal plugin sync details must not leak onto Static Overview.
        if (mp.hasMount && ownerPlugin) {
          flat.push({
            key: `${trial.trialId}-${mp.userId}-obtained`,
            createdAt: mp.updatedAt,
            icon: 'mount',
            label: `A member obtained ${mountName}`,
            actorDisplay: 'anonymous',
            visibility: 'static',
            type: 'mount_progress',
            actorUserId: null,
            actorDisplayName: null,
          });
        } else if (mp.totemCount > 0 && totemPlugin) {
          flat.push({
            key: `${trial.trialId}-${mp.userId}-currency`,
            createdAt: mp.updatedAt,
            icon: 'currency',
            label: `A member updated collection progress`,
            actorDisplay: 'anonymous',
            visibility: 'static',
            type: 'mount_progress',
            actorUserId: null,
            actorDisplayName: null,
          });
        }
        continue;
      }

      // Manual sources: actor name is shown (explicit user action)
      if (mp.hasMount) {
        flat.push({
          key: `${trial.trialId}-${mp.userId}-obtained`,
          createdAt: mp.updatedAt,
          icon: 'mount',
          label: `${mp.displayName} obtained ${mountName}`,
          actorDisplay: 'named',
          visibility: 'static',
          type: 'mount_progress',
          actorUserId: mp.userId,
          actorDisplayName: mp.displayName,
        });
      } else if (mp.totemCount > 0) {
        flat.push({
          key: `${trial.trialId}-${mp.userId}-currency`,
          createdAt: mp.updatedAt,
          icon: 'currency',
          label: `${mp.displayName} updated ${dutyName} progress`,
          actorDisplay: 'named',
          visibility: 'static',
          type: 'mount_progress',
          actorUserId: mp.userId,
          actorDisplayName: mp.displayName,
        });
      } else if (mp.wantsMount) {
        flat.push({
          key: `${trial.trialId}-${mp.userId}-tracking`,
          createdAt: mp.updatedAt,
          icon: 'tracking',
          label: `${mp.displayName} started tracking ${dutyName}`,
          actorDisplay: 'named',
          visibility: 'static',
          type: 'mount_progress',
          actorUserId: mp.userId,
          actorDisplayName: mp.displayName,
        });
      }
    }
  }

  // System-level aggregate for plugin sync activity — no individual actor
  if (pluginSyncAt) {
    flat.push({
      key: 'plugin-sync',
      createdAt: pluginSyncAt,
      icon: 'plugin',
      label: 'Shared mount data updated',
      actorDisplay: 'system',
      visibility: 'static',
      type: 'plugin_sync',
    });
  }

  // Static Overview only shows 'static' and 'public' visibility items.
  // 'private' (personal plugin sync details) and 'leaders' rows are excluded.
  const visible = flat.filter((f) => f.visibility === 'static' || f.visibility === 'public');
  visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return visible.slice(0, 5).map((f) => {
    const shouldAnonymize =
      activityDisplayMode === 'anonymous' &&
      currentUserId &&
      f.actorUserId === currentUserId &&
      f.actorDisplay === 'named';
    return {
      key: f.key,
      actorUserId: shouldAnonymize ? null : f.actorUserId,
      actorDisplayName: shouldAnonymize ? null : f.actorDisplayName,
      actorDisplay: shouldAnonymize ? ('anonymous' as ActivityActorDisplay) : f.actorDisplay,
      visibility: f.visibility,
      type: f.type,
      icon: f.icon,
      label: shouldAnonymize ? f.label.replace(f.actorDisplayName ?? '', 'A member') : f.label,
      createdAt: f.createdAt,
      time: relativeTime(f.createdAt),
    };
  });
}

// ─── Shared label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted uppercase tracking-[0.14em] mb-2.5 select-none">
      <span className="opacity-70">{icon}</span>
      {children}
    </h3>
  );
}

// ─── Left column modules ──────────────────────────────────────────────────────

function NotificationsModule({
  requests,
  nextSession,
  loading,
  onNavigate,
  onOpenRequests,
}: {
  requests: JoinRequest[];
  nextSession: { startTime: string; contentName: string | null } | null;
  loading: boolean;
  onNavigate: (tab: PageMode) => void;
  onOpenRequests?: () => void;
}) {
  const items = useMemo(() => {
    const list: { id: string; icon: React.ReactNode; title: string; sub: string; time: string; accent: boolean }[] = [];

    const pending = requests
      .filter((r) => r.status === 'pending' || r.status === 'under_review')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);

    for (const r of pending) {
      const name = r.characterNameAtApply || r.requester?.displayName || 'Adventurer';
      list.push({
        id: r.id,
        icon: <Mail className="w-3.5 h-3.5" />,
        title: 'New application received',
        sub: `From ${name}`,
        time: relativeTime(r.createdAt),
        accent: true,
      });
    }

    return list;
  }, [requests]);

  const sessionNotification = nextSession ? (() => {
    const sessionTime = new Date(nextSession.startTime).getTime();
    const nowMs = new Date().getTime();
    const diffH = (sessionTime - nowMs) / 3600000;
    if (diffH >= 0 && diffH <= 48) {
      return {
        id: 'session',
        icon: <Calendar className="w-3.5 h-3.5" />,
        title: nextSession.contentName ? `Raid: ${nextSession.contentName}` : 'Raid session upcoming',
        sub: sessionCountdown(nextSession.startTime),
        time: new Date(nextSession.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        accent: false,
      };
    }
    return null;
  })() : null;

  const allItems = sessionNotification ? [...items, sessionNotification] : items;

  return (
    <div>
      <SectionLabel icon={<Bell className="w-3 h-3" />}>Notifications</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-3 space-y-2.5">
            {[1, 2].map((n) => (
              <div key={n} className="h-10 rounded-lg bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <Bell className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary">No pending applications</p>
            <p className="text-[11px] text-text-muted mt-0.5">Share your listing to start receiving requests</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {allItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'session') onNavigate('schedule');
                  else if (onOpenRequests) onOpenRequests();
                  else onNavigate('players');
                }}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-surface-elevated transition-colors text-left group"
              >
                <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
                  item.accent ? 'bg-accent/15 text-accent' : 'bg-surface-elevated text-text-secondary'
                }`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${item.accent ? 'text-accent' : 'text-text-primary'}`}>
                    {item.title}
                    {item.accent && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent align-middle" />}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">{item.sub}</p>
                </div>
                <span className="text-[10px] text-text-muted flex-shrink-0 mt-0.5">{item.time}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NextRaidModule({
  session,
  loading,
  onNavigate,
}: {
  session: { title: string; startTime: string; endTime: string; contentName: string | null; rsvps: { status: string }[] } | null;
  loading: boolean;
  onNavigate: (tab: PageMode) => void;
}) {
  return (
    <div>
      <SectionLabel icon={<Swords className="w-3 h-3" />}>Next Raid</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-3 h-24 animate-pulse bg-surface-elevated/30" />
        ) : !session ? (
          <div className="px-3 py-5 text-center">
            <Calendar className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary mb-0.5">No sessions scheduled</p>
            <p className="text-[11px] text-text-muted mb-2.5">Add a session so your team can RSVP</p>
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
            >
              Add a session
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                {session.contentName && (
                  <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-0.5">
                    {session.contentName}
                  </p>
                )}
                <p className="text-sm font-bold text-text-primary leading-tight">{session.title}</p>
              </div>
              <span className="text-xs font-semibold text-accent bg-accent/10 rounded-md px-2 py-0.5 flex-shrink-0">
                {sessionCountdown(session.startTime)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Calendar className="w-3 h-3 text-text-muted flex-shrink-0" />
              <span>
                {new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(session.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {new Date(session.endTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>

            {session.rsvps.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Users className="w-3 h-3 text-text-muted flex-shrink-0" />
                <span>
                  {session.rsvps.filter((r) => r.status === 'available').length} available
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="w-full mt-1 text-xs font-medium text-accent border border-accent/30 rounded-lg py-1.5 hover:bg-accent/10 transition-colors"
            >
              View Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklyProgressModule({
  players,
  tierInfo,
}: {
  players: SnapshotPlayer[];
  tierInfo: { name: string } | null | undefined;
}) {
  const active = players.filter((p) => p.configured && !p.isSubstitute);

  const bisCount = useMemo(() => {
    return active.filter((p) => {
      if (!p.gear.length) return false;
      return p.gear.every((s) => s.hasItem);
    }).length;
  }, [active]);

  const avgIlv = rosterAvgIlv(players);

  if (!active.length) return null;

  return (
    <div>
      <SectionLabel icon={<Target className="w-3 h-3" />}>Tier Progress</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card p-3 space-y-2.5">
        {tierInfo && (
          <p className="text-[11px] font-semibold text-accent uppercase tracking-wide">{tierInfo.name}</p>
        )}

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[11px] text-text-secondary">BiS Complete</span>
            <span className="text-[11px] font-semibold text-text-primary">
              {bisCount} / {active.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: active.length > 0 ? `${(bisCount / active.length) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {avgIlv != null && (
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Avg iLv</span>
            <span className="font-semibold text-text-primary">{avgIlv}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Center column modules ────────────────────────────────────────────────────

/**
 * Unified command module — status chips + integrated parchment application notice.
 * Uses normalizeApplicationSnapshot() for consistent field derivation with the Dossier.
 */
function CommandBriefModule({
  pendingCount,
  featuredRequest,
  nextSession,
  configuredCount,
  canManage,
  onReviewRequest,
  onOpenRequests,
  onNavigate,
}: {
  pendingCount: number;
  featuredRequest: JoinRequest | null;
  nextSession: { startTime: string } | null;
  configuredCount: number;
  canManage: boolean;
  onReviewRequest?: () => void;
  onOpenRequests?: () => void;
  onNavigate: (tab: PageMode) => void;
}) {
  const chips: { key: string; label: string; accent: boolean; onClick: () => void }[] = [
    ...(canManage && pendingCount > 0
      ? [{ key: 'pending', label: `${pendingCount} pending application${pendingCount > 1 ? 's' : ''}`, accent: true, onClick: onReviewRequest ?? (() => onNavigate('players')) }]
      : []),
    ...(nextSession
      ? [{ key: 'raid', label: `Next raid ${sessionCountdown(nextSession.startTime)}`, accent: false, onClick: () => onNavigate('schedule') }]
      : [{ key: 'noraid', label: 'No sessions scheduled', accent: false, onClick: () => onNavigate('schedule') }]),
    { key: 'roster', label: `${configuredCount}/8 roster configured`, accent: false, onClick: () => onNavigate('players') },
  ];

  let ctaLabel: string | null = null;
  let ctaAction: (() => void) | null = null;
  if (!canManage || pendingCount === 0) {
    if (!nextSession) {
      ctaLabel = 'Schedule a raid';
      ctaAction = () => onNavigate('schedule');
    } else if (configuredCount < 8) {
      ctaLabel = 'Set up roster';
      ctaAction = () => onNavigate('players');
    }
  }

  // Use shared snapshot mapper so preview shows identical facts to the Dossier
  const snap = featuredRequest ? normalizeApplicationSnapshot(featuredRequest) : null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              chip.accent
                ? 'bg-accent/15 text-accent hover:bg-accent/25 border border-accent/20'
                : 'bg-surface-elevated text-text-secondary hover:bg-surface-interactive border border-border-subtle'
            }`}
          >
            {chip.label}
            {chip.accent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
          </button>
        ))}
      </div>

      {canManage && featuredRequest && snap && (
        <div
          data-testid="application-notice"
          className="rounded-lg overflow-hidden mb-3"
          style={{
            /* design-system-ignore — parchment/recruitment exception */
            background: 'linear-gradient(135deg, #fdf6e8 0%, #f9efd6 100%)',
            border: '1px solid rgba(184,147,58,0.5)',
            boxShadow: 'inset 0 0 0 1px rgba(184,147,58,0.08)',
          }}
        >
          <div style={{ height: '1.5px', background: 'linear-gradient(90deg, transparent, #b8933a 20%, #d4aa4a 50%, #b8933a 80%, transparent)' }} />

          <div className="flex items-center gap-2 px-3 pt-1.5 pb-1">
            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#8b6914' }}>
              ✦ New Application
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#8c7a60' }}>
              {relativeTime(featuredRequest.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 px-3 pb-2.5">
            <div
              className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
              style={{ border: '1.5px solid rgba(184,147,58,0.55)', background: '#e8d9b8' }}
            >
              <SafeAvatar
                src={snap.portrait}
                alt=""
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <Shield className="w-4 h-4" style={{ color: '#b8933a', opacity: 0.6 }} />
                  </div>
                }
              />
            </div>

            <div className="flex-1 min-w-0">
              <p style={{ color: '#2d1e13', fontWeight: 700, fontSize: '13px', lineHeight: 1.25 }} className="font-display truncate">
                {snap.name}
              </p>
              {snap.world && (
                <p style={{ color: '#7a5c3a', fontSize: '11px' }} className="truncate">{snap.world}</p>
              )}
              {snap.applyingJob && (
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <JobIcon job={snap.applyingJob} size="sm" />
                  <span style={{ color: '#2d1e13', fontWeight: 600, fontSize: '11px' }}>
                    {getJobDisplayName(snap.applyingJob) || snap.applyingJob}
                  </span>
                  {snap.readiness && (
                    <ReadinessBadge readiness={snap.readiness} />
                  )}
                  {snap.avgItemLevel != null && (
                    <span style={{ color: '#4a7a4a', fontSize: '10px', fontWeight: 500 }}>iLv {snap.avgItemLevel}</span>
                  )}
                </div>
              )}
              {snap.message && (
                <p style={{ color: '#7a5c3a', fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }} className="line-clamp-1">
                  "{snap.message}"
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onReviewRequest}
              style={{
                /* design-system-ignore */
                background: '#2d1e13',
                color: '#e8d4a0',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Review Dossier
            </button>
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(184,147,58,0.25), transparent)' }} />
        </div>
      )}

      {canManage && pendingCount > 1 && (
        <p className="text-[10px] text-text-muted mb-2 text-right pr-1">
          <button
            type="button"
            onClick={() => onOpenRequests?.()}
            className="text-accent hover:underline"
          >
            +{pendingCount - 1} more application{pendingCount - 1 > 1 ? 's' : ''} · View all
          </button>
        </p>
      )}

      {ctaLabel && ctaAction && (
        <button
          type="button"
          onClick={ctaAction}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Combined group identity + Raid Prep card.
 * Raid Prep rows are keyboard-accessible buttons navigating to the Roster tab.
 */
function GroupHeroPanel({
  group,
  tier,
  players,
  onNavigate,
}: {
  group: StaticGroup;
  tier: TierSnapshot | null;
  players: SnapshotPlayer[];
  onNavigate: (tab: PageMode) => void;
}) {
  const tierInfo = tier ? getTierById(tier.tierId) : null;
  const active = players.filter((p) => p.configured && !p.isSubstitute);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-base text-text-primary leading-tight truncate">{group.name}</h2>
          {tierInfo && (
            <p className="text-xs text-text-secondary truncate">{tierInfo.name}</p>
          )}
        </div>
      </div>

      {active.length > 0 ? (
        <div className="px-3.5 pt-3 pb-1">
          <h3 className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted uppercase tracking-[0.16em] mb-2.5 select-none">
            <Users className="w-3 h-3 opacity-70" />
            Raid Prep
          </h3>
          <div>
            {active.slice(0, 8).map((p) => {
              const configured = p.gear.filter((s) => s.bisSource !== null && s.bisSource !== undefined);
              const have = p.gear.filter((s) => s.hasItem);
              const total = configured.length || p.gear.length;
              const count = have.length;
              const ilv = playerIlv(p);
              const readiness = playerGearReadiness(p);
              const readinessLabel =
                readiness === 'ready' ? 'Ready' :
                readiness === 'in_progress' ? 'In progress' :
                readiness === 'needs_gear' ? 'Needs gear' :
                'No gear data';
              const readinessColor =
                readiness === 'ready' ? 'text-status-success' :
                readiness === 'in_progress' ? 'text-status-warning' :
                readiness === 'needs_gear' ? 'text-status-error' :
                'text-text-muted';
              return (
                /* Part 6: Raid Prep rows are keyboard-accessible buttons → navigate to Roster */
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onNavigate('players')}
                  className="w-full flex items-center gap-2 py-1.5 border-b border-border-subtle last:border-0 min-w-0 hover:bg-surface-elevated/50 transition-colors rounded-md px-1 -mx-1 text-left"
                  aria-label={`View ${p.name} on roster`}
                >
                  <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                    <JobIcon job={p.job?.toUpperCase() || 'ADV'} size="sm" />
                  </div>
                  <p className="flex-1 text-xs font-semibold text-text-primary truncate min-w-0">{p.name}</p>
                  <span className="text-[10px] text-text-muted flex-shrink-0 tabular-nums">
                    {ilv != null ? `iLv ${ilv}` : '—'}
                  </span>
                  <span className="text-[10px] text-text-muted flex-shrink-0 tabular-nums">
                    {total > 0 ? `${count}/${total}` : 'No BiS'}
                  </span>
                  <span className={`text-[10px] font-semibold flex-shrink-0 ${readinessColor}`}>
                    {readinessLabel}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('players')}
            className="w-full mt-2 mb-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-text-muted hover:text-accent transition-colors"
          >
            View full roster
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <Users className="w-7 h-7 text-text-muted opacity-25 mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-text-secondary mb-1">Roster not configured</p>
          <p className="text-xs text-text-muted mb-3">
            Sync gear or assign roster jobs to start tracking readiness.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('players')}
            className="text-xs font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors"
          >
            Open Roster
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Right column modules ─────────────────────────────────────────────────────

function RosterPresenceModule({
  players,
  onNavigate,
}: {
  players: SnapshotPlayer[];
  onNavigate: (tab: PageMode) => void;
}) {
  const active = players.filter((p) => p.configured && !p.isSubstitute);

  return (
    <div>
      <SectionLabel icon={<Users className="w-3 h-3" />}>
        Static Roster
        <span className="ml-auto font-bold text-text-primary normal-case tracking-normal text-xs">
          {active.length}/8
        </span>
      </SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {active.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <Users className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary mb-0.5">Roster not configured</p>
            <p className="text-[11px] text-text-muted mb-2.5">Add 8 players to start tracking progress</p>
            <button
              type="button"
              onClick={() => onNavigate('players')}
              className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
            >
              Set up roster
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {active.slice(0, 8).map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onNavigate('players')}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-elevated transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-surface-elevated border border-border-subtle">
                  {player.lodestoneAvatarUrl ? (
                    <img src={player.lodestoneAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <JobIcon job={player.job?.toUpperCase() || 'ADV'} size="sm" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{player.name}</p>
                  <p className="text-[10px] text-text-muted capitalize">{player.role || '—'}</p>
                </div>
                {player.job && (
                  <div className="flex-shrink-0">
                    <JobIcon job={player.job.toUpperCase()} size="sm" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
        {active.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <button
              type="button"
              onClick={() => onNavigate('players')}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-text-muted hover:text-accent transition-colors"
            >
              Open Roster
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Best Next Farm — top recommendation from the mount farm scorer.
 * "Schedule Farm" opens CreateSessionModal with duty/farm context pre-filled
 * via onScheduleFarm prop (handled in GroupView to fire the eventBus event).
 */
function BestNextFarmModule({
  recommendations,
  loading,
  onNavigate,
  onScheduleFarm,
}: {
  recommendations: FarmScore[];
  loading: boolean;
  onNavigate: (tab: PageMode) => void;
  onScheduleFarm?: (trial: MountFarmTrial) => void;
}) {
  const top = recommendations[0] ?? null;
  const trialInfo = top ? getTrialById(top.trialId) : null;

  return (
    <div>
      <SectionLabel icon={<Trophy className="w-3 h-3" />}>Best Next Farm</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-3 h-20 animate-pulse bg-surface-elevated/30 rounded-xl" />
        ) : top && trialInfo ? (
          <div className="p-3 space-y-2">
            <div>
              <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-0.5 truncate">
                {trialInfo.dutyName}
              </p>
              <p className="text-xs font-bold text-text-primary leading-tight truncate">
                {trialInfo.mountName}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {top.membersMissing} member{top.membersMissing !== 1 ? 's' : ''} still need{top.membersMissing === 1 ? 's' : ''} this
                {top.membersCanBuy > 0 && ` · ${top.membersCanBuy} ready to exchange`}
              </p>
            </div>
            <button
              type="button"
              data-testid="schedule-farm-btn"
              onClick={() => {
                if (onScheduleFarm) {
                  onScheduleFarm(trialInfo);
                } else {
                  onNavigate('mount-farms');
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
            >
              <Calendar className="w-3 h-3" />
              Schedule Farm
            </button>
          </div>
        ) : (
          <div className="px-3 py-5 text-center">
            <Sparkles className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary mb-0.5">No active farm recommendations</p>
            <p className="text-[11px] text-text-muted mb-2.5">
              Track member progress in Mount Farms to get ranked suggestions.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('mount-farms')}
              className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
            >
              Open Mount Farms
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  mount: 'Mount',
  token: 'Token',
  minion: 'Minion',
  orchestrion: 'Orchestrion',
  glam: 'Glamour',
  custom_reward: 'Custom',
};

const GOAL_STATUS_COLORS: Record<string, string> = {
  wanted: 'text-text-muted',
  farming: 'text-accent',
  scheduled: 'text-status-warning',
  complete: 'text-status-success',
};

const GOAL_STATUS_LABELS: Record<string, string> = {
  wanted: 'Wanted',
  farming: 'Farming',
  scheduled: 'Scheduled',
  complete: 'Complete',
};

/**
 * Collection Goals — static/shared collection goals backed by the backend.
 * Owner/lead can create, edit, and delete; members can view only.
 * Shows 2–4 rows when goals exist; opens CreateCollectionGoalModal on CTA.
 */
function CollectionGoalsModule({
  goals,
  loading,
  canManage,
  onCreateGoal,
  onDeleteGoal,
}: {
  goals: CollectionGoal[];
  loading: boolean;
  canManage: boolean;
  onCreateGoal: () => void;
  onDeleteGoal: (id: string) => void;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visibleGoals = goals.slice(0, 4);
  const activeGoals = goals.filter((g) => g.status !== 'complete');

  return (
    <div>
      <SectionLabel icon={<Target className="w-3 h-3" />}>Collection Goals</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-3 space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-8 rounded-lg bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <Target className="w-5 h-5 text-text-muted mx-auto mb-2 opacity-40" />
            <p
              className="text-xs font-medium text-text-secondary mb-0.5"
              data-testid="collection-goals-empty-heading"
            >
              No collection goals yet
            </p>
            <p className="text-[11px] text-text-muted mb-3">
              Track mounts, tokens, and rewards your group wants to farm.
            </p>
            {canManage && (
              <button
                type="button"
                data-testid="create-collection-goal-btn"
                onClick={onCreateGoal}
                className="text-xs font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors"
              >
                Create Collection Goal
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-border-subtle">
              <AnimatePresence initial={false}>
              {visibleGoals.map((goal) => (
                <motion.div
                  key={goal.id}
                  layout
                  data-testid="collection-goal-row"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.16 } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className="flex items-center gap-2.5 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{goal.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-text-muted">{GOAL_TYPE_LABELS[goal.goalType] ?? goal.goalType}</span>
                      {goal.targetCount != null && (
                        <span className="text-[10px] text-text-muted">
                          · {goal.currentCount ?? 0}/{goal.targetCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold flex-shrink-0 ${GOAL_STATUS_COLORS[goal.status] ?? 'text-text-muted'}`}>
                    {GOAL_STATUS_LABELS[goal.status] ?? goal.status}
                  </span>
                  {goal.status === 'complete' && (
                    <Check className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
                  )}
                  {canManage && (
                    confirmDeleteId === goal.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => { onDeleteGoal(goal.id); setConfirmDeleteId(null); }}
                          className="p-1 rounded text-status-error hover:bg-status-error/10 transition-colors"
                          title="Confirm delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1 rounded text-text-muted hover:bg-surface-elevated transition-colors text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(goal.id)}
                        className="p-1 rounded text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )
                  )}
                </motion.div>
              ))}
              </AnimatePresence>
            </div>

            <div className="px-3 py-2 flex items-center justify-between border-t border-border-subtle">
              {canManage ? (
                <button
                  type="button"
                  data-testid="create-collection-goal-btn"
                  onClick={onCreateGoal}
                  className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  + Add goal
                </button>
              ) : (
                <span className="text-[11px] text-text-muted">
                  {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}
                </span>
              )}
              {goals.length > 4 && (
                <span className="text-[10px] text-text-muted">+{goals.length - 4} more</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Recent Activity — derives privacy-filtered activity rows from mount farm progress.
 *
 * Privacy rules (enforced in deriveActivityItems):
 *   - Manual entries: show actor name (explicit user action)
 *   - Plugin-sourced entries: actor anonymous ("A member…") — personal sync must not leak
 *   - Plugin aggregate: system label "Shared mount data synced" — no individual actor
 *   - Only 'static' and 'public' visibility rows reach this component
 *
 * fetchProgress() is called on Overview load so rows appear on first visit.
 * Row density mirrors MountFarmTab's RecentActivity (compact, w-5 icon badge).
 */
function RecentActivityModule({
  farmData,
  groupId,
  onNavigate,
  canManage,
}: {
  farmData: MountFarmData | null;
  groupId: string;
  onNavigate: (tab: PageMode) => void;
  canManage: boolean;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const [apiItems, setApiItems] = useState<ActivityLogItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ActivityLogItem[]>(`/api/static-groups/${groupId}/activity-log?limit=10`)
      .then((rows) => { if (!cancelled) setApiItems(rows); })
      .catch(() => { if (!cancelled) setApiItems([]); });
    return () => { cancelled = true; };
  }, [groupId]);

  const derivedItems = useMemo(() => {
    if (!farmData) return [];
    return deriveActivityItems(farmData, currentUser?.id, currentUser?.activityDisplayMode);
  }, [farmData, currentUser?.id, currentUser?.activityDisplayMode]);

  // Use API items when available; fall back to derived while loading or when empty API
  const items: { key: string; label: string; icon: StaticActivityItem['icon']; time: string; actorUserId: string | null }[] = useMemo(() => {
    if (apiItems && apiItems.length > 0) {
      return apiItems.map((item) => {
        const shouldAnonymize =
          currentUser?.activityDisplayMode === 'anonymous' &&
          item.actorUserId === currentUser?.id &&
          item.actorDisplay === 'named';
        const iconMap: Record<string, StaticActivityItem['icon']> = {
          mount_obtained: 'mount',
          totem_updated: 'currency',
          tracking_started: 'tracking',
          plugin_sync: 'plugin',
        };
        return {
          key: item.id,
          label: shouldAnonymize ? item.label.replace(item.actorDisplayName ?? '', 'A member') : item.label,
          icon: iconMap[item.eventType] ?? 'tracking',
          time: relativeTime(item.createdAt),
          actorUserId: shouldAnonymize ? null : (item.actorUserId ?? null),
        };
      });
    }
    return derivedItems.map((item) => ({ ...item, actorUserId: item.actorUserId ?? null }));
  }, [apiItems, derivedItems, currentUser?.id, currentUser?.activityDisplayMode]);

  function activityIcon(icon: StaticActivityItem['icon']) {
    switch (icon) {
      case 'mount': return <Trophy className="w-3 h-3" />;
      case 'currency': return <Target className="w-3 h-3" />;
      case 'plugin': return <Plug className="w-3 h-3" />;
      case 'tracking': return <Sparkles className="w-3 h-3" />;
    }
  }

  const rowVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.14 } },
  };

  return (
    <div>
      <SectionLabel icon={<Activity className="w-3 h-3" />}>Recent Activity</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {items.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <Activity className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary" data-testid="no-recent-activity">
              No recent activity
            </p>
            <p className="text-[11px] text-text-muted mt-0.5 mb-2.5">
              Track a shared reward to start building activity.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => onNavigate('mount-farms')}
                className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
              >
                Open Mount Farms
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-border-subtle">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.div
                    key={item.key}
                    data-testid="activity-row"
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center gap-2 px-3 py-2 hover:bg-surface-elevated/30 transition-colors"
                  >
                    {/* Compact icon — w-5 badge, w-3 icon, matches MountFarmTab density */}
                    <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center bg-surface-elevated text-text-tertiary">
                      {activityIcon(item.icon)}
                    </div>
                    <p className="flex-1 text-xs text-text-primary truncate min-w-0">{item.label}</p>
                    <span className="text-[10px] text-text-tertiary flex-shrink-0 w-12 text-right">{item.time}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                type="button"
                onClick={() => onNavigate('mount-farms')}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-text-muted hover:text-accent transition-colors"
              >
                View all activity
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StaticHomeTab({
  group,
  tier,
  onNavigate,
  canManage,
  onOpenRequests,
  onScheduleFarm,
}: StaticHomeTabProps) {
  const { groupRequests, fetchGroupRequests, acceptRequest, declineRequest, markUnderReview, isLoading: reqLoading } = useJoinRequestStore();
  const { sessions, fetchSessions, isLoading: sessLoading } = useScheduleStore();
  const { data: farmData, recommendations, isLoadingRecs, fetchRecommendations, fetchProgress } = useMountFarmStore();
  const { goals, isLoading: goalsLoading, fetchGoals, deleteGoal } = useCollectionGoalStore();

  useEffect(() => {
    if (group.id) {
      fetchGroupRequests(group.id);
      fetchSessions(group.id);
      fetchRecommendations(group.id);
      // Fetch full farm progress so Recent Activity is populated on first Overview visit
      fetchProgress(group.id, getAllTrialIds());
      fetchGoals(group.id);
    }
  }, [group.id, fetchGroupRequests, fetchSessions, fetchRecommendations, fetchProgress, fetchGoals]);

  const tierPlayers = tier?.players;
  const players = tierPlayers ?? [];

  const pendingRequests = groupRequests.filter(
    (r) => r.status === 'pending' || r.status === 'under_review',
  );

  const nextSession = useMemo(() => {
    const now = new Date().toISOString();
    return (
      sessions
        .filter((s) => s.startTime >= now)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null
    );
  }, [sessions]);

  const active = players.filter((p) => p.configured && !p.isSubstitute);
  const featuredRequest = pendingRequests[0] ?? null;
  const [reviewRequest, setReviewRequest] = useState<JoinRequest | null>(null);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);

  const handleDeleteGoal = async (goalId: string) => {
    await deleteGoal(group.id, goalId);
  };

  return (
    <div className="w-full">
      {/* Asymmetric 3-column grid: narrow left rail / flexible center / narrow right rail */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(260px,320px)_minmax(620px,1fr)_minmax(280px,340px)]">

        {/* ── Left column: utility rail ── */}
        <div className="space-y-4">
          <NotificationsModule
            requests={pendingRequests}
            nextSession={nextSession}
            loading={reqLoading || sessLoading}
            onNavigate={onNavigate}
            onOpenRequests={onOpenRequests}
          />
          <NextRaidModule
            session={nextSession}
            loading={sessLoading}
            onNavigate={onNavigate}
          />
          <WeeklyProgressModule
            players={players}
            tierInfo={tier ? getTierById(tier.tierId) : null}
          />
        </div>

        {/* ── Center column: primary command area ── */}
        <div className="space-y-4">
          <CommandBriefModule
            pendingCount={pendingRequests.length}
            featuredRequest={featuredRequest}
            nextSession={nextSession}
            configuredCount={active.length}
            canManage={canManage}
            onReviewRequest={featuredRequest ? () => setReviewRequest(featuredRequest) : undefined}
            onOpenRequests={onOpenRequests}
            onNavigate={onNavigate}
          />
          <GroupHeroPanel
            group={group}
            tier={tier}
            players={players}
            onNavigate={onNavigate}
          />
          <RecentActivityModule
            farmData={farmData}
            groupId={group.id}
            onNavigate={onNavigate}
            canManage={canManage}
          />
        </div>

        {/* ── Right column: context rail ── */}
        <div className="space-y-4">
          <RosterPresenceModule players={players} onNavigate={onNavigate} />
          <BestNextFarmModule
            recommendations={recommendations}
            loading={isLoadingRecs}
            onNavigate={onNavigate}
            onScheduleFarm={onScheduleFarm}
          />
          <CollectionGoalsModule
            goals={goals}
            loading={goalsLoading}
            canManage={canManage}
            onCreateGoal={() => setShowCreateGoalModal(true)}
            onDeleteGoal={handleDeleteGoal}
          />
        </div>
      </div>

      {reviewRequest && (
        <JoinRequestReviewModal
          isOpen
          onClose={() => setReviewRequest(null)}
          request={reviewRequest}
          staticName={group.name}
          onAccept={async (id) => { await acceptRequest(id); setReviewRequest(null); }}
          onDecline={async (id) => { await declineRequest(id); setReviewRequest(null); }}
          onMarkUnderReview={async (id) => { await markUnderReview(id); }}
        />
      )}

      {showCreateGoalModal && (
        <CreateCollectionGoalModal
          isOpen
          onClose={() => setShowCreateGoalModal(false)}
          groupId={group.id}
        />
      )}
    </div>
  );
}
