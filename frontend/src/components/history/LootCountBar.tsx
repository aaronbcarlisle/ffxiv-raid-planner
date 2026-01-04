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

interface LootCountBarProps {
  players: SnapshotPlayer[];
  lootLog: LootLogEntry[];
  currentWeek: number;
}

// Position order for sorting
const POSITION_ORDER = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];

export function LootCountBar({ players, lootLog, currentWeek }: LootCountBarProps) {
  // Filter loot to current week
  const weekLoot = lootLog.filter(e => e.weekNumber === currentWeek);

  // Count drops per player
  const countsByPlayer = new Map<string, number>();
  weekLoot.forEach(entry => {
    const current = countsByPlayer.get(entry.recipientPlayerId) || 0;
    countsByPlayer.set(entry.recipientPlayerId, current + 1);
  });

  // Sort players by position
  const sortedPlayers = [...players].sort((a, b) => {
    const aIdx = a.position ? POSITION_ORDER.indexOf(a.position) : 999;
    const bIdx = b.position ? POSITION_ORDER.indexOf(b.position) : 999;
    return aIdx - bIdx;
  });

  // Calculate average for color coding
  const counts = sortedPlayers.map(p => countsByPlayer.get(p.id) || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const average = players.length > 0 ? total / players.length : 0;

  const getCountStyle = (count: number): string => {
    if (count > average + 1) {
      // Above average - blue
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    } else if (count < average - 1) {
      // Below average - yellow
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    }
    // Average - gray
    return 'bg-surface-interactive text-text-secondary border-border-default';
  };

  if (players.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-3 mb-4">
      <div className="flex items-center gap-4">
        <span className="text-xs text-text-muted whitespace-nowrap">Week {currentWeek} Drops:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {sortedPlayers.map(player => {
            const count = countsByPlayer.get(player.id) || 0;
            const roleColor = getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');

            return (
              <div
                key={player.id}
                className="flex flex-col items-center"
                title={`${player.name}: ${count} drop${count !== 1 ? 's' : ''}`}
              >
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
