import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ExternalLink, EyeOff, PlugZap, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { GearSnapshot, PlayerGoal, PlayerProfile } from '../../stores/playerProfileStore';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { toast } from '../../stores/toastStore';
import type { StaticGroupListItem } from '../../types';
import { formatSyncAge } from './freshness';
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
  latestAt: string;
}

const PLUGIN_URL = 'https://github.com/aaronbcarlisle/XIVRaidPlannerPlugin';

function deriveSyncLog(allSnapshots: GearSnapshot[]): SyncLogEntry[] {
  const bySource = new Map<string, { count: number; latestAt: string }>();
  for (const snap of allSnapshots) {
    if (!hasUsableGearSnapshot(snap) || !snap.syncedAt) continue;
    const key = snap.source?.toLowerCase() ?? 'manual';
    const entry = bySource.get(key) ?? { count: 0, latestAt: '' };
    entry.count += 1;
    const at = String(snap.syncedAt);
    if (!entry.latestAt || at > entry.latestAt) entry.latestAt = at;
    bySource.set(key, entry);
  }
  return Array.from(bySource.entries())
    .sort(([, a], [, b]) => b.latestAt.localeCompare(a.latestAt))
    .slice(0, 5)
    .map(([source, { count, latestAt }]) => ({
      id: source,
      label:
        source === 'plugin'
          ? `Plugin synced ${count} job gearset${count === 1 ? '' : 's'}`
          : source === 'lodestone'
          ? `Lodestone updated ${count} job${count === 1 ? '' : 's'}`
          : `Manually updated ${count} job gearset${count === 1 ? '' : 's'}`,
      time: formatSyncAge(latestAt),
      latestAt,
    }));
}

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

  useEffect(() => {
    fetchPersonalAvailability();
  }, [fetchPersonalAvailability]);

  const allSnapshots = useMemo(() => Object.values(gearSnapshots).flat(), [gearSnapshots]);
  const trackedJobs = profile?.jobProfiles ?? [];
  const characters = profile?.characters ?? [];

  const pluginSnapshots = useMemo(
    () => allSnapshots.filter((s) => s.source?.toLowerCase() === 'plugin' && hasUsableGearSnapshot(s)),
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
  const lodestoneJobCount = jobSnapshots.filter(({ snapshot }) => snapshot?.source?.toLowerCase() === 'lodestone').length;
  const manualJobCount = jobsWithGear - pluginJobCount - lodestoneJobCount;

  const latestAnySnapshot = useMemo(
    () =>
      allSnapshots
        .filter((s) => hasUsableGearSnapshot(s) && s.syncedAt)
        .sort((a, b) => String(b.syncedAt).localeCompare(String(a.syncedAt)))[0] ?? null,
    [allSnapshots]
  );

  const syncLog = useMemo(() => deriveSyncLog(allSnapshots), [allSnapshots]);

  const isRefreshing = syncingAll || syncing;

  const handleRefreshStatus = async () => {
    if (characters.length === 0) {
      onOpenLinkModal();
      toast.info('Link a character before checking gear status.');
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
          // Character gear fetch failed, skip
        }
      }
      toast.success('Status refreshed');
      setSyncCompleteAt(Date.now());
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Section 1 — Sync Status */}
      <section className="rounded-lg border border-accent/20 bg-surface-raised p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-text-primary">Sync</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Use the plugin to keep jobs and gear updated automatically. Gear can also be entered manually in Jobs &amp; Gear.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <motion.div
                key={`plugin-badge-${syncCompleteAt}`}
                initial={{ scale: 1 }}
                animate={syncCompleteAt > 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Badge variant={pluginConnected ? 'success' : 'warning'} size="sm" data-testid="plugin-status-badge">
                  {pluginConnected ? 'Plugin connected' : 'Plugin not connected'}
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
                    Last gear: {formatSyncAge(latestAnySnapshot.syncedAt)}
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
                Refresh status
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
                Get the plugin
              </a>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={() => onNavigate('jobs-gear')}>
              Edit manually
            </Button>
          </div>
        </div>

        {/* Character identity inline */}
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-elevated/40 px-3 py-2"
          data-testid="character-identity-row"
        >
          <div className="flex min-w-0 items-center gap-2">
            <StatusIcon status={characters.length > 0 ? 'ok' : 'missing'} />
            <span className="min-w-0 truncate text-sm text-text-secondary">
              {characters.length > 0
                ? characters.map((c) => `${c.name} · ${c.server}`).join(', ')
                : 'No character linked — sync requires a linked character'}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenLinkModal}
            className="flex-shrink-0 text-xs font-medium text-accent hover:text-accent-hover"
          >
            {characters.length > 0 ? 'Manage' : 'Link'}
          </button>
        </div>
      </section>

      {/* Plugin setup (only when not connected) */}
      {!pluginConnected && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
              <PlugZap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-text-primary">Set up automatic sync</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Install the XIVRaidPlannerPlugin to sync your saved gearsets into Jobs &amp; Gear.
                Each sync reads all gearsets saved in-game and uploads them in one batch.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Section 2 — Sync Sources */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="sync-sources-section">
        <h3 className="font-display text-sm font-semibold text-text-primary">Sync Sources</h3>
        <p className="mt-0.5 text-xs text-text-tertiary">
          Gear data is resolved in priority order — Plugin overrides Lodestone, Lodestone overrides manual entry.
        </p>
        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0">
          {[
            { label: 'Plugin', desc: 'Saved gearsets from game', active: pluginConnected },
            { label: 'Lodestone', desc: 'Public character page', active: characters.length > 0 },
            { label: 'Manual', desc: 'Entered in Jobs & Gear', active: true },
          ].map((source, i, arr) => (
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
              {i < arr.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-text-tertiary sm:mx-1.5" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated/50 px-3 py-2 text-xs text-text-tertiary">
          <span className="font-medium text-text-secondary">Lodestone fallback:</span>{' '}
          When plugin data is missing or stale, gear from your public Lodestone profile is used automatically.
          Make sure your character page is set to public for fallback to work.
        </p>
      </section>

      {/* Section 3 — Sync Coverage */}
      {trackedJobs.length > 0 && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="sync-coverage-section">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-text-primary">Sync Coverage</h3>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {jobsWithGear} of {trackedJobs.length} tracked job{trackedJobs.length === 1 ? '' : 's'} have gear.
                {jobsMissingGear > 0 ? ` ${jobsMissingGear} missing.` : ''}{' '}
                Readiness is managed in Jobs &amp; Gear.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('jobs-gear')}
              data-testid="view-jobs-cta"
            >
              View in Jobs & Gear
            </Button>
          </div>
          {jobsWithGear > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" data-testid="source-distribution">
              {pluginJobCount > 0 && (
                <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  Plugin · {pluginJobCount}
                </span>
              )}
              {lodestoneJobCount > 0 && (
                <span className="rounded-full border border-border-subtle bg-surface-elevated/60 px-2.5 py-0.5 text-xs text-text-secondary">
                  Lodestone · {lodestoneJobCount}
                </span>
              )}
              {manualJobCount > 0 && (
                <span className="rounded-full border border-border-subtle bg-surface-elevated/60 px-2.5 py-0.5 text-xs text-text-secondary">
                  Manual · {manualJobCount}
                </span>
              )}
              {jobsMissingGear > 0 && (
                <span className="rounded-full border border-status-warning/20 bg-status-warning/10 px-2.5 py-0.5 text-xs text-status-warning">
                  Missing · {jobsMissingGear}
                </span>
              )}
            </div>
          )}
          <p className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated/50 px-3 py-2 text-xs text-text-tertiary">
            When you apply to a static, the request captures your selected job and gear at that moment.
            Later profile changes will not rewrite old applications.
          </p>
        </section>
      )}

      {/* Section 4 — Sync Log */}
      {syncLog.length > 0 && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="sync-log-section">
          <h3 className="font-display text-sm font-semibold text-text-primary">Sync Log</h3>
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

      {/* Section 5 — Privacy */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-4" data-testid="privacy-section">
        <div className="flex items-start gap-3">
          <EyeOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-tertiary" />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-text-primary">Privacy</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Plugin sync activity appears in your static's overview feed as{' '}
              <span className="font-medium text-text-primary">"A member synced"</span> — your name is not
              shown to other members. Aggregate updates use a system label with no actor name.
            </p>
          </div>
        </div>
      </section>

      {/* Roster links */}
      {staticGroups.length > 0 && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="font-display text-sm font-semibold text-text-primary">Roster links</h3>
          <p className="mt-0.5 text-xs text-text-tertiary">
            Connected to {staticGroups.length} static{staticGroups.length === 1 ? '' : 's'}.
          </p>
          <div className="mt-2 space-y-1">
            {staticGroups.map((sg) => (
              <a
                key={sg.id}
                href={`/group/${sg.shareCode}`}
                className="block rounded-lg bg-surface-elevated/60 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-elevated"
              >
                {sg.name}
                <span className="ml-2 text-xs text-text-tertiary">{sg.userRole ?? 'Member'}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
