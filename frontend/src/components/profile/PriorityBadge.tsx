/**
 * PriorityBadge - Shows job priority level (main, alt, flex, etc.)
 */

import { Badge } from '../primitives/Badge';

const PRIORITY_CONFIG: Record<string, { label: string; variant: 'raid' | 'tome' | 'info' | 'warning' | 'default' }> = {
  main: { label: 'Main', variant: 'raid' },
  preferred_alt: { label: 'Preferred Alt', variant: 'tome' },
  flex: { label: 'Flex', variant: 'info' },
  emergency: { label: 'Emergency', variant: 'warning' },
  casual: { label: 'Casual', variant: 'default' },
};

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.casual;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {config.label}
    </Badge>
  );
}
