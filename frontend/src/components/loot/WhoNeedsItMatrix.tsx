/**
 * WhoNeedsItMatrix Component
 *
 * Matrix view showing which players need which gear slots.
 * Features:
 * - Position-first headers (T1, T2, H1, H2, M1, M2, R1, R2)
 * - "FREE" badge when no one needs an item
 * - Floor filter tabs with color coding (using FilterBar)
 * - Click indicator to quick-log loot
 * - Supports controlled or uncontrolled floor selection
 */

import { useMemo, useState } from 'react';
import type { SnapshotPlayer, GearSlot, MaterialType, RaidPosition } from '../../types';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS } from '../../types';
import {
  FLOOR_LOOT_TABLES, FLOOR_COLORS, getFloorForSlot,
  UPGRADE_MATERIAL_SLOTS, UPGRADE_MATERIAL_DISPLAY_NAMES,
  getFloorForUpgradeMaterial,
  type FloorNumber, type UpgradeMaterialType,
} from '../../gamedata/loot-tables';
import { getRoleColor } from '../../gamedata';
import { JobIcon } from '../ui/JobIcon';
import { Tooltip } from '../primitives';
import { FilterBar } from './FilterBar';

type FloorFilter = FloorNumber | 'all';

/** Material CSS color variables */
const MATERIAL_COLORS: Record<string, string> = {
  twine: 'var(--color-material-twine)',
  glaze: 'var(--color-material-glaze)',
  solvent: 'var(--color-material-solvent)',
  universal_tomestone: 'var(--color-material-tomestone)',
};

/** Material order for display */
const MATERIAL_ORDER: UpgradeMaterialType[] = ['twine', 'glaze', 'solvent', 'universal_tomestone'];

interface WhoNeedsItMatrixProps {
  players: SnapshotPlayer[];
  floors: string[];  // e.g., ["M9S", "M10S", "M11S", "M12S"]
  onLogClick?: (slot: GearSlot, player: SnapshotPlayer, floor: string) => void;
  onMaterialLogClick?: (material: MaterialType, player: SnapshotPlayer) => void;
  showLogButtons?: boolean;
  /** Controlled floor selection - if provided, component is controlled */
  selectedFloor?: FloorFilter;
  /** Callback when floor changes (required if selectedFloor is provided) */
  onFloorChange?: (floor: FloorFilter) => void;
}

// Position order for sorting players
const POSITION_ORDER: RaidPosition[] = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];

// Gear slot display order: Weapon first, then left side (head to feet), then accessories
const GEAR_SLOT_ORDER: GearSlot[] = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1'];

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

/**
 * Donut progress indicator for material needs.
 * A segmented ring where each segment = one tome BiS slot for this material.
 * Bright segments = still needed, dim segments = already augmented.
 * Uses stroke-dasharray on circles for reliable rendering.
 */
function MaterialPieIndicator({ total, augmented, roleColor, size = 28 }: {
  total: number;
  augmented: number;
  roleColor: string;
  size?: number;
}) {
  const needed = total - augmented;
  const strokeW = 3;
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 1 ? 2 : 0;
  const segmentLength = circumference / total - gap;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {/* Background ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={roleColor}
        strokeWidth={1}
        strokeOpacity={0.15}
      />
      {/* Segments */}
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < augmented; // first N segments are augmented
        // Offset: rotate so segment 0 starts at top (12 o'clock)
        // stroke-dashoffset is measured clockwise from 3 o'clock, so shift by +circumference/4
        const offset = circumference / 4 - i * (segmentLength + gap);
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={roleColor}
            strokeWidth={isFilled ? 2 : strokeW}
            strokeOpacity={isFilled ? 0.25 : 1}
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={offset}
          />
        );
      })}
      {/* Center number */}
      <text
        x={cx}
        y={cy + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fill={roleColor}
        fontSize={size <= 16 ? 7 : total === 1 ? 10 : 9}
        fontWeight="bold"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {needed}
      </text>
    </svg>
  );
}

