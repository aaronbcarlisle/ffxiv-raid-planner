import type { MountFarmTrial } from '../../gamedata';
import { getCurrencyLabelPlural, hasCurrencyTracking } from '../../gamedata';

export type FarmTrackingStatus = 'not_tracking' | 'wanted' | 'farming' | 'completed';

export function getFarmCurrencyKind(trial: MountFarmTrial): string {
  if (!hasCurrencyTracking(trial)) return 'reward';

  const label = getCurrencyLabelPlural(trial).toLowerCase();
  if (label.includes('certificate')) return 'certificates';
  if (label.includes('totem')) return 'totems';
  return 'currency';
}

export function getFarmExchangeCost(trial: MountFarmTrial): number {
  return trial.exchangeCost ?? trial.totemTarget;
}

export function formatFarmProgress(currentCount: number, trial: MountFarmTrial): string {
  const exchangeCost = getFarmExchangeCost(trial);
  return exchangeCost > 0 ? `${currentCount} / ${exchangeCost}` : 'No count target';
}
