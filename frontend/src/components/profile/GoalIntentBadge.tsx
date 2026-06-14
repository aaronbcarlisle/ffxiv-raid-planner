import { Badge } from '../primitives/Badge';

type IntentVariant = 'default' | 'info' | 'error' | 'warning';

const INTENT_CONFIG: Record<string, { label: string; variant: IntentVariant }> = {
  must_have:      { label: 'Must Have',      variant: 'error' },
  want:           { label: 'Want',           variant: 'info' },
  willing:        { label: 'Willing',        variant: 'default' },
  not_interested: { label: 'Not Interested', variant: 'default' },
  avoid:          { label: 'Avoid',          variant: 'warning' },
};

interface GoalIntentBadgeProps {
  intentLevel: string | null;
}

export function GoalIntentBadge({ intentLevel }: GoalIntentBadgeProps) {
  if (!intentLevel) return null;

  const config = INTENT_CONFIG[intentLevel];
  if (!config) return null;

  return (
    <Badge variant={config.variant} size="sm">
      {config.label}
    </Badge>
  );
}
