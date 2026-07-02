import { useTranslation } from 'react-i18next';
import { Badge } from '../primitives/Badge';

const STATUS_CONFIG: Record<string, { labelKey: string; variant: 'success' | 'info' | 'warning' | 'default' }> = {
  active: { labelKey: 'profile.goals.statusActive', variant: 'info' },
  completed: { labelKey: 'profile.goals.statusCompleted', variant: 'success' },
  paused: { labelKey: 'profile.goals.statusPaused', variant: 'warning' },
  abandoned: { labelKey: 'profile.goals.statusAbandoned', variant: 'default' },
};

interface GoalStatusBadgeProps {
  status: string;
  className?: string;
}

export function GoalStatusBadge({ status, className }: GoalStatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {t(config.labelKey)}
    </Badge>
  );
}
