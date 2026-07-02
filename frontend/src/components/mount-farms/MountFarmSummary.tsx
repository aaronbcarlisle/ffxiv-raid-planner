import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Calendar, ShoppingCart, Check } from 'lucide-react';
import type { MountFarmTrial } from '../../gamedata';
import { getCurrencyLabelPlural, getExchangeSummary, getRewardNoun, hasCurrencyTracking } from '../../gamedata';
import type { TrialSummary } from '../../stores/mountFarmStore';
import { MountFarmDetail } from './MountFarmDetail';
import { FarmMetadataBadges } from './FarmProgress';
import {
  getLocalizedTrialDutyName,
  getLocalizedTrialRewardName,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';

interface MountFarmSummaryProps {
  trials: MountFarmTrial[];
  trialSummaryMap: Map<string, TrialSummary>;
  currentUserId: string | null;
  groupId: string;
  canManage: boolean;
  viewMode: 'group' | 'my-progress';
  onScheduleFarm?: (trial: MountFarmTrial) => void;
  onRefresh: () => void;
}

export function MountFarmSummary({
  trials,
  trialSummaryMap,
  currentUserId,
  groupId,
  canManage,
  viewMode,
  onScheduleFarm,
  onRefresh,
}: MountFarmSummaryProps) {
  const { t, i18n } = useTranslation();
  const [expandedTrialId, setExpandedTrialId] = useState<string | null>(null);
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);

  const toggleExpand = useCallback((trialId: string) => {
    setExpandedTrialId(prev => prev === trialId ? null : trialId);
  }, []);

  if (trials.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p>{t('mountFarm.noTrialsConfigured')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trials.map(trial => {
        const summary = trialSummaryMap.get(trial.id);
        const isExpanded = expandedTrialId === trial.id;
        const localizedDutyName = getLocalizedTrialDutyName(trial, uiLocale);
        const localizedRewardName = getLocalizedTrialRewardName(trial, uiLocale);
        const totalMembers = summary?.totalMembers ?? 0;
        const complete = summary?.membersComplete ?? 0;
        const missing = summary?.membersMissing ?? totalMembers;
        const wanting = summary?.membersWanting ?? 0;
        const canBuy = summary?.membersCanBuy ?? 0;
        const allComplete = totalMembers > 0 && missing === 0;
        const myProgress = viewMode === 'my-progress' && currentUserId
          ? summary?.memberProgress.find(mp => mp.userId === currentUserId)
          : null;

        return (
          <div
            key={trial.id}
            className={`border rounded-lg overflow-hidden transition-colors ${
              allComplete
                ? 'border-status-success/30 bg-status-success/5'
                : 'border-border-default bg-surface-card'
            }`}
          >
            {/* Trial row */}
            {/* design-system-ignore: Expandable row requires specific styling */}
            <button
              onClick={() => toggleExpand(trial.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-elevated/50 transition-colors"
            >
              {/* Expand indicator */}
              <span className="text-text-tertiary flex-shrink-0">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>

              {/* Trial info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate">{localizedDutyName}</span>
                  {allComplete && <Check className="w-4 h-4 text-status-success flex-shrink-0" />}
                </div>
                <div className="text-xs text-text-secondary flex items-center gap-2 mt-0.5">
                  <span>{localizedRewardName}</span>
                  {myProgress ? (
                    <span className={myProgress.hasMount ? 'text-status-success' : 'text-text-tertiary'}>
                      &middot; {myProgress.hasMount ? t('mountFarm.obtained') : hasCurrencyTracking(trial) ? `${myProgress.totemCount}/${trial.exchangeCost ?? trial.totemTarget} ${getCurrencyLabelPlural(trial)}` : getExchangeSummary(trial)}
                    </span>
                  ) : (
                    <>
                      <span className="text-text-tertiary">&middot;</span>
                      <span>{getExchangeSummary(trial)}</span>
                      <FarmMetadataBadges trial={trial} />
                    </>
                  )}
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {canBuy > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                    <ShoppingCart className="w-3 h-3" />
                    {t('mountFarm.readyCount', { count: canBuy })}
                  </span>
                )}
                {totalMembers > 0 && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    allComplete
                      ? 'bg-status-success/20 text-status-success'
                      : 'bg-surface-elevated text-text-secondary'
                  }`}>
                    {complete}/{totalMembers}
                  </span>
                )}
              </div>

              {/* Schedule action */}
              {onScheduleFarm && canManage && !allComplete && wanting > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onScheduleFarm(trial);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onScheduleFarm(trial);
                    }
                  }}
                  className="flex-shrink-0 text-text-tertiary hover:text-accent transition-colors p-1"
                  title={trial.contentType === 'ultimate' ? t('mountFarm.scheduleSession') : t('mountFarm.scheduleFarmEvent')}
                  aria-label={trial.contentType === 'ultimate' ? t('mountFarm.scheduleNamed', { name: localizedDutyName }) : t('mountFarm.scheduleRewardFarm', { reward: getRewardNoun(trial) })}
                >
                  <Calendar className="w-4 h-4" />
                </span>
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <MountFarmDetail
                trial={trial}
                summary={summary ?? null}
                currentUserId={currentUserId}
                groupId={groupId}
                canManage={canManage}
                onRefresh={onRefresh}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
