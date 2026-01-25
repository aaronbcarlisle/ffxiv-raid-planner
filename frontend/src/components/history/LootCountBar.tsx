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

  // Calculate average for color coding (only count main roster players' drops)
  const mainRosterTotal = mainRosterPlayers.reduce((sum, p) => sum + (countsByPlayer.get(p.id) || 0), 0);
  const average = mainRosterPlayers.length > 0 ? mainRosterTotal / mainRosterPlayers.length : 0;

  if (mainRosterPlayers.length === 0) {
    return null;
  }

  // Stop touch events from propagating to parent swipe handlers
  // This allows horizontal scrolling without triggering panel switches
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="bg-surface-card border border-border-default rounded-lg p-3 mb-4 overflow-x-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex gap-2 min-w-max sm:min-w-0">
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
              <div
                className="flex-1 min-w-[60px] sm:min-w-[80px] text-center p-2 bg-surface-elevated rounded-lg border border-border-subtle cursor-help"
              >
                <div
                  className="text-[10px] font-semibold mb-0.5"
                  style={{ color: roleColor }}
                >
                  {player.position || player.role?.substring(0, 2).toUpperCase() || '?'}
                </div>
                <div className="text-[10px] text-text-muted truncate">{player.name}</div>
                <div
                  className="text-xl font-bold"
                  style={{
                    color: count > average + 1
                      ? 'var(--color-status-info)'
                      : count < average - 1
                        ? 'var(--color-status-warning)'
                        : 'var(--color-text-secondary)'
                  }}
                >
                  {count}
                </div>
                <div className="text-[9px] text-text-muted uppercase">drops</div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export default LootCountBar;
