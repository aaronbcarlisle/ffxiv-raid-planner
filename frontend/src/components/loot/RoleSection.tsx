/**
 * RoleSection Component
 *
 * A collapsible wrapper that groups content by role with colored header bar.
 * Used in Weapon Priority tab to group weapons by role.
 * Modeled after FloorSection component for consistent UX.
 */

import { useState, type ReactNode } from 'react';

export interface RoleSectionConfig {
  id: string;
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

interface RoleSectionProps {
  role: RoleSectionConfig;
  itemCount: number;
  itemLabel?: string; // e.g., "weapon" / "weapons"
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Callback when expand/collapse state changes */
  onExpandChange?: (expanded: boolean) => void;
}

export function RoleSection({
  role,
  itemCount,
  itemLabel = 'weapon',
  children,
  defaultExpanded = true,
  onExpandChange,
}: RoleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandChange?.(newExpanded);
  };

  const pluralLabel = itemCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className="mb-4">
      {/* Role Header - clickable to toggle */}
      <button
        onClick={handleToggle}
        className={`
          w-full flex items-center justify-between px-3 py-2
          ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'}
          border ${role.bgColor}/10 ${role.borderColor}/30
          transition-all hover:opacity-90
        `}
      >
        <div className="flex items-center gap-2">
          {/* Chevron indicator */}
          <svg
            className={`w-4 h-4 ${role.textColor} transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`text-sm font-bold ${role.textColor}`}>
            {role.label}
          </span>
        </div>
        <span className={`text-xs ${role.textColor} opacity-80`}>
          {itemCount} {pluralLabel}
        </span>
      </button>
      {/* Content - collapsible */}
      {isExpanded && (
        <div className="bg-surface-elevated/30 border border-t-0 border-border-default rounded-b-lg p-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Pre-defined role configurations matching ROLE_SECTIONS in WeaponPriorityList
export const ROLE_SECTION_CONFIGS: RoleSectionConfig[] = [
  { id: 'tank', label: 'Tanks', textColor: 'text-role-tank', bgColor: 'bg-role-tank', borderColor: 'border-role-tank' },
  { id: 'healer', label: 'Healers', textColor: 'text-role-healer', bgColor: 'bg-role-healer', borderColor: 'border-role-healer' },
  { id: 'melee', label: 'Melee DPS', textColor: 'text-role-melee', bgColor: 'bg-role-melee', borderColor: 'border-role-melee' },
  { id: 'ranged', label: 'Physical Ranged', textColor: 'text-role-ranged', bgColor: 'bg-role-ranged', borderColor: 'border-role-ranged' },
  { id: 'caster', label: 'Magical Ranged', textColor: 'text-role-caster', bgColor: 'bg-role-caster', borderColor: 'border-role-caster' },
];

/**
 * Get role section config by role ID
 */
export function getRoleSectionConfig(roleId: string): RoleSectionConfig | undefined {
  return ROLE_SECTION_CONFIGS.find(r => r.id === roleId);
}

export default RoleSection;
