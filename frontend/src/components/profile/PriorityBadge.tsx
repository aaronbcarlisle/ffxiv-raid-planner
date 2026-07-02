/**
 * PriorityBadge - Shows job priority level (main, alt, flex, etc.)
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '../primitives/Badge';

const PRIORITY_CONFIG: Record<string, { labelKey: string; variant: 'raid' | 'tome' | 'info' | 'warning' | 'default' }> = {
  main: { labelKey: 'profile.jobsGear.priorityMain', variant: 'raid' },
  preferred_alt: { labelKey: 'profile.jobsGear.priorityPreferredAlt', variant: 'tome' },
  flex: { labelKey: 'profile.jobsGear.priorityFlex', variant: 'info' },
  emergency: { labelKey: 'profile.jobsGear.priorityEmergency', variant: 'warning' },
  casual: { labelKey: 'profile.jobsGear.priorityCasual', variant: 'default' },
};

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { t } = useTranslation();
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.casual;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {t(config.labelKey)}
    </Badge>
  );
}
