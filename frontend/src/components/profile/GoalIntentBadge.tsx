import { useTranslation } from 'react-i18next';
import { Badge } from '../primitives/Badge';

type IntentVariant = 'default' | 'info' | 'error' | 'warning';

const INTENT_CONFIG: Record<string, { labelKey: string; variant: IntentVariant }> = {
  must_have:      { labelKey: 'profile.goals.intentMustHave', variant: 'error' },
  want:           { labelKey: 'profile.goals.intentWant', variant: 'info' },
  willing:        { labelKey: 'profile.goals.intentWilling', variant: 'default' },
  not_interested: { labelKey: 'profile.goals.intentNotInterested', variant: 'default' },
  avoid:          { labelKey: 'profile.goals.intentAvoid', variant: 'warning' },
};

interface GoalIntentBadgeProps {
  intentLevel: string | null;
}

export function GoalIntentBadge({ intentLevel }: GoalIntentBadgeProps) {
  const { t } = useTranslation();
  if (!intentLevel) return null;

  const config = INTENT_CONFIG[intentLevel];
  if (!config) return null;

  return (
    <Badge variant={config.variant} size="sm">
      {t(config.labelKey)}
    </Badge>
  );
}
