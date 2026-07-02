import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ExternalLink, EyeOff, PlugZap, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { GearSnapshot, PlayerGoal, PlayerProfile } from '../../stores/playerProfileStore';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { toast } from '../../stores/toastStore';
import type { StaticGroupListItem } from '../../types';
import { formatRelativeTimeAgo } from './freshness';
import { hasUsableGearSnapshot, resolveJobGearSnapshot } from './jobGearUtils';

interface SyncCenterTabProps {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  goals: PlayerGoal[];
  primaryStatic?: StaticGroupListItem | null;
  staticGroups?: StaticGroupListItem[];
  onNavigate: (tab: string) => void;
  onOpenLinkModal: () => void;
}

interface SyncLogEntry {
  id: string;
  label: string;
  time: string;
}

const PLUGIN_URL = 'https://github.com/aaronbcarlisle/XIVRaidPlannerPlugin';

function StatusIcon({ status }: { status: 'ok' | 'missing' | 'info' }) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-status-success" />;
  if (status === 'missing') return <ShieldAlert className="h-4 w-4 flex-shrink-0 text-status-warning" />;
  return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-text-tertiary" />;
}

export function SyncCenterTab({
  profile,
  gearSnapshots,
  goals: _goals,
  primaryStatic,
  staticGroups = primaryStatic ? [primaryStatic] : [],
  onNavigate,
  onOpenLinkModal,
}: SyncCenterTabProps) {
  const { t, i18n } = useTranslation();
  const {
    fetchProfile,
    fetchGoals,
    fetchCollectionSuggestions,
    fetchStaticSuggestions,
    fetchGearSnapshots,
    syncing,
  } = usePlayerProfileStore();
  const { fetchPersonalAvailability } = usePersonalAvailabilityStore();
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncCompleteAt, setSyncCompleteAt] = useState(0);
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';

  const allSnapshots = useMemo(() => Object.values(gearSnapshots).flat(), [gearSnapshots]);
  const trackedJobs = useMemo(() => profile?.jobProfiles ?? [], [profile?.jobProfiles]);
  const characters = profile?.characters ?? [];

  useEffect(() => {
    fetchPersonalAvailability();
  }, [fetchPersonalAvailability]);

  const pluginSnapshots = useMemo(
    () => allSnapshots.filter((snapshot) => snapshot.source?.toLowerCase() === 'plugin' && hasUsableGearSnapshot(snapshot)),
    [allSnapshots]
  );
  const pluginConnected = pluginSnapshots.length > 0;

  const jobSnapshots = useMemo(
    () => trackedJobs.map((jobProfile) => ({ jobProfile, snapshot: resolveJobGearSnapshot(jobProfile, gearSnapshots) })),
    [trackedJobs, gearSnapshots]
  );
  const jobsWithGear = jobSnapshots.filter(({ snapshot }) => snapshot && hasUsableGearSnapshot(snapshot)).length;
  const jobsMissingGear = trackedJobs.length - jobsWithGear;

  const pluginJobCount = jobSnapshots.filter(({ snapshot }) => snapshot?.source?.toLowerCase() === 'plugin').length;
  const lodestoneJobCount = jobSnapshots.filter(({ snapshot }) => {
    const source = snapshot?.source?.toLowerCase();
    return source === 'lodestone' || source === 'xivapi' || source === 'tomestone';
  }).length;
  const manualJobCount = jobsWithGear - pluginJobCount - lodestoneJobCount;

  const latestAnySnapshot = useMemo(
    () =>
      allSnapshots
        .filter((snapshot) => hasUsableGearSnapshot(snapshot) && snapshot.syncedAt)
        .sort((left, right) => String(right.syncedAt).localeCompare(String(left.syncedAt)))[0] ?? null,
    [allSnapshots]
  );

  const syncLog = useMemo<SyncLogEntry[]>(() => {
    const bySource = new Map<string, { count: number; latestAt: string }>();
    for (const snapshot of allSnapshots) {
      if (!hasUsableGearSnapshot(snapshot) || !snapshot.syncedAt) continue;
      const key = snapshot.source?.toLowerCase() ?? 'manual';
      const entry = bySource.get(key) ?? { count: 0, latestAt: '' };
      entry.count += 1;
      const at = String(snapshot.syncedAt);
      if (!entry.latestAt || at > entry.latestAt) entry.latestAt = at;
      bySource.set(key, entry);
    }
    return Array.from(bySource.entries())
      .sort(([, left], [, right]) => right.latestAt.localeCompare(left.latestAt))
      .slice(0, 5)
      .map(([source, { count, latestAt }]) => ({
        id: source,
        label:
          source === 'plugin'
            ? t('profile.syncCenter.logPlugin', { count })
            : source === 'lodestone' || source === 'xivapi' || source === 'tomestone'
              ? t('profile.syncCenter.logLodestone', { count })
              : t('profile.syncCenter.logManual', { count }),
        time: formatRelativeTimeAgo(latestAt, uiLocale),
      }));
  }, [allSnapshots, t, uiLocale]);

  const isRefreshing = syncingAll || syncing;
  const roleLabel = (role?: string | null) => {
    switch (role) {
      case 'owner':
        return t('auth.roleOwner');
      case 'lead':
        return t('auth.roleLead');
      case 'viewer':
        return t('auth.roleViewer');
      case 'member':
      default:
        return t('auth.roleMember');
    }
  };

  const handleRefreshStatus = async () => {
    if (characters.length === 0) {
      onOpenLinkModal();
      toast.info(t('profile.syncCenter.linkCharacterFirst'));
      return;
    }

    setSyncingAll(true);
    try {
      await fetchProfile();
      await fetchGoals();
      await fetchCollectionSuggestions();
      await fetchStaticSuggestions();
      for (const character of characters) {
        try {
          await fetchGearSnapshots(character.id);
        } catch {
          // skip failed characters
        }
      }
      toast.success(t('profile.syncCenter.statusRefreshed'));
      setSyncCompleteAt(Date.now());
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-accent/20 bg-surface-raised p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-text-primary">{t('profile.tabSync')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              {t('profile.syncCenter.headerDesc')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <motion.div
                key={`plugin-badge-${syncCompleteAt}`}
                initial={{ scale: 1 }}
                animate={syncCompleteAt > 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Badge variant={pluginConnected ? 'success' : 'warning'} size="sm" data-testid="plugin-status-badge">
                  {pluginConnected ? t('profile.syncCenter.pluginConnected') : t('profile.syncCenter.pluginNotConnected')}
                </Badge>
              </motion.div>
              {latestAnySnapshot?.syncedAt && (
                <motion.div
                  key={`gear-badge-${syncCompleteAt}`}
                  initial={{ scale: 1 }}
                  animate={syncCompleteAt > 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                >
                  <Badge variant="info" size="sm" data-testid="last-gear-badge">
                    {t('profile.syncCenter.lastGear', { time: formatRelativeTimeAgo(latestAnySnapshot.syncedAt, uiLocale) })}
                  </Badge>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:min-w-[220px]">
            {pluginConnected ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleRefreshStatus}
                loading={isRefreshing}
                leftIcon={<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
                data-testid="plugin-primary-cta"
              >
                {t('profile.syncCenter.refreshStatus')}
              </Button>
            ) : (
              <a
                href={PLUGIN_URL}
                target="_blank"
                rel="noreferrer"
                data-testid="plugin-primary-cta"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition-all duration-fast hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base sm:min-h-0"
              >
                <ExternalLink className="h-4 w-4" />
                {t('profile.syncCenter.getPlugin')}
              </a>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={() => onNavigate('jobs-gear')}>
              {t('profile.syncCenter.editManually')}
            </Button>
          </div>
        </div>

        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-elevated/40 px-3 py-2"
          data-testid="character-identity-row"
        >
          <div className="flex min-w-0 items-center gap-2">
            <StatusIcon status={characters.length > 0 ? 'ok' : 'missing'} />
            <span className="min-w-0 truncate text-sm text-text-secondary">
              {characters.length > 0
                ? characters.map((character) => `${character.name} · ${character.server}`).join(', ')
                : t('profile.syncCenter.noCharacterLinked')}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onOpenLinkModal}
            className="min-h-0 flex-shrink-0 px-0 py-0 text-xs font-medium"
          >
            {characters.length > 0 ? t('common.manage') : t('profile.syncCenter.link')}
          </Button>
        </div>
      </section>

      {!pluginConnected && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
              <PlugZap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.syncCenter.setupAutoSync')}</h3>
              <p className="mt-1 text-sm text-text-secondary">
                {t('profile.syncCenter.setupAutoSyncDesc')}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="sync-sources-section">
        <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.syncCenter.syncSources')}</h3>
        <p className="mt-0.5 text-xs text-text-tertiary">
          {t('profile.syncCenter.syncSourcesDesc')}
        </p>
        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0">
          {[
            { label: t('profile.syncCenter.sourcePlugin'), desc: t('profile.syncCenter.sourcePluginDesc'), active: pluginConnected },
            { label: t('profile.syncCenter.sourceLodestone'), desc: t('profile.syncCenter.sourceLodestoneDesc'), active: characters.length > 0 },
            { label: t('profile.syncCenter.sourceManual'), desc: t('profile.syncCenter.sourceManualDesc'), active: true },
          ].map((source, index, all) => (
            <div key={source.label} className="flex items-center gap-1.5 sm:gap-0">
              <div
                className={`flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2 ${
                  source.active ? 'border-accent/30 bg-accent/5' : 'border-border-subtle bg-surface-elevated/40'
                }`}
              >
                <span className={`text-xs font-medium ${source.active ? 'text-accent' : 'text-text-tertiary'}`}>
                  {source.label}
                </span>
                <span className="text-xs text-text-tertiary">{source.desc}</span>
              </div>
              {index < all.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-text-tertiary sm:mx-1.5" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated/50 px-3 py-2 text-xs text-text-tertiary">
          <span className="font-medium text-text-secondary">{t('profile.syncCenter.lodestoneFallbackTitle')}:</span>{' '}
          {t('profile.syncCenter.lodestoneFallbackDesc')}
        </p>
      </section>

      {trackedJobs.length > 0 && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="sync-coverage-section">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.syncCenter.syncCoverage')}</h3>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {t('profile.syncCenter.coverageDesc', { jobsWithGear, trackedJobs: trackedJobs.length })}
                {jobsMissingGear > 0 ? ` ${t('profile.syncCenter.coverageMissing', { jobsMissingGear })}` : ''}{' '}
                {t('profile.syncCenter.coverageReadiness')}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('jobs-gear')}
              data-testid="view-jobs-cta"
            >
              {t('profile.syncCenter.viewInJobsGear')}
            </Button>
          </div>
          {jobsWithGear > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" data-testid="source-distribution">
              {pluginJobCount > 0 && (
                <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  {t('profile.syncCenter.sourcePlugin')} · {pluginJobCount}
                </span>
              )}
              {lodestoneJobCount > 0 && (
                <span className="rounded-full border border-border-subtle bg-surface-elevated/60 px-2.5 py-0.5 text-xs text-text-secondary">
                  {t('profile.syncCenter.sourceLodestone')} · {lodestoneJobCount}
                </span>
              )}
              {manualJobCount > 0 && (
                <span className="rounded-full border border-border-subtle bg-surface-elevated/60 px-2.5 py-0.5 text-xs text-text-secondary">
                  {t('profile.syncCenter.sourceManual')} · {manualJobCount}
                </span>
              )}
              {jobsMissingGear > 0 && (
                <span className="rounded-full border border-status-warning/20 bg-status-warning/10 px-2.5 py-0.5 text-xs text-status-warning">
                  {t('profile.syncCenter.missing')} · {jobsMissingGear}
                </span>
              )}
            </div>
          )}
          <p className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated/50 px-3 py-2 text-xs text-text-tertiary">
            {t('profile.syncCenter.applicationSnapshotNote')}
          </p>
        </section>
      )}

      {syncLog.length > 0 && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="sync-log-section">
          <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.syncCenter.syncLog')}</h3>
          <div className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {syncLog.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.14 } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-elevated/50 px-3 py-2"
                  data-testid="sync-log-entry"
                >
                  <span className="text-sm text-text-secondary">{entry.label}</span>
                  <span className="flex-shrink-0 text-xs text-text-tertiary">{entry.time}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="privacy-section">
        <div className="flex items-start gap-3">
          <EyeOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-tertiary" />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.syncCenter.privacy')}</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {t('profile.syncCenter.privacyDesc')}
            </p>
          </div>
        </div>
      </section>

      {staticGroups.length > 0 && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.syncCenter.rosterLinks')}</h3>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {t('profile.syncCenter.connectedStatics', { count: staticGroups.length })}
          </p>
          <div className="mt-2 space-y-1">
            {staticGroups.map((group) => (
              <a
                key={group.id}
                href={`/group/${group.shareCode}`}
                className="block rounded-lg bg-surface-elevated/60 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-elevated"
              >
                {group.name}
                <span className="ml-2 text-xs text-text-tertiary">{roleLabel(group.userRole)}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
