import { Badge } from '../primitives/Badge';

const SOURCE_CONFIG: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'default' | 'tome' }> = {
  plugin: { label: 'Plugin', variant: 'success' },
  roster_sync: { label: 'Static Roster', variant: 'tome' },
  tomestone: { label: 'Lodestone', variant: 'info' },
  xivapi: { label: 'Lodestone', variant: 'info' },
  lodestone: { label: 'Lodestone', variant: 'info' },
  manual: { label: 'Manual', variant: 'default' },
  unknown: { label: 'Unknown', variant: 'default' },
};

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.unknown;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {config.label}
    </Badge>
  );
}
