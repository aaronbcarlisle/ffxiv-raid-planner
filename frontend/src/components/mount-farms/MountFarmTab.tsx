import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, Info, User, Filter, Activity, X, ExternalLink } from 'lucide-react';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { XivIcon } from '../ui/XivIcon';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import type { MountFarmData, TrialSummary } from '../../stores/mountFarmStore';
import { EXPANSIONS, getTrialsByExpansion, getAllTrialIds, getTrialById, getCurrencyLabelPlural, getRewardNoun, hasCurrencyTracking } from '../../gamedata';
import type { Expansion, MountFarmTrial } from '../../gamedata';
import { MountFarmSummary } from './MountFarmSummary';
import { Skeleton } from '../ui/Skeleton';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Button } from '../primitives/Button';
import { Tooltip } from '../primitives/Tooltip';
import {
  getLocalizedTrialDutyName,
  getLocalizedTrialRewardName,
  getLocalizedExpansionName,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';

const MOUNT_FARM_VIEWS = ['group', 'my-progress'] as const;
type ViewMode = (typeof MOUNT_FARM_VIEWS)[number];
type FilterMode = 'all' | 'needs-mount' | 'can-buy' | 'wanted' | 'complete';

interface MountFarmTabProps {
  groupId: string;
  userRole: string | null;
  onScheduleFarm?: (trial: MountFarmTrial) => void;
}

function filterTrials(
  trials: MountFarmTrial[],
  trialSummaryMap: Map<string, TrialSummary>,
  filter: FilterMode,
  currentUserId: string | null,
  viewMode: ViewMode,
): MountFarmTrial[] {
  if (filter === 'all') return trials;

  return trials.filter(trial => {
    const summary = trialSummaryMap.get(trial.id);
    if (!summary) return filter === 'needs-mount';

    if (viewMode === 'my-progress' && currentUserId) {
      const myProgress = summary.memberProgress.find(mp => mp.userId === currentUserId);
      const exchangeCost = trial.exchangeCost ?? trial.totemTarget;
      switch (filter) {
        case 'needs-mount': return !myProgress?.hasMount;
        case 'can-buy': return !myProgress?.hasMount && exchangeCost > 0 && (myProgress?.totemCount ?? 0) >= exchangeCost;
        case 'wanted': return !myProgress?.hasMount && (myProgress?.wantsMount ?? true);
        case 'complete': return myProgress?.hasMount === true;
        default: return true;
      }
    }

    switch (filter) {
      case 'needs-mount': return summary.membersMissing > 0;
      case 'can-buy': return summary.membersCanBuy > 0;
      case 'wanted': return summary.membersWanting > 0;
      case 'complete': return summary.membersMissing === 0 && summary.membersComplete > 0;
      default: return true;
    }
  });
}

export function MountFarmTab({ groupId, userRole, onScheduleFarm }: MountFarmTabProps) {
  const { t, i18n } = useTranslation();
  const [selectedExpansion, setSelectedExpansion] = useState<Expansion>('DT');
  const [viewMode, setViewMode] = useUrlTabState('mf', MOUNT_FARM_VIEWS, 'group');
  const [activeFilter, setActiveFilter] = useState<FilterMode>('all');
  const { data, recommendations, isLoading, isLoadingRecs, error, fetchProgress, fetchRecommendations } = useMountFarmStore();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);

  const allTrials = getTrialsByExpansion(selectedExpansion);

  useEffect(() => {
    // Skip member-only endpoints for applicants / non-members to avoid 403 toasts.
    if (groupId && userRole) {
      const trialIds = getAllTrialIds();
      fetchProgress(groupId, trialIds);
      fetchRecommendations(groupId);
    }
  }, [groupId, userRole, fetchProgress, fetchRecommendations]);

  const handleRefresh = () => {
    const trialIds = getAllTrialIds();
    fetchProgress(groupId, trialIds);
    fetchRecommendations(groupId, selectedExpansion);
  };

  const trialSummaryMap = useMemo(() => new Map(
    (data?.trials ?? []).map(t => [t.trialId, t])
  ), [data?.trials]);

  // Plugin CTA dismiss state
  const ctaDismissKey = `mount-farm-plugin-cta-dismissed-${groupId}`;
  const [ctaDismissed, setCtaDismissed] = useState(() => {
    try { return localStorage.getItem(ctaDismissKey) === '1'; } catch { return false; }
  });
  const dismissCta = useCallback(() => {
    setCtaDismissed(true);
    try { localStorage.setItem(ctaDismissKey, '1'); } catch { /* ignore */ }
  }, [ctaDismissKey]);

  // Sync status for current user
  const syncStatus = useMemo(() => {
    if (!data?.currentUserId || !data.trials.length) return null;

    let lastPluginSync: string | null = null;
    let hasPluginData = false;
    let hasManualData = false;
    let mountsDetected = 0;
    const totemTrialIds = new Set<string>();
    let manualOverrides = 0;

    for (const trial of data.trials) {
      for (const mp of trial.memberProgress) {
        if (mp.userId !== data.currentUserId) continue;
        if (mp.ownershipSource === 'plugin' || mp.totemSource === 'plugin') {
          hasPluginData = true;
          if (mp.lastPluginSyncAt && (!lastPluginSync || mp.lastPluginSyncAt > lastPluginSync)) {
            lastPluginSync = mp.lastPluginSyncAt;
          }
          if (mp.ownershipSource === 'plugin' && mp.hasMount) mountsDetected++;
          if (mp.totemSource === 'plugin' && mp.totemCount > 0) totemTrialIds.add(mp.trialId);
        }
        if (mp.ownershipSource === 'manual' || mp.totemSource === 'manual') {
          hasManualData = true;
        }
        if (mp.lastManualOverrideAt) manualOverrides++;
      }
    }

    return { lastPluginSync, hasPluginData, hasManualData, mountsDetected, totemTypesFound: totemTrialIds.size, manualOverrides };
  }, [data]);

  // My progress stats
  const myStats = useMemo(() => {
    if (!data?.currentUserId) return null;

    let total = 0, owned = 0, wanted = 0, canBuy = 0;
    for (const trial of data.trials) {
      for (const mp of trial.memberProgress) {
        if (mp.userId !== data.currentUserId) continue;
        total++;
        if (mp.hasMount) owned++;
        else {
          if (mp.wantsMount) wanted++;
          const trialInfo = getTrialById(mp.trialId);
          const exchangeCost = trialInfo ? (trialInfo.exchangeCost ?? trialInfo.totemTarget) : 0;
          if (exchangeCost > 0 && mp.totemCount >= exchangeCost) canBuy++;
        }
      }
    }
    return { total, owned, wanted, canBuy };
  }, [data]);

  // Filter trials
  const filteredTrials = useMemo(
    () => filterTrials(allTrials, trialSummaryMap, activeFilter, data?.currentUserId ?? null, viewMode),
    [allTrials, trialSummaryMap, activeFilter, data?.currentUserId, viewMode]
  );

  if (error) {
    return <ErrorMessage message={error} onRetry={handleRefresh} retrying={isLoading} />;
  }

  const topRec = recommendations[0];
  const topRecTrial = topRec ? getTrialById(topRec.trialId) : null;
  const localizedTopRecDutyName = getLocalizedTrialDutyName(topRecTrial, uiLocale);
  const localizedTopRecRewardName = getLocalizedTrialRewardName(topRecTrial, uiLocale);
  const canManage = userRole === 'owner' || userRole === 'lead';
  const isJapanese = uiLocale.startsWith('ja');

  const expansionComplete = allTrials.reduce((count, trial) => {
    const summary = trialSummaryMap.get(trial.id);
    if (!summary) return count;
    return summary.membersMissing === 0 && summary.membersComplete > 0 ? count + 1 : count;
  }, 0);

  const FILTERS: { id: FilterMode; label: string; count?: number }[] = [
    { id: 'all', label: t('mountFarm.filterAll') },
    { id: 'needs-mount', label: t('mountFarm.filterNeedsReward') },
    { id: 'wanted', label: t('mountFarm.filterWanted') },
    { id: 'can-buy', label: t('mountFarm.filterCanBuy') },
    { id: 'complete', label: t('mountFarm.filterComplete') },
  ];

  return (
    <div className="space-y-5">
      {/* Plugin onboarding CTA — shown when no plugin data and not dismissed */}
      {syncStatus && !syncStatus.hasPluginData && !ctaDismissed && !isLoading && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2 text-blue-400 flex-shrink-0">
              <Plug className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-semibold text-text-primary">{t('mountFarm.automateTracking')}</p>
                <Button onClick={dismissCta} className="text-text-tertiary hover:text-text-secondary transition-colors p-0.5 -m-0.5" aria-label={isJapanese ? '閉じる' : 'Dismiss'}> {/* design-system-ignore: Dismiss X requires specific styling */}
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {t('mountFarm.pluginSetup')}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <a
                  href="https://github.com/aaronbcarlisle/XIVRaidPlannerPlugin#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t('mountFarm.setupPlugin')}
                </a>
                <span className="text-text-tertiary text-xs">·</span>
                <span className="text-xs text-text-tertiary">
                  {t('mountFarm.syncInGame')}
                </span>
                <span className="text-text-tertiary text-xs">·</span>
                <Button onClick={dismissCta} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"> {/* design-system-ignore: Inline text action */}
                  {t('mountFarm.trackManually')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact plugin sync status — shown when plugin data exists */}
      {syncStatus?.hasPluginData && !isLoading && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 flex items-center gap-2 text-xs flex-wrap">
          <Plug className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-text-secondary">
            {t('mountFarm.pluginSynced', { timeAgo: syncStatus.lastPluginSync ? timeAgo(syncStatus.lastPluginSync, uiLocale) : '' })}
          </span>
          {syncStatus.mountsDetected > 0 && (
            <>
              <span className="text-text-tertiary">&middot;</span>
              <span className="text-text-secondary">{t('mountFarm.mountsDetected', { count: syncStatus.mountsDetected })}</span>
            </>
          )}
          {syncStatus.totemTypesFound > 0 && (
            <>
              <span className="text-text-tertiary">&middot;</span>
              <span className="text-text-secondary">{t('mountFarm.totemTypesFound', { count: syncStatus.totemTypesFound })}</span>
            </>
          )}
          {syncStatus.manualOverrides > 0 && (
            <>
              <span className="text-text-tertiary">&middot;</span>
              <Tooltip content={t('mountFarm.manualOverridesDesc')}>
                <span className="inline-flex items-center gap-1 text-text-tertiary">
                  <Info className="w-3 h-3" />
                  {t('mountFarm.manualOverrides', { count: syncStatus.manualOverrides })}
                </span>
              </Tooltip>
            </>
          )}
        </div>
      )}

      {/* Fallback when no sync and CTA dismissed */}
      {syncStatus && !syncStatus.hasPluginData && ctaDismissed && !isLoading && (
        <div className="rounded-lg bg-surface-elevated border border-border-default px-3 py-2 flex items-center gap-2 text-xs">
          <Info className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
          <span className="text-text-tertiary">{t('mountFarm.pluginUnavailable')}</span>
        </div>
      )}

      {/* Suggested Farms integration notice */}
      {!isLoading && (
        <div className="rounded-lg border border-border-subtle bg-surface-raised/40 px-3 py-2 flex flex-col gap-1 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
            <span>
              {isJapanese ? (
                <>
                  ここで <strong className="text-text-secondary font-medium">希望</strong> を切り替えると、
                  <strong className="text-text-secondary font-medium">おすすめ周回</strong>
                  を通じて固定にも共有されます。
                </>
              ) : (
                <>
                  Toggling <strong className="text-text-secondary font-medium">Wanted</strong> here
                  also shares your intent with your statics via{' '}
                  <strong className="text-text-secondary font-medium">Suggested Farms</strong>.
                </>
              )}
            </span>
          </div>
          <ul className="pl-5 space-y-0.5 text-[11px] opacity-70">
            {isJapanese ? (
              <>
                <li>共有した報酬は固定のおすすめ周回に反映されます。</li>
                <li>公開した報酬はプロフィールにも表示されます。</li>
                <li>非公開の報酬は自分だけに表示されます。公開範囲はプレイヤーハブで変更できます。</li>
              </>
            ) : (
              <>
                <li>Shared rewards feed Suggested Farms for your statics.</li>
                <li>Public rewards can appear on your dossier.</li>
                <li>Private rewards stay personal — change visibility in Player Hub.</li>
              </>
            )}
          </ul>
        </div>
      )}

      {/* Farm Planner hero — top recommendation */}
      {topRec && topRecTrial && !isLoadingRecs && !isLoading && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <XivIcon name="crystal" size={20} className="flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-display font-semibold text-text-primary truncate">
                  {t('mountFarm.bestNextFarm', { dutyName: localizedTopRecDutyName })}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {topRec.membersWanting > 0 && <>{isJapanese ? `${topRec.membersWanting}人が${localizedTopRecRewardName}を希望` : `${topRec.membersWanting} member${topRec.membersWanting > 1 ? 's' : ''} want${topRec.membersWanting === 1 ? 's' : ''} this ${getRewardNoun(topRecTrial)}`}</>}
                  {topRec.membersWanting > 0 && topRec.membersCanBuy > 0 && ' · '}
                  {topRec.membersCanBuy > 0 && <>{isJapanese ? `${topRec.membersCanBuy}人が${getCurrencyLabelPlural(topRecTrial)}で交換可能` : `${topRec.membersCanBuy} can buy with ${getCurrencyLabelPlural(topRecTrial)}`}</>}
                  {(topRec.membersWanting > 0 || topRec.membersCanBuy > 0) && topRec.membersCloseToTarget > 0 && ' · '}
                  {topRec.membersCloseToTarget > 0 && hasCurrencyTracking(topRecTrial) && <>{isJapanese ? `${topRec.membersCloseToTarget}人が${topRecTrial.exchangeCost ?? topRecTrial.totemTarget}${getCurrencyLabelPlural(topRecTrial)}に近い` : `${topRec.membersCloseToTarget} close to ${topRecTrial.exchangeCost ?? topRecTrial.totemTarget} ${getCurrencyLabelPlural(topRecTrial)}`}</>}
                </p>
                <p className="text-[11px] text-text-tertiary mt-0.5">
                  {isJapanese
                    ? `${topRec.membersMissing}/${topRec.membersMissing + (trialSummaryMap.get(topRec.trialId)?.membersComplete ?? 0)}人がまだ${localizedTopRecRewardName}を必要としています`
                    : `${topRec.membersMissing} of ${(topRec.membersMissing + (trialSummaryMap.get(topRec.trialId)?.membersComplete ?? 0))} members still need ${localizedTopRecRewardName}`}
                </p>
              </div>
            </div>
            {onScheduleFarm && canManage && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onScheduleFarm(topRecTrial)}
              >
                <XivIcon name="schedule" size={16} />
                {topRecTrial.contentType === 'ultimate' ? t('mountFarm.schedule') : t('mountFarm.scheduleFarm')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* View toggle + Expansion tabs row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Group / My Progress toggle */}
        <div className="flex bg-surface-raised rounded-lg p-0.5 gap-0.5">
          {/* design-system-ignore: View toggle requires specific styling */}
          <button
            onClick={() => setViewMode('group')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'group' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <XivIcon name="party" size={14} />
            {t('mountFarm.tabStatic')}
          </button>
          {/* design-system-ignore: View toggle requires specific styling */}
          <button
            onClick={() => setViewMode('my-progress')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'my-progress' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            {t('mountFarm.tabMyProgress')}
          </button>
        </div>

        {/* Expansion tabs */}
        <div className="flex flex-wrap gap-1 bg-surface-raised rounded-lg p-1 flex-1 min-w-0">
          {EXPANSIONS.map(exp => {
            const expTrials = getTrialsByExpansion(exp.id);
            const expComplete = expTrials.reduce((count, trial) => {
              const summary = trialSummaryMap.get(trial.id);
              if (!summary) return count;
              return summary.membersMissing === 0 && summary.membersComplete > 0 ? count + 1 : count;
            }, 0);

            return (
              /* design-system-ignore: Expansion tab requires specific toggle styling */
              <button
                key={exp.id}
                onClick={() => setSelectedExpansion(exp.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors border text-xs
                  ${selectedExpansion === exp.id
                    ? 'bg-accent/20 text-accent border-accent/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-transparent'
                  }
                `}
              >
                <span>{exp.shortName}</span>
                {expComplete > 0 && (
                  <span className="text-[10px] text-text-tertiary">{expComplete}/{expTrials.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* My Progress summary cards */}
      {viewMode === 'my-progress' && myStats && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('mountFarm.rewardsObtained')} value={myStats.owned} total={myStats.total} color="text-status-success" />
          <StatCard label={t('mountFarm.wanted')} value={myStats.wanted} color="text-accent" />
          <StatCard label={t('mountFarm.ready')} value={myStats.canBuy} color="text-amber-400" />
          <StatCard label={t('mountFarm.lastSync')} value={syncStatus?.lastPluginSync ? timeAgo(syncStatus.lastPluginSync, uiLocale) : t('common.never')} isText color="text-text-secondary" />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-text-tertiary" />
        {FILTERS.map(f => (
          /* design-system-ignore: Filter chip requires specific styling */
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === f.id
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <XivIcon name="goals" size={16} />
        <div className="flex-1">
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <span>{t('mountFarm.completion', { expansionName: getLocalizedExpansionName(selectedExpansion, i18n.resolvedLanguage) })}</span>
            <span>{t('mountFarm.farmsComplete', { complete: expansionComplete, total: allTrials.length })}</span>
          </div>
          <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${allTrials.length > 0 ? (expansionComplete / allTrials.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trial list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : filteredTrials.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-sm">
            {activeFilter !== 'all'
              ? t('mountFarm.noTrials', { filterLabel: FILTERS.find(f => f.id === activeFilter)?.label })
              : t('mountFarm.noTrialsAvailable')}
          </p>
          {activeFilter !== 'all' && (
            /* design-system-ignore: Clear filter link requires specific styling */
            <button
              onClick={() => setActiveFilter('all')}
              className="text-xs text-accent hover:underline mt-2"
            >
              {t('mountFarm.clearFilter')}
            </button>
          )}
        </div>
      ) : (
        <MountFarmSummary
          trials={filteredTrials}
          trialSummaryMap={trialSummaryMap}
          currentUserId={data?.currentUserId ?? null}
          groupId={groupId}
          canManage={canManage}
          viewMode={viewMode}
          onScheduleFarm={onScheduleFarm}
          onRefresh={handleRefresh}
        />
      )}

      {/* Needs attention */}
      {!isLoading && data && <NeedsAttention data={data} trialSummaryMap={trialSummaryMap} />}

      {/* Recent activity */}
      {!isLoading && data && data.trials.length > 0 && (
        <RecentActivity data={data} />
      )}
    </div>
  );
}

function StatCard({ label, value, total, color, isText }: {
  label: string;
  value: number | string;
  total?: number;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-3">
      <p className="text-[11px] text-text-tertiary uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-display font-bold ${color} mt-0.5`}>
        {isText ? value : <>{value}{total != null && <span className="text-sm text-text-tertiary font-normal">/{total}</span>}</>}
      </p>
    </div>
  );
}

function timeAgo(iso: string, locale = 'en-US'): string {
  const age = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(age / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 1) {
    return locale.startsWith('ja') ? 'たった今' : 'just now';
  }
  if (minutes < 60) {
    return rtf.format(-minutes, 'minute');
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return rtf.format(-hours, 'hour');
  }
  return rtf.format(-Math.floor(hours / 24), 'day');
}

interface ActivityItem {
  trialId: string;
  action: string;
  source: string;
  updatedAt: string;
}

function NeedsAttention({ data, trialSummaryMap }: { data: MountFarmData; trialSummaryMap: Map<string, TrialSummary> }) {
  const alerts = useMemo(() => {
    const items: { label: string; color: string }[] = [];

    // Count members who can buy mounts right now
    let totalCanBuy = 0;
    for (const trial of data.trials) {
      totalCanBuy += trial.membersCanBuy;
    }
    if (totalCanBuy > 0) {
      items.push({ label: `${totalCanBuy} reward${totalCanBuy > 1 ? 's' : ''} ready with exchange currency`, color: 'text-amber-400' });
    }

    // Count trials where the current user has no data yet
    if (data.currentUserId) {
      let noData = 0;
      for (const [, summary] of trialSummaryMap) {
        const myProgress = summary.memberProgress.find(mp => mp.userId === data.currentUserId);
        if (!myProgress) noData++;
      }
      if (noData > 5) {
        items.push({ label: `${noData} trials not yet tracked — sync or update manually`, color: 'text-text-secondary' });
      }
    }

    return items;
  }, [data, trialSummaryMap]);

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((alert, i) => (
        <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-default text-xs ${alert.color}`}>
          {alert.label}
        </span>
      ))}
    </div>
  );
}

function RecentActivity({ data }: { data: MountFarmData }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);

  const activities = useMemo(() => {
    const items: ActivityItem[] = [];

    for (const trial of data.trials) {
      for (const mp of trial.memberProgress) {
        if (!mp.updatedAt) continue;
        const trialInfo = getTrialById(mp.trialId);
        const actorName = mp.displayName || t('mountFarm.member');
        const trialLabel = getLocalizedTrialDutyName(trialInfo, uiLocale) || mp.trialId;
        const rewardLabel = getLocalizedTrialRewardName(trialInfo, uiLocale) || trialLabel;

        let action = '';
        if (mp.hasMount) {
          action = t('mountFarm.activityObtained', { actor: actorName, reward: rewardLabel });
        } else if (mp.totemCount > 0) {
          action = t('mountFarm.activityCurrencyUpdated', { actor: actorName, duty: trialLabel, count: mp.totemCount });
        } else if (!mp.wantsMount) {
          action = t('mountFarm.activitySkipped', { actor: actorName, duty: trialLabel });
        } else {
          action = t('mountFarm.activityTrackingStarted', { actor: actorName, duty: trialLabel });
        }

        items.push({
          trialId: mp.trialId,
          action,
          source: mp.ownershipSource !== 'unknown' ? mp.ownershipSource : mp.totemSource,
          updatedAt: mp.updatedAt,
        });
      }
    }

    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items.slice(0, 8);
  }, [data, t, uiLocale]);

  if (activities.length === 0) return null;

  return (
    <div className="border-t border-border-default pt-3">
      {/* design-system-ignore: Collapsible header requires specific styling */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-medium text-text-tertiary uppercase tracking-wider w-full text-left hover:text-text-secondary transition-colors"
      >
        <Activity className="w-3.5 h-3.5" />
        {t('mountFarm.recentActivity')}
        <span className="text-[10px] normal-case tracking-normal">({activities.length})</span>
        <span className="ml-auto text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="space-y-1.5 mt-2">
          {activities.map((item, i) => (
            <div key={`${item.trialId}-${item.updatedAt}-${i}`} className="flex items-center gap-2 text-xs">
              <span className="text-text-tertiary w-16 flex-shrink-0 text-right">{timeAgo(item.updatedAt, uiLocale)}</span>
              <span className="text-text-secondary truncate">{item.action}</span>
              {item.source !== 'manual' && item.source !== 'unknown' && (
                <span className="text-blue-400 flex-shrink-0">
                  <Plug className="w-3 h-3 inline" />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
