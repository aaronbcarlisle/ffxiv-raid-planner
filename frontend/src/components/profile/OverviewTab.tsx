import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  Crosshair,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { JobIcon } from '../ui/JobIcon';
import { getFreshness, freshnessColor } from './freshness';
import { formatGearActivity, formatGearSourceLabel, hasUsableGearSnapshot } from './jobGearUtils';
import { ActivityFeedCard, useActivityFeed } from './ActivityFeed';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { formatDayOfWeekLabel } from '../schedule/availabilityUtils';
import type {
  CollectionSuggestion,
  GearSnapshot,
  PlayerGoal,
  PlayerProfile,
  StaticSuggestion,
} from '../../stores/playerProfileStore';
import { COLLECTION_GOAL_TYPES, PERSONAL_GOAL_TYPES } from '../../stores/playerProfileStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { staggerContainerProps, staggerItemProps } from '../../lib/motion';
import type { StaticGroupListItem } from '../../types';
import { getBrowserTimezone } from '../../utils/timezone';

interface OverviewTabProps {
  profile: PlayerProfile;
  goals: PlayerGoal[];
  gearSnapshots: Record<string, GearSnapshot[]>;
  collectionSuggestions: CollectionSuggestion[];
  staticSuggestions: StaticSuggestion[];
  nextStep?: { label: string; action: () => void } | null;
  onNavigate: (tab: string) => void;
  onOpenLinkModal: () => void;
  onOpenJobModal: () => void;
  primaryStatic?: StaticGroupListItem | null;
  staticGroups?: StaticGroupListItem[];
  focusAvailability?: boolean;
}

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 select-none">
      <div
        className="h-3.5 w-[3px] flex-shrink-0 rounded-full"
        style={{
          background: 'linear-gradient(180deg, var(--color-accent) 0%, rgba(20,184,166,0.2) 100%)',
        }}
      />
      <span className="text-text-muted flex items-center gap-1.5 text-[10px] font-bold tracking-[0.22em] uppercase">
        {icon && <span className="opacity-50">{icon}</span>}
        {children}
      </span>
    </div>
  );
}

