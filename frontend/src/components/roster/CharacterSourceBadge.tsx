import type { RegistrationSource } from '../../types';

const SOURCE_STYLES: Record<RegistrationSource, string> = {
  player_hub: 'text-accent bg-accent/10',
  lodestone: 'text-blue-400 bg-blue-400/10',
  manual: 'text-text-muted bg-surface-elevated',
};

const SOURCE_LABELS: Record<RegistrationSource, string> = {
  player_hub: 'Player Hub',
  lodestone: 'Lodestone',
  manual: 'Manual',
};

interface CharacterSourceBadgeProps {
  source: RegistrationSource;
}

export function CharacterSourceBadge({ source }: CharacterSourceBadgeProps) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SOURCE_STYLES[source]}`}>
      {SOURCE_LABELS[source]}
    </span>
  );
}
