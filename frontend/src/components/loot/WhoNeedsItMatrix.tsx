/**
 * WhoNeedsItMatrix Component
 *
 * Matrix view showing which players need which gear slots.
 * Features:
 * - Position-first headers (T1, T2, H1, H2, M1, M2, R1, R2)
 * - "FREE" badge when no one needs an item
 * - Floor filter tabs with color coding
 * - Click indicator to quick-log loot
 */

import { useMemo, useState } from 'react';
import type { SnapshotPlayer, GearSlot, RaidPosition } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { FLOOR_LOOT_TABLES, FLOOR_COLORS, getFloorForSlot, type FloorNumber } from '../../gamedata/loot-tables';
import { getRoleColor } from '../../gamedata';
import { JobIcon } from '../ui/JobIcon';

interface WhoNeedsItMatrixProps {
  players: SnapshotPlayer[];
  floors: string[];  // e.g., ["M9S", "M10S", "M11S", "M12S"]
  onLogClick?: (slot: GearSlot, player: SnapshotPlayer, floor: string) => void;
  showLogButtons?: boolean;
}

type FloorFilter = FloorNumber | 'all';

// Position order for sorting players
const POSITION_ORDER: RaidPosition[] = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];

// Helper to determine which ring slot a player actually needs
// Returns ring1 if they need ring1, ring2 if they only need ring2, or ring1 if both
// Note: This is only called when a player IS shown in the "Ring" row (i.e., they need at least one ring).
// The fallback to ring1 should never trigger in practice since the matrix already filters for players who need a ring.
function getNeededRingSlot(player: SnapshotPlayer): GearSlot {
  const ring1 = player.gear.find(g => g.slot === 'ring1');
  const ring2 = player.gear.find(g => g.slot === 'ring2');
  const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
  const needsRing2 = ring2?.bisSource === 'raid' && !ring2?.hasItem;

  // Prioritize ring1 if needed (or both), otherwise ring2
  if (needsRing1) return 'ring1';
  if (needsRing2) return 'ring2';
  return 'ring1'; // Fallback (shouldn't trigger - player must need a ring to appear in this row)
}

