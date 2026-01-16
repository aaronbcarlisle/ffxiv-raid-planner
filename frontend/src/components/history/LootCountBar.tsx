/**
 * LootCountBar Component
 *
 * Shows loot distribution across players for the current week.
 * Features:
 * - Count per player with position labels
 * - Color coding: Blue = above average, Yellow = below average, Gray = average
 * - Compact inline display
 */

import type { SnapshotPlayer, LootLogEntry } from '../../types';
import { getRoleColor } from '../../gamedata';
import { Tooltip } from '../primitives/Tooltip';

interface LootCountBarProps {
  players: SnapshotPlayer[];
  lootLog: LootLogEntry[];
  currentWeek: number;
}

// Position order for sorting
const POSITION_ORDER = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];

export function LootCountBar({ players, lootLog, currentWeek }: LootCountBarProps) {
  // Filter out substitute players
  const mainRosterPlayers = players.filter(p => !p.isSubstitute);

  // Filter loot to current week
  const weekLoot = lootLog.filter(e => e.weekNumber === currentWeek);

  // Count drops per player
  const countsByPlayer = new Map<string, number>();
  weekLoot.forEach(entry => {
    const current = countsByPlayer.get(entry.recipientPlayerId) || 0;
    countsByPlayer.set(entry.recipientPlayerId, current + 1);
  });

  // Sort players by position
  const sortedPlayers = [...mainRosterPlayers].sort((a, b) => {
    const aIdx = a.position ? POSITION_ORDER.indexOf(a.position) : 999;
    const bIdx = b.position ? POSITION_ORDER.indexOf(b.position) : 999;
    return aIdx - bIdx;
  });

  // Calculate average for color coding
  const counts = sortedPlayers.map(p => countsByPlayer.get(p.id) || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const average = mainRosterPlayers.length > 0 ? total / mainRosterPlayers.length : 0;

  const getCountStyle = (count: number): string => {
    if (count > average + 1) {
      // Above average - info (received more loot)
      return 'bg-status-info/20 text-status-info border-status-info/40';
    } else if (count < average - 1) {
      // Below average - warning (received less loot)
      return 'bg-status-warning/20 text-status-warning border-status-warning/40';
    }
    // Average - neutral
    return 'bg-surface-interactive text-text-secondary border-border-default';
  };

  if (mainRosterPlayers.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-3 mb-4">
      <div className="flex items-center gap-4">
        <span className="text-xs text-text-muted whitespace-nowrap">Week {currentWeek} Drops:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {sortedPlayers.map(player => {
            const count = countsByPlayer.get(player.id) || 0;
            // Fallback to text-secondary if role is not set
            const roleColor = player.role
              ? getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
              : 'var(--color-text-secondary)';

            const diffFromAvg = count - average;
            const diffText = diffFromAvg > 0 ? `+${diffFromAvg.toFixed(1)}` : diffFromAvg.toFixed(1);

            return (
              <Tooltip
                key={player.id}
                content={
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-text-secondary text-xs mt-0.5">
                      {count} drop{count !== 1 ? 's' : ''} this week
                    </div>
                    <div className="text-text-muted text-[10px] mt-1">
                      {diffFromAvg === 0 ? 'At average' : `${diffText} from avg`}
                    </div>
                  </div>
                }
              >
                <div className="flex flex-col items-center cursor-help">
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold border ${getCountStyle(count)}`}
                  >
                    {count}
                  </div>
                  <span
                    className="text-[10px] font-medium mt-0.5"
                    style={{ color: roleColor }}
                  >
                    {player.position || '?'}
                  </span>
                </div>
              </Tooltip>
            );
          })}
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">
          Total: {total} | Avg: {average.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

export default LootCountBar;
