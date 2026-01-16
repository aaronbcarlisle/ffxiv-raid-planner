/**
 * FilterBar Component
 *
 * A unified filter bar used across Loot tab sub-tabs for consistent styling.
 * Supports floor filters (Who Needs It, Gear Priority) and role filters (Weapon Priority).
 */

/* eslint-disable react-refresh/only-export-components -- Intentionally exports both component and config */

import { FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';

// Role configuration for Weapon Priority tab
export interface RoleFilter {
  id: string;
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

// Pre-defined role filters matching WeaponPriorityList
// Uses same opacity pattern as FLOOR_COLORS: bg/10, border/30
export const ROLE_FILTERS: RoleFilter[] = [
  { id: 'tank', label: 'Tanks', textColor: 'text-role-tank', bgColor: 'bg-role-tank/10', borderColor: 'border-role-tank/30' },
  { id: 'healer', label: 'Healers', textColor: 'text-role-healer', bgColor: 'bg-role-healer/10', borderColor: 'border-role-healer/30' },
  { id: 'melee', label: 'Melee DPS', textColor: 'text-role-melee', bgColor: 'bg-role-melee/10', borderColor: 'border-role-melee/30' },
  { id: 'ranged', label: 'Physical Ranged', textColor: 'text-role-ranged', bgColor: 'bg-role-ranged/10', borderColor: 'border-role-ranged/30' },
  { id: 'caster', label: 'Magical Ranged', textColor: 'text-role-caster', bgColor: 'bg-role-caster/10', borderColor: 'border-role-caster/30' },
];

interface FloorFilterProps {
  type: 'floor';
  floors: string[]; // Floor names e.g., ["M9S", "M10S", "M11S", "M12S"]
  selectedFloor: FloorNumber | 'all';
  onFloorChange: (floor: FloorNumber | 'all') => void;
  showAllOption?: boolean;
  label?: string;
}

interface RoleFilterProps {
  type: 'role';
  roleFilters?: RoleFilter[];
  visibleRoles: Set<string>;
  onRoleToggle: (roleId: string) => void;
  /** Optional: hide roles with no items */
  hiddenRoles?: Set<string>;
  label?: string;
}

type FilterBarProps = FloorFilterProps | RoleFilterProps;

export function FilterBar(props: FilterBarProps) {
  if (props.type === 'floor') {
    return <FloorFilterBar {...props} />;
  }
  return <RoleFilterBar {...props} />;
}

function FloorFilterBar({
  floors,
  selectedFloor,
  onFloorChange,
  showAllOption = true,
  label = 'Floor:',
}: Omit<FloorFilterProps, 'type'>) {
  const floorNumbers: (FloorNumber | 'all')[] = showAllOption
    ? ['all', 1, 2, 3, 4]
    : [1, 2, 3, 4];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-text-muted min-w-[2.5rem]">{label}</span>
      {floorNumbers.map((floor) => {
        const isSelected = selectedFloor === floor;
        const floorColors = floor !== 'all' ? FLOOR_COLORS[floor] : null;
        const floorLabel = floor === 'all'
          ? 'All'
          : floors[floor - 1]?.split(' ')[0] || `F${floor}`;

        return (
          <button
            key={floor}
            onClick={() => onFloorChange(floor)}
            aria-label={floor === 'all' ? 'Show all floors' : `Filter by Floor ${floor}`}
            aria-pressed={isSelected}
            className={`
              px-3 py-1.5 rounded text-xs font-bold transition-colors border
              ${isSelected
                ? floor === 'all'
                  ? 'bg-accent text-accent-contrast border-accent'
                  : `${floorColors?.bg} ${floorColors?.text} ${floorColors?.border}`
                : 'border-transparent bg-surface-interactive text-text-secondary hover:text-text-primary'
              }
            `}
          >
            {floorLabel}
          </button>
        );
      })}
    </div>
  );
}

function RoleFilterBar({
  roleFilters = ROLE_FILTERS,
  visibleRoles,
  onRoleToggle,
  hiddenRoles,
  label = 'Show:',
}: Omit<RoleFilterProps, 'type'>) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-text-muted min-w-[2.5rem]">{label}</span>
      {roleFilters.map((role) => {
        // Skip roles that should be hidden (e.g., no jobs in that role)
        if (hiddenRoles?.has(role.id)) return null;

        const isVisible = visibleRoles.has(role.id);

        return (
          <button
            key={role.id}
            onClick={() => onRoleToggle(role.id)}
            aria-pressed={isVisible}
            className={`
              px-3 py-1.5 rounded text-xs font-bold transition-colors border
              ${isVisible
                ? `${role.bgColor} ${role.textColor} ${role.borderColor}`
                : 'border-transparent bg-surface-interactive text-text-secondary hover:text-text-primary'
              }
            `}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}

export default FilterBar;