export function WhoNeedsItMatrix({
  players,
  floors,
  onLogClick,
  showLogButtons = true,
}: WhoNeedsItMatrixProps) {
  const [selectedFloor, setSelectedFloor] = useState<FloorFilter>('all');

  // Sort players by raid position
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const aIdx = a.position ? POSITION_ORDER.indexOf(a.position as RaidPosition) : 999;
      const bIdx = b.position ? POSITION_ORDER.indexOf(b.position as RaidPosition) : 999;
      return aIdx - bIdx;
    });
  }, [players]);

  // Get slots for selected floor
  const visibleSlots = useMemo(() => {
    if (selectedFloor === 'all') {
      // Combine all floors, using ring1 as "Ring" (consolidated)
      return [
        ...FLOOR_LOOT_TABLES[1].gearDrops,
        ...FLOOR_LOOT_TABLES[2].gearDrops,
        ...FLOOR_LOOT_TABLES[3].gearDrops,
        ...FLOOR_LOOT_TABLES[4].gearDrops,
      ];
    }
    return FLOOR_LOOT_TABLES[selectedFloor].gearDrops;
  }, [selectedFloor]);

  // Calculate needs matrix
  const needsMatrix = useMemo(() => {
    return visibleSlots.map(slot => {
      const playersWhoNeed = sortedPlayers.filter(player => {
        // Special handling for ring - check both ring1 and ring2
        if (slot === 'ring1') {
          const ring1 = player.gear.find(g => g.slot === 'ring1');
          const ring2 = player.gear.find(g => g.slot === 'ring2');
          return (ring1?.bisSource === 'raid' && !ring1?.hasItem) ||
                 (ring2?.bisSource === 'raid' && !ring2?.hasItem);
        }
        const gearSlot = player.gear.find(g => g.slot === slot);
        return gearSlot?.bisSource === 'raid' && !gearSlot?.hasItem;
      });

      return {
        slot,
        displayName: slot === 'ring1' ? 'Ring' : GEAR_SLOT_NAMES[slot],
        playersWhoNeed: new Set(playersWhoNeed.map(p => p.id)),
        count: playersWhoNeed.length,
        isFree: playersWhoNeed.length === 0,
      };
    });
  }, [visibleSlots, sortedPlayers]);

  return (
    <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden">
      {/* Floor Filter Tabs */}
      <div className="flex items-center gap-2 p-3 border-b border-border-default bg-surface-elevated/50">
        <span className="text-xs text-text-muted mr-1">Floor:</span>
        {(['all', 1, 2, 3, 4] as FloorFilter[]).map(floor => {
          const isSelected = selectedFloor === floor;
          const floorColors = floor !== 'all' ? FLOOR_COLORS[floor] : null;

          return (
            <button
              key={floor}
              onClick={() => setSelectedFloor(floor)}
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
              {floor === 'all' ? 'All' : floors[floor - 1] || `Floor ${floor}`}
            </button>
          );
        })}
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated/30">
              <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">
                Slot
              </th>
              {sortedPlayers.map(player => (
                <th key={player.id} className="text-center py-2 px-2 min-w-[60px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <span
                        className="text-xs font-bold"
                        style={{ color: getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster') }}
                      >
                        {player.position || '?'}
                      </span>
                      <JobIcon job={player.job} size="xs" />
                    </div>
                    <span className="text-[10px] text-text-muted truncate max-w-[56px]">
                      {player.name.split(' ')[0]}
                    </span>
                  </div>
                </th>
              ))}
              <th className="text-center py-2 px-3 text-xs text-text-muted font-medium">
                Need
              </th>
            </tr>
          </thead>
          <tbody>
            {needsMatrix.map(({ slot, displayName, playersWhoNeed, count, isFree }) => (
              <tr key={slot} className="border-t border-border-default/50 hover:bg-surface-hover/30">
                <td className="py-2 px-3 text-text-primary font-medium text-xs">
                  {displayName}
                </td>
                {sortedPlayers.map(player => {
                  const needs = playersWhoNeed.has(player.id);
                  const roleColor = getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');

                  return (
                    <td key={player.id} className="text-center py-2 px-2">
                      {needs ? (
                        <button
                          onClick={() => {
                            if (showLogButtons && onLogClick) {
                              // For ring row, determine which ring slot this player actually needs
                              const actualSlot = slot === 'ring1'
                                ? getNeededRingSlot(player)
                                : slot as GearSlot;
                              const floorNum = getFloorForSlot(actualSlot);
                              const floorName = floors[floorNum - 1] || `Floor ${floorNum}`;
                              onLogClick(actualSlot, player, floorName);
                            }
                          }}
                          disabled={!showLogButtons}
                          className={`
                            w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-all
                            ${showLogButtons ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
                          `}
                          style={{
                            backgroundColor: `${roleColor}30`,
                            border: `2px solid ${roleColor}`,
                          }}
                          title={showLogButtons ? `Log ${displayName} to ${player.name}` : `${player.name} needs ${displayName}`}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: roleColor }}
                          />
                        </button>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-surface-interactive border border-border-subtle mx-auto" />
                      )}
                    </td>
                  );
                })}
                <td className="text-center py-2 px-3">
                  {isFree ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-success/20 text-status-success border border-status-success/30">
                      FREE
                    </span>
                  ) : (
                    <span className={`text-xs ${
                      count > 4 ? 'text-status-error' : count > 2 ? 'text-status-warning' : 'text-text-muted'
                    }`}>
                      {count}/8
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t border-border-default bg-surface-elevated/30 text-[10px] text-text-muted">
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center bg-role-tank/20 border-2 border-role-tank"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-role-tank" />
          </div>
          <span>Needs for BiS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-surface-interactive border border-border-subtle" />
          <span>Has or not BiS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-success/20 text-status-success border border-status-success/30">
            FREE
          </span>
          <span>No one needs</span>
        </div>
      </div>
    </div>
  );
}

export default WhoNeedsItMatrix;
