/**
 * ReadinessBadge - Shows gear readiness state for a job profile
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '../primitives/Badge';

const READINESS_CONFIG: Record<string, { labelKey: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  ready: { labelKey: 'profile.jobsGear.readinessReady', variant: 'success' },
  needs_gear: { labelKey: 'profile.jobsGear.readinessNeedsGear', variant: 'warning' },
  in_progress: { labelKey: 'profile.jobsGear.readinessInProgress', variant: 'info' },
  not_ready: { labelKey: 'profile.jobsGear.readinessNotReady', variant: 'error' },
  unknown: { labelKey: 'profile.jobsGear.readinessUnknown', variant: 'default' },
};

interface ReadinessBadgeProps {
  readiness: string;
  className?: string;
}

export function ReadinessBadge({ readiness, className }: ReadinessBadgeProps) {
  const { t } = useTranslation();
  const config = READINESS_CONFIG[readiness] ?? READINESS_CONFIG.unknown;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {t(config.labelKey)}
    </Badge>
  );
}
