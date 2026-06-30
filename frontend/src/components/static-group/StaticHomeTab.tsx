/* eslint-disable design-system/no-raw-button */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  ChevronRight,
  Mail,
  Plug,
  Scissors,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Check,
  Trash2,
} from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { useAuthStore } from '../../stores/authStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import type { StaticObjectiveGoal } from '../../stores/objectiveGoalStore';
import { useContentSuggestionStore, type ContentSuggestion } from '../../stores/contentSuggestionStore';
import { HEADER_EVENTS } from '../layout/Header';
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
import type { JoinRequest, PageMode, SnapshotPlayer, SplitClearData, StaticGroup, TierSnapshot } from '../../types';
import { normalizeApplicationSnapshot } from '../../utils/applicationSnapshot';
import { getSplitClearReadiness } from '../../utils/splitClear';
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

function SectionLabel({
  icon,
  children,
  count,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  count?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5 select-none">
      <h3
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] flex-shrink-0 whitespace-nowrap"
        style={{ color: 'rgba(20,184,166,0.65)' }}
      >
        <span style={{ opacity: 0.85 }}>{icon}</span>
        {children}
      </h3>
      <div
        className="flex-1 h-px"
        style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.25) 0%, transparent 80%)' }}
      />
      {count !== undefined && (
        <span className="text-xs font-bold text-text-primary flex-shrink-0">{count}</span>
      )}
    </div>
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
  const { t } = useTranslation();
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
        icon: <XivIcon name="schedule" size={14} />,
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
      <SectionLabel icon={<Bell className="w-3 h-3" />}>{t('overview.notifications')}</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-3 space-y-2.5">
            {[1, 2].map((n) => (
              <div key={n} className="h-10 rounded-lg bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="px-3 py-3.5 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(34,197,94,0.1)',
                boxShadow: 'inset 0 0 0 1px rgba(34,197,94,0.22)',
              }}
            >
              <Check className="w-4 h-4 text-status-success" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary">{t('overview.allCaughtUp')}</p>
              <p className="text-[11px] text-text-muted">{t('overview.noPendingApps')}</p>
            </div>
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
                  else onNavigate('roster');
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
  const { t } = useTranslation();
  return (
    <div>
      <SectionLabel icon={<XivIcon name="sword" size={12} />}>{t('overview.nextRaid')}</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-3 h-24 animate-pulse bg-surface-elevated/30" />
        ) : !session ? (
          <div className="px-3 py-5 text-center">
            <XivIcon name="schedule" size={20} className="mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary mb-0.5">{t('overview.noSessionsScheduled')}</p>
            <p className="text-[11px] text-text-muted mb-2.5">{t('overview.noSessionsDesc')}</p>
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
            >
              {t('overview.addSession')}
            </button>
          </div>
        ) : (
          <div className="p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {session.contentName && (
                  <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">
                    {session.contentName}
                  </p>
                )}
                <p className="text-sm font-bold text-text-primary leading-tight truncate">{session.title}</p>
              </div>
              <span
                className="flex-shrink-0 text-xs font-bold text-accent rounded-lg px-2.5 py-1"
                style={{
                  background: 'rgba(20,184,166,0.12)',
                  boxShadow: 'inset 0 0 0 1px rgba(20,184,166,0.22)',
                }}
              >
                {sessionCountdown(session.startTime)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Calendar className="w-3 h-3 text-text-muted flex-shrink-0" />
              <span className="truncate">
                {new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(session.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {new Date(session.endTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>

            {/* RSVP dot grid */}
            {session.rsvps.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 8 }, (_, i) => {
                    const rsvp = session.rsvps[i];
                    const bg = !rsvp
                      ? 'var(--color-surface-elevated)'
                      : rsvp.status === 'available'
                      ? 'var(--color-status-success)'
                      : rsvp.status === 'unavailable'
                      ? 'var(--color-status-error)'
                      : 'var(--color-text-muted)';
                    return (
                      <div
                        key={i}
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: bg }}
                      />
                    );
                  })}
                  <span className="ml-1 text-[10px] text-text-muted">
                    {session.rsvps.filter((r) => r.status === 'available').length}/8 ready
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-accent border border-accent/25 rounded-lg py-1.5 hover:bg-accent/10 transition-colors"
            >
              View Schedule
              <ChevronRight className="w-3 h-3" />
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
  const { t } = useTranslation();
  const active = players.filter((p) => p.configured && !p.isSubstitute);

  const bisCount = useMemo(() => {
    return active.filter((p) => {
      if (!p.gear.length) return false;
      return p.gear.every((s) => s.hasItem);
    }).length;
  }, [active]);

  const avgIlv = rosterAvgIlv(players);

  if (!active.length) return null;

  const pct = active.length > 0 ? bisCount / active.length : 0;
  const barColor = pct >= 1 ? 'var(--color-status-success)' : pct >= 0.5 ? 'var(--color-status-warning)' : 'var(--color-accent)';
  const barGlow = pct >= 1
    ? '0 0 10px rgba(34,197,94,0.55), 0 0 3px rgba(34,197,94,0.9)'
    : pct >= 0.5
    ? '0 0 10px rgba(234,179,8,0.45), 0 0 3px rgba(234,179,8,0.8)'
    : '0 0 10px rgba(20,184,166,0.45), 0 0 3px rgba(20,184,166,0.8)';

  const READINESS_COLOR: Record<GearReadiness, string> = {
    ready: 'var(--color-status-success)',
    in_progress: 'var(--color-status-warning)',
    needs_gear: 'var(--color-status-error)',
    unknown: '#3f3f46',
  };

  return (
    <div>
      <SectionLabel icon={<Target className="w-3 h-3" />}>{t('overview.tierProgress')}</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card p-3.5 space-y-3">
        {tierInfo && (
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest">{tierInfo.name}</p>
        )}

        {/* Large BiS fraction */}
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-3xl font-display font-bold tabular-nums leading-none"
            style={{ color: bisCount === active.length ? 'var(--color-status-success)' : 'var(--color-text-primary)' }}
          >
            {bisCount}
          </span>
          <span className="text-base font-semibold text-text-muted">/ {active.length}</span>
          <span className="ml-auto text-[10px] font-semibold text-text-muted uppercase tracking-wide">{t('overview.bisReady')}</span>
        </div>

        {/* Glowing progress bar */}
        <div className="h-2 rounded-full bg-surface-elevated overflow-visible">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct * 100}%`,
              background: barColor,
              boxShadow: pct > 0 ? barGlow : 'none',
            }}
          />
        </div>

        {/* Per-player readiness dots */}
        {active.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {active.map((p) => {
              const r = playerGearReadiness(p);
              return (
                <div
                  key={p.id}
                  title={`${p.name}: ${r === 'ready' ? 'BiS Ready' : r === 'in_progress' ? 'In Progress' : r === 'needs_gear' ? 'Needs Gear' : 'No data'}`}
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors"
                  style={{ background: READINESS_COLOR[r] }}
                />
              );
            })}
            <span className="ml-0.5 text-[10px] text-text-muted">
              {bisCount === active.length ? t('overview.allBis') : t('overview.remaining', { count: active.length - bisCount })}
            </span>
          </div>
        )}

        {avgIlv != null && (
          <div className="flex items-center justify-between text-xs border-t border-border-subtle pt-2.5">
            <span className="text-text-muted">{t('overview.avgIlv')}</span>
            <span className="font-bold text-text-primary tabular-nums">{avgIlv}</span>
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
  const { t } = useTranslation();
  const chips: { key: string; label: string; icon: React.ReactNode; accent: boolean; warn?: boolean; onClick: () => void }[] = [
    ...(canManage && pendingCount > 0
      ? [{ key: 'pending', label: t('overview.applicationsPending', { count: pendingCount }), icon: <Mail className="w-3 h-3" />, accent: true, onClick: onReviewRequest ?? (() => onNavigate('roster')) }]
      : []),
    ...(nextSession
      ? [{ key: 'raid', label: `Next raid ${sessionCountdown(nextSession.startTime)}`, icon: <XivIcon name="sword" size={12} />, accent: false, onClick: () => onNavigate('schedule') }]
      : [{ key: 'noraid', label: t('overview.noRaidScheduled'), icon: <XivIcon name="schedule" size={12} />, accent: false, warn: true, onClick: () => onNavigate('schedule') }]),
    {
      key: 'roster',
      label: t('overview.playersConfigured', { count: configuredCount }),
      icon: <XivIcon name="party" size={12} />,
      accent: false,
      warn: configuredCount < 8,
      onClick: () => onNavigate('roster'),
    },
  ];

  let ctaLabel: string | null = null;
  let ctaAction: (() => void) | null = null;
  if (!canManage || pendingCount === 0) {
    if (!nextSession) {
      ctaLabel = t('overview.scheduleARaid');
      ctaAction = () => onNavigate('schedule');
    } else if (configuredCount < 8) {
      ctaLabel = t('overview.setUpRoster');
      ctaAction = () => onNavigate('roster');
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
                : chip.warn
                ? 'bg-status-warning/10 text-status-warning hover:bg-status-warning/20 border border-status-warning/20'
                : 'bg-surface-elevated text-text-secondary hover:bg-surface-interactive border border-border-subtle'
            }`}
          >
            {chip.icon}
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
              {t('overview.reviewDossier')}
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
            {t('overview.moreApplications', { count: pendingCount - 1 })}
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