function DashboardCard({
  title,
  subtitle,
  icon,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group border-border-subtle hover:border-border-hover flex flex-col overflow-hidden rounded-xl border transition-all duration-150 ${className ?? ''}`}
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.02) 0%, transparent 55%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 12px rgba(0,0,0,0.18)',
      }}
    >
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-3 flex items-start gap-2.5">
          {icon && (
            <div
              className="mt-0.5 flex-shrink-0 rounded-lg p-1.5 transition-all duration-150 group-hover:brightness-125"
              style={{
                background: 'rgba(255,255,255,0.06)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-text-primary text-sm leading-snug font-semibold">
              {title}
            </h3>
            {subtitle && (
              <p className="text-text-tertiary mt-0.5 text-[11px] leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex-1">{children}</div>
        {footer && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function InlineLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-medium transition-colors"
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function CommandChip({
  label,
  value,
  detail,
  to,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  detail: string;
  to: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group min-w-0 rounded-lg border px-3 py-2.5 transition-all duration-150 ${
        highlight
          ? 'border-accent/40 bg-accent/10 hover:border-accent/60 hover:bg-accent/15'
          : 'border-border-subtle bg-surface-elevated/60 hover:border-border-hover hover:bg-surface-elevated'
      }`}
      style={{
        boxShadow: highlight
          ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 14px rgba(20,184,166,0.1)'
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="text-text-muted flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase">
        <span className="text-accent/70 group-hover:text-accent transition-colors">{icon}</span>
        {label}
      </div>
      <div className="text-text-primary mt-1 truncate text-sm font-semibold">{value}</div>
      <div className="text-text-tertiary truncate text-[11px]">{detail}</div>
    </Link>
  );
}

export function OverviewTab({
  profile,
  goals,
  gearSnapshots,
  collectionSuggestions,
  staticSuggestions,
  nextStep,
  onNavigate,
  onOpenLinkModal: _onOpenLinkModal,
  onOpenJobModal: _onOpenJobModal,
  primaryStatic,
  staticGroups = primaryStatic ? [primaryStatic] : [],
  focusAvailability = false,
}: OverviewTabProps) {
  const { t, i18n } = useTranslation();
  const characters = profile.characters;
  const jobProfiles = profile.jobProfiles;
  const mainJob = jobProfiles.find((j) => j.priority === 'main');
  const [showAllSteps, setShowAllSteps] = useState(false);
  const { days: personalAvailabilityDays, fetchPersonalAvailability } =
    usePersonalAvailabilityStore();

  useEffect(() => {
    fetchPersonalAvailability();
  }, [fetchPersonalAvailability]);

  let latestSnapshot: GearSnapshot | null = null;
  for (const snaps of Object.values(gearSnapshots)) {
    for (const snap of snaps) {
      if (!hasUsableGearSnapshot(snap)) continue;
      if (
        !latestSnapshot ||
        (snap.syncedAt && (!latestSnapshot.syncedAt || snap.syncedAt > latestSnapshot.syncedAt))
      ) {
        latestSnapshot = snap;
      }
    }
  }

  const hasAnyGear = Object.values(gearSnapshots).some((s) => s.some(hasUsableGearSnapshot));
  const hasCharacter = characters.length > 0;
  const hasMainJob = !!mainJob;
  const hasAltJob = jobProfiles.some((j) => j.priority !== 'main');
  const hasReadyJob = jobProfiles.some((j) => j.readiness !== 'unknown');
  const visibilityConfigured = profile.visibility !== 'private';
  const shareConfigured = profile.shareEnabled && !!profile.shareCode && visibilityConfigured;

  const collectionGoals = goals.filter((g) => COLLECTION_GOAL_TYPES.includes(g.goalType as never));
  const personalGoals = goals.filter((g) => PERSONAL_GOAL_TYPES.includes(g.goalType as never));
  const farmingCollectionCount = collectionGoals.filter((g) => g.status === 'active').length;
  const readyToBuySuggestionCount = collectionSuggestions.filter(
    (s) => !s.hasMount && s.currentCount >= s.totemTarget
  ).length;
  const configuredAvailabilityDays = personalAvailabilityDays.filter((day) => day.slots.length > 0);
  const availabilityDayCount = configuredAvailabilityDays.length;
  const availabilitySlots = configuredAvailabilityDays.reduce(
    (total, day) => total + day.slots.length,
    0
  );
  const availabilityHours = availabilitySlots / 2;
  const availabilityTimezone = configuredAvailabilityDays[0]?.timezone || getBrowserTimezone();
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const availabilitySummary =
    availabilityDayCount > 0
      ? t('profile.overview.availabilitySummary', {
          days: availabilityDayCount,
          hours: Number.isInteger(availabilityHours)
            ? availabilityHours
            : availabilityHours.toFixed(1),
        })
      : t('profile.jobsGear.missing');
  const availabilityDayLabels = configuredAvailabilityDays
    .map((day) => formatDayOfWeekLabel(day.dayOfWeek as never, uiLocale))
    .join(' / ');
  const staticCount = staticGroups.length;
  const staticSummary =
    staticCount === 0
      ? t('profile.overview.findAStatic')
      : staticCount === 1
        ? staticGroups[0].name
        : t('profile.overview.myStatics', { count: staticCount });
  const staticDetail =
    staticCount === 0
      ? t('profile.overview.openStaticFinder')
      : staticCount === 1
        ? t(
            `auth.role${(staticGroups[0].userRole ?? 'member').charAt(0).toUpperCase()}${(staticGroups[0].userRole ?? 'member').slice(1)}`,
            { defaultValue: staticGroups[0].userRole ?? 'member' }
          )
        : t('profile.overview.useMyStaticsMenu');
  const staticLink =
    staticCount === 1 && primaryStatic
      ? `/group/${primaryStatic.shareCode}`
      : staticCount === 0
        ? '/discover'
        : '/profile';

  const readinessChecks = [
    { done: hasCharacter, label: t('profile.overview.characterLinked') },
    { done: hasMainJob, label: t('profile.overview.mainJobSelected') },
    { done: hasAnyGear, label: t('profile.overview.gearSaved') },
    { done: availabilityDayCount > 0, label: t('profile.overview.availabilitySet') },
    { done: hasReadyJob, label: t('profile.overview.jobReadinessSet') },
    { done: visibilityConfigured, label: t('profile.overview.profileVisibilityConfigured') },
    { done: shareConfigured, label: t('profile.overview.sharePreviewAvailable') },
  ];
  const optionalChecks = [{ done: hasAltJob, label: t('profile.overview.altFlexJobAdded') }];
  const completedCount = readinessChecks.filter((step) => step.done).length;
  const incompleteSteps = readinessChecks.filter((step) => !step.done);
  const completedSteps = [...readinessChecks, ...optionalChecks].filter((step) => step.done);
  const readinessPercent = Math.round((completedCount / readinessChecks.length) * 100);
  const readinessAction = !hasCharacter
    ? {
        label: nextStep?.label ?? t('profile.overview.linkCharacter'),
        action: nextStep?.action ?? (() => undefined),
        to: null,
      }
    : !hasMainJob
      ? {
          label: nextStep?.label ?? t('profile.overview.setMainJob'),
          action: nextStep?.action ?? (() => onNavigate('jobs-gear')),
          to: null,
        }
      : !hasAnyGear
        ? { label: t('profile.overview.checkGear'), action: () => onNavigate('sync'), to: null }
        : availabilityDayCount === 0
          ? {
              label: t('profile.overview.setAvailability'),
              action: () => onNavigate('availability'),
              to: null,
            }
          : !hasReadyJob
            ? {
                label: t('profile.overview.setReadiness'),
                action: () => onNavigate('jobs-gear'),
                to: null,
              }
            : !visibilityConfigured || !shareConfigured
              ? {
                  label: t('profile.overview.configureSharing'),
                  action: () => onNavigate('preview'),
                  to: null,
                }
              : { label: t('profile.overview.viewStaticFinder'), action: null, to: '/discover' };
  const syncHealthLabel = latestSnapshot
    ? formatGearActivity(latestSnapshot)
    : t('profile.overview.noGearSavedYet');
  const readyToApply = completedCount === readinessChecks.length;
  const activityItems = useActivityFeed(gearSnapshots, 4);

  return (
    <motion.div {...staggerContainerProps} className="space-y-4">
      <motion.div
        {...staggerItemProps}
        className="border-border-subtle overflow-hidden rounded-xl border"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.25)' }}
      >
        <div
          style={{
            height: 2,
            background:
              'linear-gradient(90deg, var(--color-accent) 0%, rgba(20,184,166,0.3) 45%, transparent 100%)',
          }}
        />
        <div
          className="p-3 sm:p-4"
          style={{
            background:
              'linear-gradient(145deg, rgba(20,184,166,0.08) 0%, rgba(20,184,166,0.025) 45%, transparent 100%)',
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold tracking-[0.18em] uppercase select-none"
                style={{ color: 'rgba(20,184,166,0.6)' }}
              >
                {t('profile.overview.profileStatus')}
              </p>
              <h2 className="font-display text-text-primary mt-0.5 truncate text-base font-semibold">
                {t('profile.overview.readyAtAGlance')}
              </h2>
            </div>
            <Badge
              variant={
                profile.visibility === 'private'
                  ? 'default'
                  : profile.visibility === 'shareable'
                    ? 'info'
                    : 'success'
              }
              size="sm"
            >
              {profile.visibility === 'private'
                ? t('profile.overview.private')
                : profile.visibility === 'shareable'
                  ? t('profile.overview.shareable')
                  : t('profile.overview.discoverable')}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <CommandChip
              label={t('profile.overview.gear')}
              value={
                latestSnapshot
                  ? `iLv ${latestSnapshot.avgItemLevel}`
                  : t('profile.jobsGear.missing')
              }
              detail={latestSnapshot ? syncHealthLabel : t('profile.overview.syncNeeded')}
              to="/profile?tab=sync"
              icon={<XivIcon name="loot" size={14} />}
            />
            <CommandChip
              label={t('profile.overview.availability')}
              value={availabilitySummary}
              detail={availabilityDayLabels || availabilityTimezone}
              to="/profile?tab=availability"
              icon={<XivIcon name="schedule" size={14} />}
              highlight={focusAvailability || availabilityDayCount === 0}
            />
            <CommandChip
              label={t('profile.overview.sharing')}
              value={
                shareConfigured ? t('profile.overview.shareable') : t('profile.overview.private')
              }
              detail={profile.visibility}
              to="/profile?tab=share"
              icon={<XivIcon name="handshake" size={14} />}
            />
            <CommandChip
              label={t('profile.overview.collections')}
              value={
                farmingCollectionCount > 0 ? `${farmingCollectionCount} farming` : 'None tracked'
              }
              detail={`${readyToBuySuggestionCount} ready to buy`}
              to="/profile?tab=collections"
              icon={<XivIcon name="goals" size={14} />}
            />
            <CommandChip
              label="Static"
              value={staticSummary}
              detail={staticDetail}
              to={staticLink}
              icon={<XivIcon name="party" size={14} />}
            />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="space-y-4 xl:order-2">
          <motion.div
            {...staggerItemProps}
            className="border-border-subtle overflow-hidden rounded-xl border"
          >
            <div
              style={{
                height: 2,
                background:
                  'linear-gradient(90deg, rgba(20,184,166,0.55) 0%, rgba(20,184,166,0.1) 55%, transparent 100%)',
              }}
            />
            <div
              className="p-3 sm:p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(20,184,166,0.05) 0%, transparent 100%)',
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-text-primary text-sm font-semibold">
                    {readyToApply
                      ? t('profile.overview.readyToApply')
                      : t('profile.overview.nextStep')}
                  </h3>
                  <p className="text-text-tertiary mt-0.5 text-xs">
                    Gear, sharing, and Static Finder
                  </p>
                </div>
                <Badge variant={readyToApply ? 'success' : 'default'} size="sm">
                  {readinessPercent}%
                </Badge>
              </div>
              <div className="bg-surface-elevated mb-3 h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${readinessPercent}%`,
                    background:
                      readinessPercent === 100
                        ? 'linear-gradient(90deg, rgba(74,222,128,0.7) 0%, #4ade80 100%)'
                        : 'linear-gradient(90deg, rgba(20,184,166,0.7) 0%, var(--color-accent) 100%)',
                    boxShadow:
                      readinessPercent === 100
                        ? '0 0 8px rgba(74,222,128,0.5)'
                        : '0 0 8px rgba(20,184,166,0.45)',
                  }}
                />
              </div>
              {incompleteSteps.length > 0 ? (
                <div className="border-status-warning/20 bg-status-warning/10 mb-3 rounded-lg border px-3 py-2">
                  <p className="text-status-warning text-xs font-medium">
                    {t('profile.overview.nextStep')}
                  </p>
                  <p className="text-text-primary text-sm">{incompleteSteps[0].label}</p>
                </div>
              ) : (
                <div className="border-status-success/20 bg-status-success/10 text-status-success mb-3 rounded-lg border px-3 py-2 text-sm">
                  {t('profile.overview.readyForStaticFinder')}
                </div>
              )}
              {readinessAction.to ? (
                <Link
                  to={readinessAction.to}
                  className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex min-h-[44px] w-full items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors sm:min-h-0"
                >
                  {readinessAction.label}
                </Link>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={readinessAction.action ?? undefined}
                  className="w-full"
                >
                  {readinessAction.label}
                </Button>
              )}

              <div className="border-border-subtle mt-3 space-y-2 border-t pt-3">
                <div className="bg-surface-elevated/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <XivIcon name="loot" size={14} className="flex-shrink-0" />
                    <span className="text-text-secondary truncate text-sm">
                      {t('profile.overview.gear')}
                    </span>
                  </div>
                  {/* design-system-ignore: Compact row action inside unified Next Actions panel */}
                  <button
                    type="button"
                    onClick={() => onNavigate('sync')}
                    className="text-accent hover:text-accent-hover text-right text-xs font-medium transition-colors"
                  >
                    {latestSnapshot ? syncHealthLabel : 'Open'}
                  </button>
                </div>
                <div className="bg-surface-elevated/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <XivIcon name="handshake" size={14} className="flex-shrink-0" />
                    <span className="text-text-secondary truncate text-sm">
                      {t('profile.overview.sharing')}
                    </span>
                  </div>
                  <Link
                    to="/profile?tab=share"
                    className="text-accent hover:text-accent-hover text-xs font-medium"
                  >
                    {shareConfigured
                      ? t('profile.overview.ready')
                      : t('profile.overview.configure')}
                  </Link>
                </div>
                <div className="bg-surface-elevated/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <XivIcon name="party" size={14} className="flex-shrink-0" />
                    <span className="text-text-secondary truncate text-sm">
                      {staticSuggestions.length > 0
                        ? t('profile.overview.staticsLookingForYou')
                        : 'Static Finder'}
                    </span>
                  </div>
                  <Link
                    to="/discover"
                    className="text-accent hover:text-accent-hover text-xs font-medium"
                  >
                    {staticSuggestions.length > 0
                      ? `${staticSuggestions.length} ${t('profile.overview.matches')}`
                      : 'Open'}
                  </Link>
                </div>
              </div>

              {completedSteps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {completedSteps.slice(0, 4).map((step) => (
                    <span
                      key={step.label}
                      className="bg-status-success/10 text-status-success inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {step.label}
                    </span>
                  ))}
                  {completedSteps.length > 4 && (
                    <span className="bg-surface-elevated text-text-tertiary rounded-full px-2 py-1 text-[11px]">
                      {t('profile.overview.more', { count: completedSteps.length - 4 })}
                    </span>
                  )}
                </div>
              )}

              {/* design-system-ignore: Compact disclosure control for readiness details */}
              <button
                type="button"
                onClick={() => setShowAllSteps(!showAllSteps)}
                className="text-text-tertiary hover:text-text-secondary mt-3 flex w-full items-center gap-1 text-xs transition-colors"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showAllSteps ? 'rotate-180' : ''}`}
                />
                {showAllSteps
                  ? t('profile.overview.hideChecklist')
                  : t('profile.overview.showChecklist')}
              </button>
              {showAllSteps && (
                <div className="border-border-subtle bg-surface-elevated/50 mt-2 space-y-1 rounded-lg border px-3 py-2">
                  {[...readinessChecks, ...optionalChecks].map((check) => (
                    <div
                      key={check.label}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className={check.done ? 'text-text-primary' : 'text-text-tertiary'}>
                        {check.label}
                      </span>
                      <span className={check.done ? 'text-status-success' : 'text-status-warning'}>
                        {check.done ? 'Done' : t('profile.overview.needed')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {staticSuggestions.length > 0 && (
            <motion.div {...staggerItemProps}>
              <DashboardCard
                title={t('profile.overview.staticFinderMatches')}
                subtitle={t('profile.overview.compactPreview')}
                icon={<Users className="h-4 w-4" />}
                footer={
                  <InlineLink to="/discover">{t('profile.overview.openStaticFinder')}</InlineLink>
                }
                className="min-h-0"
              >
                <div className="space-y-2">
                  {staticSuggestions.slice(0, 3).map((s) => (
                    <Link
                      key={s.shareCode}
                      to={`/group/${s.shareCode}`}
                      className="hover:bg-surface-elevated hover:text-accent flex items-center gap-2 rounded-lg px-1 py-1 text-sm transition-colors"
                    >
                      <span className="text-text-primary min-w-0 flex-1 truncate font-medium">
                        {s.name}
                      </span>
                      <div className="flex flex-shrink-0 flex-wrap gap-1">
                        {s.matchingJobs.slice(0, 2).map((j) => (
                          <Badge key={j} variant="info" size="sm">
                            {j}
                          </Badge>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </DashboardCard>
            </motion.div>
          )}
          <motion.div {...staggerItemProps}>
            <ActivityFeedCard items={activityItems} />
          </motion.div>
        </aside>

        <main className="space-y-4 xl:order-1">
          <motion.div {...staggerItemProps} className="space-y-3">
            <SectionLabel icon={<Target className="h-3 w-3" />}>
              {t('profile.overview.raiderSnapshot')}
            </SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DashboardCard
                title={t('profile.overview.gear')}
                subtitle="Applications and roster links"
                icon={<Briefcase className="h-4 w-4" />}
                footer={
                  <InlineLink to="/profile?tab=sync">{t('profile.overview.openSync')}</InlineLink>
                }
              >
                {latestSnapshot ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <JobIcon job={latestSnapshot.job} size="sm" />
                      <span className="text-text-primary font-medium">
                        {getJobDisplayName(latestSnapshot.job)}
                      </span>
                      <Badge variant="info" size="sm">
                        iLv {latestSnapshot.avgItemLevel}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={freshnessColor(getFreshness(latestSnapshot.syncedAt))}>
                        {formatGearActivity(latestSnapshot)}
                      </span>
                      <span className="text-text-tertiary">
                        {formatGearSourceLabel(latestSnapshot.source)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-text-primary font-medium">
                      {t('profile.overview.noGearSavedYet')}
                    </p>
                    <p className="text-text-tertiary mt-1 text-sm">
                      {t('profile.overview.syncGearForApplications')}
                    </p>
                  </div>
                )}
              </DashboardCard>

              <DashboardCard
                title={t('profile.overview.jobs')}
                subtitle={t('profile.overview.staticFinderRequestJoin')}
                icon={<Crosshair className="h-4 w-4" />}
                footer={
                  <InlineLink to="/profile?tab=jobs-gear">
                    {t('profile.overview.manageJobsAndGear')}
                  </InlineLink>
                }
              >
                {jobProfiles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {jobProfiles.slice(0, 4).map((jp) => (
                      <span
                        key={jp.id}
                        className="border-border-default bg-surface-elevated text-text-secondary hover:border-accent/30 hover:text-text-primary inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                      >
                        <JobIcon job={jp.job} size="sm" />
                        {jp.job}
                      </span>
                    ))}
                    {jobProfiles.length > 4 && (
                      <span className="text-text-muted inline-flex items-center px-2 py-1 text-xs">
                        {t('profile.overview.more', { count: jobProfiles.length - 4 })}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-text-tertiary text-sm">{t('profile.overview.noJobsAdded')}</p>
                )}
              </DashboardCard>

              <DashboardCard
                title={t('profile.overview.collections')}
                subtitle={t('profile.overview.farmRecommendations')}
                icon={<Sparkles className="h-4 w-4" />}
                footer={
                  <InlineLink to="/profile?tab=collections">
                    {t('profile.overview.openCollections')}
                  </InlineLink>
                }
              >
                {collectionGoals.length > 0 ? (
                  <div className="flex items-center gap-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-accent text-2xl leading-none font-bold">
                        {collectionGoals.filter((g) => g.status === 'active').length}
                      </span>
                      <span className="text-text-muted text-[11px]">active</span>
                    </div>
                    <div className="bg-border-subtle h-5 w-px flex-shrink-0" />
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-text-tertiary text-2xl leading-none font-semibold">
                        {collectionGoals.filter((g) => g.status === 'completed').length}
                      </span>
                      <span className="text-text-muted text-[11px]">done</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-tertiary text-sm">
                    {t('profile.overview.trackRewardProgress')}
                  </p>
                )}
              </DashboardCard>

              <DashboardCard
                title={t('profile.overview.goals')}
                subtitle={t('profile.overview.privateTasksAndReminders')}
                icon={<Target className="h-4 w-4" />}
                footer={
                  <InlineLink to="/profile?tab=goals">{t('profile.overview.addTask')}</InlineLink>
                }
              >
                {personalGoals.length > 0 ? (
                  <div className="flex items-center gap-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-accent text-2xl leading-none font-bold">
                        {personalGoals.filter((g) => g.status === 'active').length}
                      </span>
                      <span className="text-text-muted text-[11px]">active</span>
                    </div>
                    <div className="bg-border-subtle h-5 w-px flex-shrink-0" />
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-text-tertiary text-2xl leading-none font-semibold">
                        {personalGoals.filter((g) => g.status === 'completed').length}
                      </span>
                      <span className="text-text-muted text-[11px]">done</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-text-primary font-medium">
                      {t('profile.overview.noTasksYet')}
                    </p>
                    <p className="text-text-tertiary mt-1 text-sm">
                      {t('profile.overview.trackGearingClears')}
                    </p>
                  </div>
                )}
              </DashboardCard>
            </div>
          </motion.div>

          {collectionSuggestions.length > 0 && (
            <motion.div {...staggerItemProps}>
              <DashboardCard
                title={t('profile.overview.suggestedFarms')}
                subtitle={t('profile.overview.collectionProgressDetected')}
              >
                <div className="space-y-2">
                  {collectionSuggestions.slice(0, 3).map((s) => (
                    <div key={s.trialId} className="flex items-center gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-text-primary block truncate font-medium">
                          {s.mountName}
                        </span>
                        <span className="text-text-tertiary block truncate text-xs">
                          {s.dutyName}
                        </span>
                      </div>
                      {s.hasMount ? (
                        <Badge variant="success" size="sm">
                          {t('profile.overview.owned')}
                        </Badge>
                      ) : (
                        <Badge variant="info" size="sm">
                          {s.currentCount}/{s.totemTarget}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {collectionSuggestions.length > 3 && (
                    <Button variant="ghost" size="sm" onClick={() => onNavigate('collections')}>
                      {t('profile.overview.more', { count: collectionSuggestions.length - 3 })}
                    </Button>
                  )}
                </div>
              </DashboardCard>
            </motion.div>
          )}
        </main>
      </div>
    </motion.div>
  );
}
