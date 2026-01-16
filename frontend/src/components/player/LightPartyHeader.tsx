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
import { Tooltip } from '../primitives/Tooltip';

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

  // Group descriptions
  const groupDescription = groupNumber === 1
    ? 'Tank 1, Healer 1, Melee 1, Ranged 1'
    : 'Tank 2, Healer 2, Melee 2, Ranged 2';

  return (
    <div className="flex items-center gap-4 mb-3">
      {/* Group badge and label */}
      <div className="flex items-center gap-2">
        <Tooltip
          content={
            <div>
              <div className="font-medium">Light Party {groupNumber}</div>
              <div className="text-text-secondary text-xs mt-0.5">{groupDescription}</div>
            </div>
          }
        >
          <span className={`px-2 py-0.5 rounded text-xs font-bold border cursor-help ${colors.badge}`}>
            G{groupNumber}
          </span>
        </Tooltip>
        <span className="text-text-secondary text-sm font-medium">
          Light Party {groupNumber}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Progress bar and summary */}
      <div className="flex items-center gap-3">
        {/* Progress bar */}
        <Tooltip
          content={
            <div>
              <div className="font-medium">Light Party {groupNumber} Progress</div>
              <div className="text-text-secondary text-xs mt-0.5">
                {completed}/{total} slots ({percentage}% complete)
              </div>
            </div>
          }
        >
          <div className="w-24 h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className={`h-full ${colors.progress} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </Tooltip>

        {/* Summary text */}
        <span className="text-xs text-text-muted whitespace-nowrap">
          {completed}/{total} BiS
        </span>
      </div>
    </div>
  );
}

export default LightPartyHeader;