export function WhoNeedsItMatrix({
  players,
  floors,
  onLogClick,
  onMaterialLogClick,
  showLogButtons = true,
  selectedFloor: controlledFloor,
  onFloorChange,
}: WhoNeedsItMatrixProps) {
  // Support both controlled and uncontrolled modes
  const [localFloor, setLocalFloor] = useState<FloorFilter>('all');
  const selectedFloor = controlledFloor ?? localFloor;
  const handleFloorChange = (floor: FloorFilter) => {
    if (onFloorChange) {
      onFloorChange(floor);
    } else {
      setLocalFloor(floor);
    }
  };

  // Sort players by raid position
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const aIdx = a.position ? POSITION_ORDER.indexOf(a.position as RaidPosition) : 999;
      const bIdx = b.position ? POSITION_ORDER.indexOf(b.position as RaidPosition) : 999;
      return aIdx - bIdx;
    });
  }, [players]);

  // Always show all slots to prevent layout shift when changing floors
  // We'll dim slots that aren't relevant to the selected floor
  const visibleSlots = useMemo(() => {
    // Always show all slots in consistent order
    const allSlots: GearSlot[] = [
      ...FLOOR_LOOT_TABLES[1].gearDrops,
      ...FLOOR_LOOT_TABLES[2].gearDrops,
      ...FLOOR_LOOT_TABLES[3].gearDrops,
      ...FLOOR_LOOT_TABLES[4].gearDrops,
    ];
    return allSlots.sort((a, b) => GEAR_SLOT_ORDER.indexOf(a) - GEAR_SLOT_ORDER.indexOf(b));
  }, []);

  // Determine which slots are active for the selected floor
  const activeSlotsForFloor = useMemo(() => {
    if (selectedFloor === 'all') {
      return new Set(visibleSlots);
    }
    return new Set(FLOOR_LOOT_TABLES[selectedFloor].gearDrops);
  }, [selectedFloor, visibleSlots]);

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

  // Determine which materials are active for the selected floor
  const activeMaterialsForFloor = useMemo(() => {
    if (selectedFloor === 'all') {
      return new Set(MATERIAL_ORDER);
    }
    return new Set(FLOOR_LOOT_TABLES[selectedFloor].upgradeMaterials);
  }, [selectedFloor]);

  // Calculate material needs matrix with per-player counts
  const materialNeedsMatrix = useMemo(() => {
    return MATERIAL_ORDER.map(material => {
      // Per-player: { total tome BiS slots, augmented count, needed count }
      const playerCounts = new Map<string, { total: number; augmented: number; needed: number }>();

      sortedPlayers.forEach(player => {
        let total = 0;
        let augmented = 0;

        if (material === 'universal_tomestone') {
          // Binary: pursuing tome weapon or not
          if (player.tomeWeapon?.pursuing) {
            total = 1;
            augmented = player.tomeWeapon?.hasItem ? 1 : 0;
          }
        } else if (material === 'solvent') {
          // Binary: tome weapon augmentation
          if (player.tomeWeapon?.pursuing && player.tomeWeapon?.hasItem) {
            total = 1;
            augmented = player.tomeWeapon?.isAugmented ? 1 : 0;
          }
        } else {
          // Twine/glaze: count tome BiS slots that have the item (actionable for augmentation)
          // Only slots with hasItem=true are counted, matching the modal's eligibility logic.
          // This ensures the pie updates when a material is logged with "mark as augmented".
          const slotsToCheck = UPGRADE_MATERIAL_SLOTS[material];
          slotsToCheck.forEach(slot => {
            const gearSlot = player.gear.find(g => g.slot === slot);
            if (gearSlot?.bisSource === 'tome' && gearSlot?.hasItem) {
              total++;
              if (gearSlot.isAugmented) augmented++;
            }
          });
        }

        const needed = total - augmented;
        if (total > 0) {
          playerCounts.set(player.id, { total, augmented, needed });
        }
      });

      const playersWhoNeed = new Set(
        [...playerCounts.entries()]
          .filter(([, counts]) => counts.needed > 0)
          .map(([id]) => id)
      );

      // Sum total materials needed across all players
      let totalNeeded = 0;
      for (const [, c] of playerCounts) {
        totalNeeded += c.needed;
      }

      return {
        material,
        displayName: UPGRADE_MATERIAL_DISPLAY_NAMES[material],
        playersWhoNeed,
        playerCounts,
        count: playersWhoNeed.size,
        totalNeeded,
        isFree: playersWhoNeed.size === 0,
      };
    });
  }, [sortedPlayers]);

  // Check if any materials are visible (floors that have materials)
  const hasMaterialsForFloor = activeMaterialsForFloor.size > 0;

  return (
    <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden flex flex-col h-full sm:block sm:h-auto">
      {/* Floor Filter Tabs - fixed on mobile */}
      <div className="flex-shrink-0 p-3 border-b border-border-default bg-surface-elevated">
        <FilterBar
          type="floor"
          floors={floors}
          selectedFloor={selectedFloor}
          onFloorChange={handleFloorChange}
          showAllOption
        />
      </div>

      {/* Desktop: Matrix Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated/30">
              <th className="text-left py-2.5 px-3 text-sm text-text-muted font-medium">
                Slot
              </th>
              {sortedPlayers.map(player => (
                <th key={player.id} className="text-center py-2.5 px-2 min-w-[68px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <span
                        className="text-sm font-bold"
                        style={{ color: getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster') }}
                      >
                        {player.position || '?'}
                      </span>
                      <JobIcon job={player.job} size="sm" />
                    </div>
                    <Tooltip content={player.name}>
                      <span className="text-xs text-text-muted truncate max-w-[60px] block">
                        {player.name.split(' ')[0]}
                      </span>
                    </Tooltip>
                  </div>
                </th>
              ))}
              <th className="text-center py-2.5 px-3 text-sm text-text-muted font-medium">
                Need
              </th>
            </tr>
          </thead>
          <tbody>
            {needsMatrix.map(({ slot, displayName, playersWhoNeed, count, isFree }) => {
              const isActiveSlot = activeSlotsForFloor.has(slot);
              const slotFloor = getFloorForSlot(slot);
              // Apply floor color to slot text when a specific floor is selected
              const slotTextColor = selectedFloor !== 'all' && isActiveSlot
                ? FLOOR_COLORS[slotFloor].hex
                : undefined;
              return (
              <tr key={slot} className={`border-t border-border-default/50 ${isActiveSlot ? 'hover:bg-surface-hover/30' : 'opacity-30'}`}>
                <td className="py-2.5 px-3 font-medium text-sm">
                  <div className="flex items-center gap-2">
                    <img
                      src={GEAR_SLOT_ICONS[slot as GearSlot]}
                      alt=""
                      className="w-5 h-5 brightness-[3.0]"
                    />
                    <span style={slotTextColor ? { color: slotTextColor } : undefined} className={!slotTextColor ? 'text-text-primary' : undefined}>{displayName}</span>
                  </div>
                </td>
                {sortedPlayers.map(player => {
                  const needs = playersWhoNeed.has(player.id);
                  const roleColor = getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');

                  return (
                    <td key={player.id} className="text-center py-2.5 px-2">
                      {needs ? (
                        <Tooltip
                          content={showLogButtons ? `Log ${displayName} to ${player.name}` : `${player.name} needs ${displayName}`}
                        >
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
                            disabled={!showLogButtons || !isActiveSlot}
                            className={`
                              w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-all
                              ${showLogButtons && isActiveSlot ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
                            `}
                            style={{
                              backgroundColor: `color-mix(in srgb, ${roleColor} 30%, transparent)`,
                              border: `2px solid ${roleColor}`,
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: roleColor }}
                            />
                          </button>
                        </Tooltip>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-surface-interactive border border-border-subtle mx-auto" />
                      )}
                    </td>
                  );
                })}
                <td className="text-center py-2.5 px-3">
                  {isFree ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-status-success/20 text-status-success border border-status-success/30">
                      FREE
                    </span>
                  ) : (
                    <span className={`text-sm font-medium ${
                      count > 4 ? 'text-status-error' : count > 2 ? 'text-status-warning' : 'text-text-muted'
                    }`}>
                      {count}/8
                    </span>
                  )}
                </td>
              </tr>
            );})}
          </tbody>

          {/* Material rows */}
          {(
            <tbody>
              {/* Separator row */}
              <tr>
                <td colSpan={sortedPlayers.length + 2} className="px-3 pt-3 pb-1">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Materials</div>
                </td>
              </tr>
              {materialNeedsMatrix.map(({ material, displayName, playersWhoNeed, playerCounts, count, totalNeeded, isFree }) => {
                const isActiveMaterial = activeMaterialsForFloor.has(material);
                const materialColor = MATERIAL_COLORS[material];
                const materialFloors = getFloorForUpgradeMaterial(material);
                const floorColor = materialFloors.length > 0 ? FLOOR_COLORS[materialFloors[0]].hex : undefined;

                return (
                  <tr key={material} className={`border-t border-border-default/50 ${isActiveMaterial ? 'hover:bg-surface-hover/30' : 'opacity-30'}`}>
                    <td className="py-2.5 px-3 font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: materialColor, opacity: 0.7 }}
                        />
                        <span style={floorColor && selectedFloor !== 'all' && isActiveMaterial ? { color: floorColor } : { color: materialColor }}>
                          {displayName}
                        </span>
                      </div>
                    </td>
                    {sortedPlayers.map(player => {
                      const needs = playersWhoNeed.has(player.id);
                      const counts = playerCounts.get(player.id);
                      const roleColor = getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');

                      return (
                        <td key={player.id} className="text-center py-2.5 px-2">
                          {needs && counts ? (
                            <Tooltip
                              content={
                                showLogButtons
                                  ? `Log ${displayName} to ${player.name} (needs ${counts.needed}${counts.total > 1 ? `/${counts.total}` : ''})`
                                  : `${player.name} needs ${counts.needed} ${displayName}${counts.total > 1 ? ` (${counts.augmented}/${counts.total} done)` : ''}`
                              }
                            >
                              {/* design-system-ignore: Matrix cell button requires specific pie styling */}
                              <button
                                onClick={() => {
                                  if (showLogButtons && onMaterialLogClick && isActiveMaterial) {
                                    onMaterialLogClick(material as MaterialType, player);
                                  }
                                }}
                                disabled={!showLogButtons || !isActiveMaterial}
                                className={`
                                  mx-auto transition-all
                                  ${showLogButtons && isActiveMaterial ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
                                `}
                              >
                                <MaterialPieIndicator
                                  total={counts.total}
                                  augmented={counts.augmented}
                                  roleColor={roleColor}
                                />
                              </button>
                            </Tooltip>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-surface-interactive border border-border-subtle mx-auto" />
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center py-2.5 px-3">
                      {isFree ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-status-success/20 text-status-success border border-status-success/30">
                          FREE
                        </span>
                      ) : (
                        <Tooltip content={`${count} player${count !== 1 ? 's' : ''} need ${totalNeeded} total`}>
                          <span className={`text-sm font-medium ${
                            totalNeeded > 8 ? 'text-status-error' : totalNeeded > 4 ? 'text-status-warning' : 'text-text-muted'
                          }`}>
                            {totalNeeded}
                          </span>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Mobile: Card view - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto md:hidden divide-y divide-border-default">
        {needsMatrix.map(({ slot, displayName, playersWhoNeed, count, isFree }) => {
          const isActiveSlot = activeSlotsForFloor.has(slot);
          const slotFloor = getFloorForSlot(slot);
          const slotTextColor = selectedFloor !== 'all' && isActiveSlot
            ? FLOOR_COLORS[slotFloor].hex
            : undefined;
          return (
          <div key={slot} className={`p-3 ${!isActiveSlot ? 'opacity-30' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <img
                  src={GEAR_SLOT_ICONS[slot as GearSlot]}
                  alt=""
                  className="w-4 h-4 brightness-[3.0]"
                />
                <span className={`font-medium ${!slotTextColor ? 'text-text-primary' : ''}`} style={slotTextColor ? { color: slotTextColor } : undefined}>{displayName}</span>
              </div>
              {isFree ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-success/20 text-status-success border border-status-success/30">
                  FREE
                </span>
              ) : (
                <span className={`text-xs ${
                  count > 4 ? 'text-status-error' : count > 2 ? 'text-status-warning' : 'text-text-muted'
                }`}>
                  {count}/8 need
                </span>
              )}
            </div>
            {!isFree && (
              <div className="flex flex-wrap gap-1.5">
                {sortedPlayers
                  .filter(p => playersWhoNeed.has(p.id))
                  .map(player => {
                    const roleColor = getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');
                    return (
                      <button
                        key={player.id}
                        onClick={() => {
                          if (showLogButtons && onLogClick && isActiveSlot) {
                            const actualSlot = slot === 'ring1'
                              ? getNeededRingSlot(player)
                              : slot as GearSlot;
                            const floorNum = getFloorForSlot(actualSlot);
                            const floorName = floors[floorNum - 1] || `Floor ${floorNum}`;
                            onLogClick(actualSlot, player, floorName);
                          }
                        }}
                        disabled={!showLogButtons || !isActiveSlot}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${roleColor} 20%, transparent)`,
                          color: roleColor,
                        }}
                      >
                        <JobIcon job={player.job} size="xs" />
                        <span>{player.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        );})}

        {/* Material cards (mobile) */}
        {(
          <>
            <div className="px-3 pt-3 pb-1 border-t border-border-default">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Materials</div>
            </div>
            {materialNeedsMatrix.map(({ material, displayName, playersWhoNeed, playerCounts, count, totalNeeded, isFree }) => {
              const isActiveMaterial = activeMaterialsForFloor.has(material);
              const materialColor = MATERIAL_COLORS[material];
              return (
                <div key={material} className={`p-3 ${!isActiveMaterial ? 'opacity-30' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: materialColor, opacity: 0.7 }}
                      />
                      <span className="font-medium" style={{ color: materialColor }}>{displayName}</span>
                    </div>
                    {isFree ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-success/20 text-status-success border border-status-success/30">
                        FREE
                      </span>
                    ) : (
                      <span className={`text-xs ${
                        totalNeeded > 8 ? 'text-status-error' : totalNeeded > 4 ? 'text-status-warning' : 'text-text-muted'
                      }`}>
                        {totalNeeded} needed ({count} players)
                      </span>
                    )}
                  </div>
                  {!isFree && (
                    <div className="flex flex-wrap gap-1.5">
                      {sortedPlayers
                        .filter(p => playersWhoNeed.has(p.id))
                        .map(player => {
                          const roleColor = getRoleColor(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');
                          const counts = playerCounts.get(player.id);
                          return (
                            /* design-system-ignore: Matrix chip button requires specific styling */
                            <button
                              key={player.id}
                              onClick={() => {
                                if (showLogButtons && onMaterialLogClick && isActiveMaterial) {
                                  onMaterialLogClick(material as MaterialType, player);
                                }
                              }}
                              disabled={!showLogButtons || !isActiveMaterial}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${roleColor} 20%, transparent)`,
                                color: roleColor,
                              }}
                            >
                              <JobIcon job={player.job} size="xs" />
                              <span>{player.name.split(' ')[0]}</span>
                              {counts && counts.needed > 0 && (
                                <span className="font-bold opacity-80">×{counts.needed}</span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 p-3 border-t border-border-default bg-surface-elevated/30 text-[10px] text-text-muted">
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center bg-role-tank/20 border-2 border-role-tank"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-role-tank" />
          </div>
          <span>Needs gear</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MaterialPieIndicator total={3} augmented={1} roleColor="var(--color-role-tank)" size={16} />
          <span>Needs material (slices = progress)</span>
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
