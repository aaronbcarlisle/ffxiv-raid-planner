import type { RoleInStatic } from '../../types';

const ROLE_STYLES: Record<RoleInStatic, string> = {
  main: 'text-role-tank bg-role-tank/10',
  alt: 'text-text-secondary bg-surface-elevated',
  substitute: 'text-status-warning bg-status-warning/10',
  manual: 'text-text-muted bg-surface-base',
};

const ROLE_LABELS: Record<RoleInStatic, string> = {
  main: 'Main',
  alt: 'Alt',
  substitute: 'Sub',
  manual: 'Manual',
};

interface CharacterRoleBadgeProps {
  role: RoleInStatic;
  isPrimary?: boolean;
}

export function CharacterRoleBadge({ role, isPrimary }: CharacterRoleBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${ROLE_STYLES[role]}`}>
      {isPrimary && (
        <span className="text-[9px] text-accent" aria-label="Primary character" title="Primary">★</span>
      )}
      {ROLE_LABELS[role]}
    </span>
  );
}