const ROLE_BORDER_COLOR: Record<string, string> = {
  tank: 'var(--color-role-tank)',
  healer: 'var(--color-role-healer)',
  melee: 'var(--color-role-melee)',
  ranged: 'var(--color-role-ranged)',
  caster: 'var(--color-role-caster)',
};

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
  const { t } = useTranslation();
  const tierInfo = tier ? getTierById(tier.tierId) : null;
  const active = players.filter((p) => p.configured && !p.isSubstitute);

  const bisReadyCount = useMemo(
    () => active.filter((p) => playerGearReadiness(p) === 'ready').length,
    [active],
  );
  const avgIlv = rosterAvgIlv(players);

  return (
    <div
      className="rounded-xl border border-border-subtle overflow-hidden"
      style={{
        background: 'var(--color-surface-card)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(20,184,166,0.06)',
      }}
    >
      {/* Teal gradient identity header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle"
        style={{
          background: 'linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.04) 45%, transparent 100%)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(20,184,166,0.14)',
            boxShadow: '0 0 0 1px rgba(20,184,166,0.28), 0 0 14px rgba(20,184,166,0.18)',
          }}
        >
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg text-text-primary leading-tight truncate">{group.name}</h2>
          {tierInfo && (
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-0.5">{tierInfo.name}</p>
          )}
        </div>
      </div>

      {/* Stat strip */}
      {active.length > 0 && (
        <div className="flex border-b border-border-subtle divide-x divide-border-subtle">
          {avgIlv != null && (
            <div className="flex-1 py-2.5 text-center">
              <p className="text-sm font-display font-bold text-text-primary tabular-nums">{avgIlv}</p>
              <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wide">{t('overview.avgIlv')}</p>
            </div>
          )}
          <div className="flex-1 py-2.5 text-center">
            <p
              className="text-sm font-display font-bold tabular-nums"
              style={{ color: bisReadyCount === active.length ? 'var(--color-status-success)' : 'var(--color-text-primary)' }}
            >
              {bisReadyCount}/{active.length}
            </p>
            <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wide">{t('overview.bisReady')}</p>
          </div>
          <div className="flex-1 py-2.5 text-center">
            <p className="text-sm font-display font-bold text-text-primary tabular-nums">{active.length}/8</p>
            <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wide">Roster</p>
          </div>
        </div>
      )}

      {active.length > 0 ? (
        <>
          <div className="py-1">
            {active.slice(0, 8).map((p) => {
              const configured = p.gear.filter((s) => s.bisSource !== null && s.bisSource !== undefined);
              const have = p.gear.filter((s) => s.hasItem);
              const total = configured.length || p.gear.length;
              const count = have.length;
              const ilv = playerIlv(p);
              const readiness = playerGearReadiness(p);
              const readinessColor =
                readiness === 'ready' ? 'var(--color-status-success)' :
                readiness === 'in_progress' ? 'var(--color-status-warning)' :
                readiness === 'needs_gear' ? 'var(--color-status-error)' :
                'var(--color-text-muted)';
              const roleColor = ROLE_BORDER_COLOR[p.role?.toLowerCase() ?? ''] ?? 'var(--color-border-default)';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onNavigate('roster')}
                  className="relative w-full flex items-center gap-2.5 py-1.5 pl-4 pr-3 hover:bg-surface-elevated/50 transition-colors text-left"
                  aria-label={`View ${p.name} on roster`}
                >
                  {/* Role-color left accent bar */}
                  <span
                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r flex-shrink-0"
                    style={{ background: roleColor, opacity: 0.75 }}
                  />
                  <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                    <JobIcon job={p.job?.toUpperCase() || 'ADV'} size="sm" />
                  </div>
                  <p className="flex-1 text-xs font-semibold text-text-primary truncate min-w-0">{p.name}</p>
                  <span className="text-[10px] text-text-muted flex-shrink-0 tabular-nums">
                    {ilv != null ? `iLv ${ilv}` : '—'}
                  </span>
                  <span className="text-[10px] text-text-muted flex-shrink-0 tabular-nums">
                    {total > 0 ? `${count}/${total}` : '—'}
                  </span>
                  <span
                    className="text-[10px] font-bold flex-shrink-0 w-14 text-right"
                    style={{ color: readinessColor }}
                  >
                    {readiness === 'ready' ? 'Ready' :
                     readiness === 'in_progress' ? 'In prog.' :
                     readiness === 'needs_gear' ? 'Needs gear' :
                     '—'}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-border-subtle">
            <button
              type="button"
              onClick={() => onNavigate('roster')}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-text-muted hover:text-accent transition-colors"
            >
              {t('overview.viewFullRoster')}
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <XivIcon name="party" size={28} className="opacity-25 mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-text-secondary mb-1">{t('overview.rosterNotConfigured')}</p>
          <p className="text-xs text-text-muted mb-3">
            {t('overview.rosterNotConfiguredDesc')}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('roster')}
            className="text-xs font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors"
          >
            {t('overview.openRoster')}
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
  const { t } = useTranslation();
  const active = players.filter((p) => p.configured && !p.isSubstitute);

  return (
    <div>
      <SectionLabel icon={<XivIcon name="party" size={12} />} count={`${active.length}/8`}>
        Static Roster
      </SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {active.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <XivIcon name="party" size={20} className="mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary mb-0.5">{t('overview.rosterNotConfigured')}</p>
            <p className="text-[11px] text-text-muted mb-2.5">Add 8 players to start tracking progress</p>
            <button
              type="button"
              onClick={() => onNavigate('roster')}
              className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
            >
              {t('overview.rosterSetup')}
            </button>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => {
              const player = active[i];
              const roleColor = player
                ? ROLE_BORDER_COLOR[player.role?.toLowerCase() ?? ''] ?? 'var(--color-border-default)'
                : null;
              return (
                <button
                  key={player?.id ?? `empty-${i}`}
                  type="button"
                  onClick={() => onNavigate('roster')}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-surface-elevated transition-colors group"
                  aria-label={player ? `View ${player.name} on roster` : t('overview.emptyRosterSlot')}
                >
                  {player ? (
                    <>
                      <div
                        className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-surface-elevated"
                        style={{
                          boxShadow: roleColor
                            ? `0 0 0 1.5px ${roleColor}, 0 2px 8px rgba(0,0,0,0.4)`
                            : '0 0 0 1px var(--color-border-default)',
                        }}
                      >
                        {player.lodestoneAvatarUrl ? (
                          <img src={player.lodestoneAvatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <JobIcon job={player.job?.toUpperCase() || 'ADV'} size="sm" />
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] font-semibold text-text-secondary truncate max-w-full w-full text-center leading-tight group-hover:text-text-primary transition-colors">
                        {player.name.split(' ')[0]}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-11 h-11 rounded-xl border border-dashed border-border-default flex items-center justify-center opacity-20">
                        <Users className="w-3.5 h-3.5 text-text-muted" />
                      </div>
                      <p className="text-[9px] text-text-muted opacity-30">—</p>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {active.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <button
              type="button"
              onClick={() => onNavigate('roster')}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-text-muted hover:text-accent transition-colors"
            >
              {t('overview.openRoster')}
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
  const { t } = useTranslation();
  const top = recommendations[0] ?? null;
  const trialInfo = top ? getTrialById(top.trialId) : null;

  return (
    <div>
      <SectionLabel icon={<Trophy className="w-3 h-3" />}>{t('overview.bestNextFarm')}</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-3 h-20 animate-pulse bg-surface-elevated/30 rounded-xl" />
        ) : top && trialInfo ? (
          <div className="p-3.5 space-y-3">
            {/* Farm identity header */}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(20,184,166,0.12)',
                  boxShadow: '0 0 0 1px rgba(20,184,166,0.22), 0 0 12px rgba(20,184,166,0.1)',
                }}
              >
                <Trophy className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-0.5 truncate">
                  {trialInfo.dutyName}
                </p>
                <p className="text-sm font-bold text-text-primary leading-tight truncate">
                  {trialInfo.mountName}
                </p>
              </div>
            </div>

            {/* Demand indicator */}
            <div
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{
                background: 'rgba(20,184,166,0.06)',
                border: '1px solid rgba(20,184,166,0.14)',
              }}
            >
              <Users className="w-3 h-3 text-accent flex-shrink-0" />
              <span className="text-xs text-text-secondary">
                <span className="font-bold text-text-primary tabular-nums">{top.membersMissing}</span>
                {' '}{t('overview.membersStillNeed', { count: top.membersMissing })}
              </span>
              {top.membersCanBuy > 0 && (
                <span
                  className="ml-auto text-[10px] font-bold text-accent flex-shrink-0"
                >
                  {t('overview.readyMembers', { count: top.membersCanBuy })}
                </span>
              )}
            </div>

            <button
              type="button"
              data-testid="schedule-farm-btn"
              onClick={() => {
                if (onScheduleFarm) {
                  onScheduleFarm(trialInfo);
                } else {
                  onNavigate('goals');
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              {t('overview.scheduleFarm')}
            </button>
          </div>
        ) : (
          <div className="px-3 py-5 text-center">
            <Sparkles className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary mb-0.5">{t('overview.noFarmRecommendations')}</p>
            <p className="text-[11px] text-text-muted mb-2.5">
              {t('overview.noFarmDesc')}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
            >
              {t('overview.openMountFarms')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Static Objectives constants ──────────────────────────────────────────────

const OBJECTIVE_CATEGORY_LABELS: Record<string, string> = {
  ultimate_clear:     'Ultimate — Clear',
  ultimate_farm:      'Ultimate — Farm',
  savage_bis:         'Savage — BiS',
  savage_mount:       'Savage — Mount',
  savage_achievement: 'Savage — Achievement',
  savage_alt_jobs:    'Savage — Alt Jobs',
  criterion_title:    'Criterion — Title',
  gil_farm:           'Gil Farm',
  loot_farm:          'Loot Farm',
  mount_farm:         'Mount Farm',
  custom:             'Custom',
};

const OBJECTIVE_PRIORITY_COLORS: Record<string, string> = {
  required:  'text-status-error',
  preferred: 'text-accent',
  optional:  'text-text-tertiary',
  not_doing: 'text-text-muted',
};

const OBJECTIVE_PRIORITY_LABELS: Record<string, string> = {
  required:  'Required',
  preferred: 'Preferred',
  optional:  'Optional',
  not_doing: 'Not Doing',
};

// ── Collection Goals constants ────────────────────────────────────────────────

const GOAL_TYPE_LABELS: Record<string, string> = {
  mount: 'Mount', token: 'Token', minion: 'Minion',
  orchestrion: 'Orchestrion', glam: 'Glamour', custom_reward: 'Custom',
  weapon: 'Weapon', weapon_coffer: 'Weapon Coffer',
  title: 'Title', clear_count: 'Clear Count',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  extreme: 'EX', savage: 'Savage', ultimate: 'Ultimate',
  criterion: 'Criterion', chaotic_alliance: 'Chaotic', field_operation: 'Field Op', custom: '',
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

function SubLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-surface-elevated/60 border-b border-border-subtle">
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">{children}</span>
      {aside && <span className="text-[10px] text-text-muted">{aside}</span>}
    </div>
  );
}

/**
 * Goals & Farms — unified Overview module combining Official Objectives,
 * Active Farms (Collection Goals), and Member Interest (Content Suggestions).
 *
 * The three data concepts stay separate in the backend and in Settings; this
 * module just makes them visible as one coherent ecosystem on the Overview:
 *   - Official Objectives: used for matching, discovery, roster alignment
 *   - Active Farms: trackable reward/mount/token progress
 *   - Member Interest: open suggestions, not yet official
 *
 * Preserves data-testids relied on by StaticHomeTab.test.tsx.
 */
function GoalsFarmsModule({
  objectives,
  objectivesLoading,
  objectivesError,
  goals,
  goalsLoading,
  suggestions,
  canManage,
  onCreateGoal,
  onDeleteGoal,
}: {
  objectives: StaticObjectiveGoal[];
  objectivesLoading: boolean;
  objectivesError: string | null;
  goals: CollectionGoal[];
  goalsLoading: boolean;
  suggestions: ContentSuggestion[];
  canManage: boolean;
  onCreateGoal: () => void;
  onDeleteGoal: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openGoalsTab = () => {
    window.dispatchEvent(new CustomEvent(HEADER_EVENTS.SETTINGS, { detail: { tab: 'goals' } }));
  };

  const activeObjectives = objectives.filter((o) => o.priority !== 'not_doing');
  const visibleObjectives = activeObjectives.slice(0, 3);

  const activeGoals = goals.filter((g) => g.status !== 'complete');
  const visibleGoals = goals.slice(0, 3);

  const openSuggestions = suggestions.filter((s) => s.status === 'open');
  const topSuggestions = openSuggestions.slice(0, 3);

  return (
    <div>
      <SectionLabel icon={<Target className="w-3 h-3" />}>{t('overview.goalsAndFarms')}</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden divide-y divide-border-subtle">

        {/* ── Official Objectives ── */}
        <div>
          <SubLabel aside={t('overview.objectivesAside')}>{t('overview.officialObjectives')}</SubLabel>
          {objectivesLoading && activeObjectives.length === 0 ? (
            <div className="p-3 space-y-1.5">
              {[1, 2].map((n) => (
                <div key={n} className="h-6 rounded bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : objectivesError && activeObjectives.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-[11px] text-text-muted">Couldn&apos;t load objectives.</p>
            </div>
          ) : activeObjectives.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-[11px] text-text-muted">
                {canManage
                  ? t('overview.noObjectives')
                  : t('overview.noObjectivesMember')}
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={openGoalsTab}
                  className="text-[11px] text-accent hover:underline mt-1"
                >
                  {t('overview.addObjective')}
                </button>
              )}
            </div>
          ) : (
            <>
              <ul>
                <AnimatePresence initial={false}>
                  {visibleObjectives.map((obj) => (
                    <motion.li
                      key={obj.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.16 } }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      className="px-3 py-1.5 flex items-center gap-2 border-b border-border-subtle last:border-b-0"
                    >
                      <span className="text-[12px] text-text-primary truncate flex-1">
                        {OBJECTIVE_CATEGORY_LABELS[obj.category] ?? obj.category}
                      </span>
                      <span className={`text-[10px] font-semibold flex-shrink-0 ${OBJECTIVE_PRIORITY_COLORS[obj.priority] ?? 'text-text-muted'}`}>
                        {OBJECTIVE_PRIORITY_LABELS[obj.priority] ?? obj.priority}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {activeObjectives.length > 3 && (
                <div className="px-3 py-1 flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">+{activeObjectives.length - 3} more</span>
                  {/* design-system-ignore: inline text link within overflow panel */}<button type="button" onClick={openGoalsTab} className="text-[10px] text-accent hover:underline">
                    {canManage ? t('overview.manageGoals') : t('overview.viewGoals')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Active Farms (Collection Goals) ── */}
        <div>
          <SubLabel aside={t('overview.farmsAside')}>{t('overview.activeFarms')}</SubLabel>
          {goalsLoading ? (
            <div className="p-3 space-y-1.5">
              {[1, 2].map((n) => (
                <div key={n} className="h-7 rounded bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p
                className="text-xs font-medium text-text-secondary mb-0.5"
                data-testid="collection-goals-empty-heading"
              >
                {t('overview.noCollectionGoals')}
              </p>
              <p className="text-[11px] text-text-muted mb-2">
                {t('overview.noGoalsDesc')}
              </p>
              {canManage && (
                <button
                  type="button"
                  data-testid="create-collection-goal-btn"
                  onClick={onCreateGoal}
                  className="text-[11px] font-medium text-accent border border-accent/30 rounded-lg px-2.5 py-1 hover:bg-accent/10 transition-colors"
                >
                  {t('overview.createCollectionGoal')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div>
                <AnimatePresence initial={false}>
                  {visibleGoals.map((goal) => (
                    <motion.div
                      key={goal.id}
                      layout
                      data-testid="collection-goal-row"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.16 } }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      className="flex items-start gap-2.5 px-3 py-2 border-b border-border-subtle last:border-b-0"
                    >
                      {/* Status dot */}
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{
                          background:
                            goal.status === 'complete' ? 'var(--color-status-success)' :
                            goal.status === 'farming' ? 'var(--color-accent)' :
                            goal.status === 'scheduled' ? 'var(--color-status-warning)' :
                            'var(--color-text-muted)',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-text-primary truncate">{goal.title}</p>
                          <span className={`text-[10px] font-semibold flex-shrink-0 ${GOAL_STATUS_COLORS[goal.status] ?? 'text-text-muted'}`}>
                            {goal.status === 'complete'
                              ? <Check className="w-3 h-3 text-status-success" />
                              : (GOAL_STATUS_LABELS[goal.status] ?? goal.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {goal.contentType && CONTENT_TYPE_LABELS[goal.contentType] && (
                            <span
                              className="text-[10px] font-semibold px-1 py-0.5 rounded"
                              style={
                                goal.contentType === 'ultimate'
                                  ? { background: 'rgba(168,85,247,0.12)', color: '#c084fc' }
                                  : { background: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }
                              }
                            >
                              {CONTENT_TYPE_LABELS[goal.contentType]}
                            </span>
                          )}
                          <span className="text-[10px] text-text-muted">{GOAL_TYPE_LABELS[goal.goalType] ?? goal.goalType}</span>
                          {goal.targetCount != null && (
                            <span className="text-[10px] text-text-muted tabular-nums">
                              · {goal.currentCount ?? 0}/{goal.targetCount}
                            </span>
                          )}
                        </div>
                        {/* Progress bar for countable goals */}
                        {goal.targetCount != null && goal.targetCount > 0 && (
                          <div className="mt-1.5 h-1 rounded-full bg-surface-elevated overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, ((goal.currentCount ?? 0) / goal.targetCount) * 100)}%`,
                                background: goal.status === 'complete' ? 'var(--color-status-success)' : 'var(--color-accent)',
                              }}
                            />
                          </div>
                        )}
                      </div>
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
                            className="p-1 rounded text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors flex-shrink-0"
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
              <div className="px-3 py-1.5 flex items-center justify-between">
                {canManage ? (
                  <button
                    type="button"
                    data-testid="create-collection-goal-btn"
                    onClick={onCreateGoal}
                    className="text-[11px] font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    {t('overview.addFarm')}
                  </button>
                ) : (
                  <span className="text-[10px] text-text-muted">
                    {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}
                  </span>
                )}
                {goals.length > 3 && (
                  <span className="text-[10px] text-text-muted">+{goals.length - 3} more</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Member Interest (Content Suggestions) ── */}
        <div>
          <SubLabel aside={t('overview.interestAside')}>
            {t('overview.memberInterest')}
          </SubLabel>
          {topSuggestions.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-[11px] text-text-muted mb-1">
                {t('overview.noSuggestions')}
              </p>
              <button
                type="button"
                onClick={openGoalsTab}
                className="text-[11px] text-accent hover:underline"
              >
                {t('overview.suggestContent')}
              </button>
            </div>
          ) : (
            <>
              <ul>
                {topSuggestions.map((s) => (
                  <li key={s.id} className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border-subtle last:border-b-0">
                    <span className="text-[12px] text-text-primary truncate flex-1">{s.title}</span>
                    <span className="text-[10px] text-text-muted flex-shrink-0">
                      {s.voteSummary.total} vote{s.voteSummary.total !== 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="px-3 py-1.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={openGoalsTab}
                  className="text-[11px] text-accent hover:underline"
                >
                  {canManage ? t('overview.manageSuggestions') : t('overview.voteSuggest')}
                </button>
                {openSuggestions.length > 3 && (
                  <span className="text-[10px] text-text-muted">+{openSuggestions.length - 3} more</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer: manage CTA ── */}
        <div className="px-3 py-2 flex items-center justify-between bg-surface-elevated/30">
          <button
            type="button"
            onClick={openGoalsTab}
            className="text-[11px] text-accent hover:underline"
          >
            {canManage ? t('overview.manageGoals') : t('overview.viewGoals')}
          </button>
          <span className="text-[10px] text-text-muted">Not official yet ≠ matching</span>
        </div>
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
  const { t } = useTranslation();
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

  const ACTIVITY_ICON_STYLE: Record<StaticActivityItem['icon'], { bg: string; color: string }> = {
    mount:    { bg: 'rgba(234,179,8,0.15)',   color: 'var(--color-status-warning)' },
    currency: { bg: 'rgba(59,130,246,0.15)',  color: 'var(--color-status-info)' },
    plugin:   { bg: 'rgba(20,184,166,0.15)',  color: 'var(--color-accent)' },
    tracking: { bg: 'rgba(168,85,247,0.15)',  color: 'var(--color-membership-lead)' },
  };

  function activityIcon(icon: StaticActivityItem['icon']) {
    const style = ACTIVITY_ICON_STYLE[icon];
    const IconEl = icon === 'mount' ? Trophy : icon === 'currency' ? Target : icon === 'plugin' ? Plug : Sparkles;
    return (
      <div
        className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
        style={{ background: style.bg, color: style.color }}
      >
        <IconEl className="w-3 h-3" />
      </div>
    );
  }

  const rowVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.14 } },
  };

  return (
    <div>
      <SectionLabel icon={<Activity className="w-3 h-3" />}>{t('overview.recentActivity')}</SectionLabel>
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        {items.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <Activity className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium text-text-secondary" data-testid="no-recent-activity">
              {t('overview.noRecentActivity')}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5 mb-2.5">
              {t('overview.noActivityDesc')}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => onNavigate('goals')}
                className="text-xs text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
              >
                {t('overview.openMountFarms')}
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
                    {activityIcon(item.icon)}
                    <p className="flex-1 text-xs text-text-primary truncate min-w-0">{item.label}</p>
                    <span className="text-[10px] text-text-tertiary flex-shrink-0 w-12 text-right">{item.time}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                type="button"
                onClick={() => onNavigate('goals')}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-text-muted hover:text-accent transition-colors"
              >
                {t('overview.viewAllActivity')}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Split Clear Readiness Card ───────────────────────────────────────────────

interface SplitClearReadinessCardProps {
  data: SplitClearData;
  players: SnapshotPlayer[];
  onNavigate: (tab: PageMode) => void;
}

function SplitClearReadinessCard({ data, players, onNavigate }: SplitClearReadinessCardProps) {
  const { t } = useTranslation();
  const readiness = getSplitClearReadiness(players, data.assignments);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Scissors className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-text-primary">{t('overview.splitClears')}</span>
      </div>

      <div className="space-y-1.5 text-xs text-text-secondary">
        <div className="flex items-center justify-between">
          <span>{t('overview.altsAssigned')}</span>
          <span className={`font-medium ${readiness.altCount === readiness.memberCount ? 'text-status-success' : 'text-text-primary'}`}>
            {readiness.altCount}/{readiness.memberCount}
          </span>
        </div>
        {readiness.issueMemberCount > 0 && (
          <div className="flex items-center gap-1.5 text-status-warning">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>{t('overview.membersNeedAttention', { count: readiness.issueMemberCount })}</span>
          </div>
        )}
      </div>

      {/* design-system-ignore: inline navigation link */}
      <button
        onClick={() => onNavigate('roster')}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
      >
        {t('overview.openSplitPlanner')}
        <ChevronRight className="h-3 w-3" />
      </button>
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
  const { data: splitClearData, fetchData: fetchSplitClear } = useSplitClearStore();
  const { goals, isLoading: goalsLoading, fetchGoals, deleteGoal } = useCollectionGoalStore();
  const { objectives, loading: objectivesLoading, objectivesError, fetchObjectives } = useObjectiveGoalStore();
  const { suggestions, fetchSuggestions } = useContentSuggestionStore();

  useEffect(() => {
    if (!group.id) return;
    // All of these endpoints require membership. Applicants / non-members have
    // no userRole, so skip the fetches entirely — the backend would return 403
    // and the error toast would spam on every tab visit.
    const isMember = !!group.userRole;
    if (canManage) fetchGroupRequests(group.id);
    if (isMember) {
      fetchSessions(group.id);
      fetchRecommendations(group.id);
      fetchProgress(group.id, getAllTrialIds());
      fetchGoals(group.id);
      fetchObjectives(group.id);
      fetchSuggestions(group.id);
      void fetchSplitClear(group.id);
    }
  }, [group.id, group.userRole, canManage, fetchGroupRequests, fetchSessions, fetchRecommendations, fetchProgress, fetchGoals, fetchObjectives, fetchSuggestions, fetchSplitClear]);

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

  const colAnim = (delay: number) => ({
    initial: { opacity: 0, y: 14 } as const,
    animate: { opacity: 1, y: 0 } as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const, delay },
  });

  return (
    <div className="w-full">
      {/* Asymmetric 3-column grid: narrow left rail / flexible center / narrow right rail */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(260px,320px)_minmax(620px,1fr)_minmax(280px,340px)]">

        {/* ── Left column: utility rail ── */}
        <motion.div className="space-y-4" {...colAnim(0)}>
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
        </motion.div>

        {/* ── Center column: primary command area ── */}
        <motion.div className="space-y-4" {...colAnim(0.07)}>
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
        </motion.div>

        {/* ── Right column: context rail ── */}
        <motion.div className="space-y-4" {...colAnim(0.14)}>
          <RosterPresenceModule players={players} onNavigate={onNavigate} />
          <BestNextFarmModule
            recommendations={recommendations}
            loading={isLoadingRecs}
            onNavigate={onNavigate}
            onScheduleFarm={onScheduleFarm}
          />
          <GoalsFarmsModule
            objectives={objectives}
            objectivesLoading={objectivesLoading}
            objectivesError={objectivesError}
            goals={goals}
            goalsLoading={goalsLoading}
            suggestions={suggestions}
            canManage={canManage}
            onCreateGoal={() => setShowCreateGoalModal(true)}
            onDeleteGoal={handleDeleteGoal}
          />

          {splitClearData?.enabled && (
            <SplitClearReadinessCard
              data={splitClearData}
              players={players.filter((player) => player.configured && !player.isSubstitute)}
              onNavigate={onNavigate}
            />
          )}
        </motion.div>
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
