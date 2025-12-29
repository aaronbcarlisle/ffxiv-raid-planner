import type { TemplateRole, RaidPosition } from '../../types';
import { TEMPLATE_ROLE_INFO, getRoleIconUrl } from '../../utils/constants';

interface EmptySlotCardProps {
  templateRole?: TemplateRole | null;
  position?: RaidPosition | null;
  onStartEdit: () => void;
  onRemove?: () => void;
}

// Get role-specific border, hover, and text colors
function getRoleClasses(templateRole: TemplateRole): { border: string; hoverBorder: string; text: string; bg: string } {
  const colorMap: Record<string, { border: string; hoverBorder: string; text: string; bg: string }> = {
    'role-tank': { border: 'border-role-tank/50', hoverBorder: 'hover:border-role-tank', text: 'text-role-tank', bg: 'bg-role-tank/10' },
    'role-healer': { border: 'border-role-healer/50', hoverBorder: 'hover:border-role-healer', text: 'text-role-healer', bg: 'bg-role-healer/10' },
    'role-melee': { border: 'border-role-melee/50', hoverBorder: 'hover:border-role-melee', text: 'text-role-melee', bg: 'bg-role-melee/10' },
    'role-ranged': { border: 'border-role-ranged/50', hoverBorder: 'hover:border-role-ranged', text: 'text-role-ranged', bg: 'bg-role-ranged/10' },
    'role-caster': { border: 'border-role-caster/50', hoverBorder: 'hover:border-role-caster', text: 'text-role-caster', bg: 'bg-role-caster/10' },
  };
  const roleInfo = TEMPLATE_ROLE_INFO[templateRole];
  return colorMap[roleInfo.color] || { border: 'border-border-default', hoverBorder: 'hover:border-accent', text: 'text-text-muted', bg: 'bg-surface-interactive' };
}

export function EmptySlotCard({ templateRole, position, onStartEdit, onRemove }: EmptySlotCardProps) {
  const roleInfo = templateRole ? TEMPLATE_ROLE_INFO[templateRole] : null;
  const roleClasses = templateRole ? getRoleClasses(templateRole) : null;

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className={`w-full h-full bg-surface-card border-2 border-dashed rounded-lg p-4 transition-all hover:border-solid hover:bg-surface-interactive group cursor-pointer text-left flex flex-col ${
        roleClasses ? `${roleClasses.border} ${roleClasses.hoverBorder}` : 'border-border-default hover:border-accent'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Role icon */}
        <div
          className={`w-10 h-10 rounded flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity ${
            roleClasses ? roleClasses.bg : 'bg-surface-interactive'
          }`}
        >
          {roleInfo ? (
            <img
              src={getRoleIconUrl(roleInfo.iconId)}
              alt={roleInfo.label}
              className="w-8 h-8"
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 text-text-muted"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {/* Role label */}
            <span
              className={`font-medium group-hover:opacity-100 transition-colors ${
                roleClasses ? roleClasses.text : 'text-text-muted group-hover:text-text-secondary'
              }`}
            >
              {roleInfo ? roleInfo.label : 'Player Slot'}
            </span>
            {/* Position badge */}
            {position && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  roleClasses ? `${roleClasses.bg} ${roleClasses.text}` : 'bg-surface-interactive text-text-muted'
                }`}
              >
                {position}
              </span>
            )}
          </div>
          <div className="text-sm text-text-muted group-hover:text-text-secondary transition-colors">
            Click to configure
          </div>
        </div>

        {/* Remove button */}
        {onRemove && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onRemove();
              }
            }}
            className="w-8 h-8 rounded flex items-center justify-center text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
            title="Remove slot"
          >
            &minus;
          </div>
        )}
      </div>

      {/* Animated cursor hint - fills remaining space, only visible on hover */}
      <div className="flex-1 flex items-center justify-center min-h-[60px]">
        <img
          src="/icons/animated_cursor_padded_fixed.apng"
          alt="Click to configure"
          className="w-16 h-16 opacity-0 group-hover:opacity-40 transition-opacity"
        />
      </div>
    </button>
  );
}
