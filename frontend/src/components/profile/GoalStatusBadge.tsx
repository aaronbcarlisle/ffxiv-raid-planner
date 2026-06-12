import { Badge } from '../primitives/Badge';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'default' }> = {
  active: { label: 'Active', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  abandoned: { label: 'Abandoned', variant: 'default' },
};

interface GoalStatusBadgeProps {
  status: string;
  className?: string;
}

export function GoalStatusBadge({ status, className }: GoalStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {config.label}
    </Badge>
  );
}
