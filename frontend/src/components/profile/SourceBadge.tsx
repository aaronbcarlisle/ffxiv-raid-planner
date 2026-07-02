import { useTranslation } from 'react-i18next';
import { Badge } from '../primitives/Badge';

const SOURCE_CONFIG: Record<string, { labelKey: string; variant: 'info' | 'success' | 'warning' | 'default' | 'tome' }> = {
  plugin: { labelKey: 'profile.syncCenter.sourcePlugin', variant: 'success' },
  roster_sync: { labelKey: 'profile.syncCenter.sourceRoster', variant: 'tome' },
  tomestone: { labelKey: 'profile.syncCenter.sourceLodestone', variant: 'info' },
  xivapi: { labelKey: 'profile.syncCenter.sourceLodestone', variant: 'info' },
  lodestone: { labelKey: 'profile.syncCenter.sourceLodestone', variant: 'info' },
  manual: { labelKey: 'profile.syncCenter.sourceManual', variant: 'default' },
  unknown: { labelKey: 'common.unknown', variant: 'default' },
};

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const { t } = useTranslation();
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.unknown;
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {t(config.labelKey)}
    </Badge>
  );
}
