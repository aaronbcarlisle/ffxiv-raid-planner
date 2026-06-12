/**
 * ReadinessBadge - Shows gear readiness state for a job profile
 */

import { Badge } from '../primitives/Badge';

const READINESS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  ready: { label: 'Ready', variant: 'success' },
  needs_gear: { label: 'Needs Gear', variant: 'warning' },
  in_progress: { label: 'In Progress', variant: 'info' },
  not_ready: { label: 'Not Ready', variant: 'error' },
  unknown: { label: 'Not self-rated', variant: 'default' },
};

interface ReadinessBadgeProps {
  readiness: string;
  className?: string;
}

export function ReadinessBadge({ readiness, className }: ReadinessBadgeProps) {
  const config = READINESS_CONFIG[readiness] ?? READINESS_CONFIG.unknown;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {config.label}
    </Badge>
  );
}
