import { useTranslation } from 'react-i18next';
import type { MountFarmTrial } from '../../gamedata';
import {
  getExchangeSummary,
  hasCurrencyTracking,
} from '../../gamedata';
import { Badge } from '../primitives/Badge';
import {
  getLocalizedTrialDutyName,
  getLocalizedTrialRewardName,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';
import {
  formatFarmProgress,
  getFarmCurrencyKind,
  getFarmExchangeCost,
  type FarmTrackingStatus,
} from './farmProgressUtils';

export function FarmCurrencyProgress({
  trial,
  currentCount,
  className = '',
  showKindLabel = true,
}: {
  trial: MountFarmTrial;
  currentCount: number;
  className?: string;
  showKindLabel?: boolean;
}) {
  const exchangeCost = getFarmExchangeCost(trial);

  if (!hasCurrencyTracking(trial) || exchangeCost <= 0) {
    return (
      <div className={`text-xs text-text-tertiary ${className}`}>
        {getExchangeSummary(trial)}
      </div>
    );
  }

  const progressPercent = Math.min((currentCount / exchangeCost) * 100, 100);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-text-primary">{formatFarmProgress(currentCount, trial)}</span>
        {showKindLabel && <span className="text-text-tertiary">{getFarmCurrencyKind(trial)}</span>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progressPercent >= 100 ? 'bg-amber-400' : 'bg-accent/60'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

export function FarmStatusBadge({
  status,
  canBuy = false,
}: {
  status: FarmTrackingStatus;
  canBuy?: boolean;
}) {
  const { t } = useTranslation();
  if (canBuy && status !== 'completed') {
    return <Badge variant="warning" size="sm">{t('mountFarm.statusReadyToBuy')}</Badge>;
  }

  switch (status) {
    case 'completed':
      return <Badge variant="success" size="sm">{t('mountFarm.statusOwned')}</Badge>;
    case 'farming':
      return <Badge variant="info" size="sm">{t('mountFarm.statusFarmingShort')}</Badge>;
    case 'wanted':
      return <Badge variant="default" size="sm">{t('mountFarm.statusWantedLater')}</Badge>;
    default:
      return <Badge variant="default" size="sm">{t('mountFarm.statusNotTracking')}</Badge>;
  }
}

export function FarmMetadataBadges({ trial }: { trial: MountFarmTrial }) {
  const { t } = useTranslation();
  const badges: Array<{ label: string; variant: 'default' | 'info' | 'warning' }> = [];

  if (trial.category === 'ultimate' || trial.contentType === 'ultimate') {
    badges.push({ label: t('mountFarm.badgeUltimate'), variant: 'info' });
  } else if (trial.category === 'collaboration' || trial.contentType === 'collaboration') {
    badges.push({ label: t('mountFarm.badgeCollaboration'), variant: 'info' });
  } else if (trial.category === 'special') {
    badges.push({ label: t('mountFarm.badgeSpecial'), variant: 'info' });
  }

  if (trial.exchangeStatus === 'not_yet_available') {
    badges.push({ label: t('mountFarm.badgePendingExchange'), variant: 'warning' });
  } else if (trial.exchangeStatus === 'drop_only') {
    badges.push({ label: t('mountFarm.badgeDropOnly'), variant: 'default' });
  } else if (trial.exchangeStatus === 'unknown' && trial.contentType !== 'ultimate') {
    badges.push({ label: t('mountFarm.badgeExchangeUnknown'), variant: 'default' });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

export function FarmCatalogSummary({ trial }: { trial: MountFarmTrial }) {
  const { t, i18n } = useTranslation();
  const isUltimate = trial.contentType === 'ultimate' || trial.category === 'ultimate';
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const localizedDutyName = getLocalizedTrialDutyName(trial, uiLocale);
  const localizedRewardName = getLocalizedTrialRewardName(trial, uiLocale);
  const primaryLabel = isUltimate ? localizedDutyName : localizedRewardName;
  const subtitleLabel = isUltimate ? t('mountFarm.ultimateWeaponExchange') : localizedDutyName;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate font-medium text-text-primary">{primaryLabel}</span>
        <FarmMetadataBadges trial={trial} />
      </div>
      {subtitleLabel && (
        <div className="truncate text-xs text-text-tertiary">{subtitleLabel}</div>
      )}
      <div className="mt-1 truncate text-[11px] text-text-tertiary">
        {getExchangeSummary(trial)}
      </div>
    </div>
  );
}
