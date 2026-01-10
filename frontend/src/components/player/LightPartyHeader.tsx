/**
 * LightPartyHeader Component
 *
 * Enhanced header for G1/G2 light party sections showing:
 * - Group badge (G1/G2)
 * - Role composition indicators
 * - Aggregate BiS progress bar
 * - Total completion summary
 */

import { useMemo } from 'react';
import type { SnapshotPlayer } from '../../types';
import { getRoleColor, type Role } from '../../gamedata';

interface LightPartyHeaderProps {
  groupNumber: 1 | 2;
  players: SnapshotPlayer[];
}

// Role labels for tooltips
const ROLE_LABELS: Record<Role, string> = {
  tank: 'Tank',
  healer: 'Healer',
  melee: 'Melee DPS',
  ranged: 'Physical Ranged',
  caster: 'Magical Ranged',
};

// Simple color-coded circle for each role
const RoleCircle = ({ role, filled }: { role: Role; filled: boolean }) => {
  const color = getRoleColor(role);
  const label = ROLE_LABELS[role];

  return (
    <div
      className="w-3 h-3 rounded-full flex-shrink-0 transition-opacity"
      style={{
        backgroundColor: color,
        opacity: filled ? 1 : 0.25,
      }}
      title={filled ? label : `${label} (missing)`}
      aria-label={filled ? `${label} present` : `${label} missing`}
    />
  );
};

export function LightPartyHeader({ groupNumber, players }: LightPartyHeaderProps) {
  // Calculate role composition
  const roleComposition = useMemo(() => {
    const roles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
    return roles.map(role => ({
      role,
      present: players.some(p => p.role === role),
      count: players.filter(p => p.role === role).length,
    }));
  }, [players]);

  // Calculate aggregate BiS progress
  const { completed, total, percentage } = useMemo(() => {
    let completedCount = 0;
    let totalCount = 0;

    players.forEach(player => {
      if (player.configured && player.gear) {
        player.gear.forEach(slot => {
          totalCount++;
          if (slot.hasItem) {
            completedCount++;
          }
        });
      }
    });

    return {
      completed: completedCount,
      total: totalCount,
      percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  }, [players]);

  // Group colors
  const groupColors = {
    1: {
      badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      progress: 'bg-blue-500',
    },
    2: {
      badge: 'bg-red-500/20 text-red-400 border-red-500/30',
      progress: 'bg-red-500',
    },
  };

  const colors = groupColors[groupNumber];

  return (
    <div className="flex items-center gap-4 mb-3">
      {/* Group badge and label */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${colors.badge}`}>
          G{groupNumber}
        </span>
        <span className="text-text-secondary text-sm font-medium">
          Light Party {groupNumber}
        </span>
      </div>

      {/* Role composition indicators */}
      <div className="flex items-center gap-1.5">
        {roleComposition.map(({ role, present }) => (
          <RoleCircle key={role} role={role} filled={present} />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Progress bar and summary */}
      <div className="flex items-center gap-3">
        {/* Progress bar */}
        <div className="w-24 h-2 bg-surface-elevated rounded-full overflow-hidden" title={`${percentage}% complete`}>
          <div
            className={`h-full ${colors.progress} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Summary text */}
        <span className="text-xs text-text-muted whitespace-nowrap">
          {completed}/{total} BiS
        </span>
      </div>
    </div>
  );
}

export default LightPartyHeader;
