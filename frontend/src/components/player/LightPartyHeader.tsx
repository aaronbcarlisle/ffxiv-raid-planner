/**
 * LightPartyHeader Component
 *
 * Enhanced header for G1/G2 light party sections showing:
 * - Group badge (G1/G2)
 * - Aggregate BiS progress bar
 * - Total completion summary
 */

import { useMemo } from 'react';
import type { SnapshotPlayer } from '../../types';

interface LightPartyHeaderProps {
  groupNumber: 1 | 2;
  players: SnapshotPlayer[];
}

export function LightPartyHeader({ groupNumber, players }: LightPartyHeaderProps) {
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
