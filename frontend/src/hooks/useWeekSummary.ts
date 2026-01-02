/**
 * useWeekSummary Hook
 *
 * Aggregates loot, material, and book data per player for a given week.
 * Used by the Unified Week Overview to show all activity in one view.
 */

import { useMemo } from 'react';
import type {
  SnapshotPlayer,
  LootLogEntry,
  MaterialLogEntry,
  PageLedgerEntry,
  MaterialType,
} from '../types';
import { GEAR_SLOT_NAMES } from '../types';

export interface MaterialEntry {
  entryId: number;
  floor: string;
  materialType: MaterialType;
}

export interface PlayerWeekSummary {
  player: SnapshotPlayer;
  // Loot received this week
  lootReceived: Array<{
    floor: string;
    slot: string;
    slotName: string;
    method: string;
    entryId: number;
  }>;
  // Materials received this week (individual entries)
  materialEntries: MaterialEntry[];
  // Materials received this week (aggregated counts - for display)
  materialsReceived: {
    twine: number;
    glaze: number;
    solvent: number;
  };
  // Books earned/spent this week (net change)
  bookChanges: {
    I: number;
    II: number;
    III: number;
    IV: number;
  };
  // Whether player cleared each floor this week (based on book earned entries)
  floorsCleared: string[];
}

interface UseWeekSummaryParams {
  players: SnapshotPlayer[];
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  pageLedger: PageLedgerEntry[];
  week: number;
}

export function useWeekSummary({
  players,
  lootLog,
  materialLog,
  pageLedger,
  week,
}: UseWeekSummaryParams): PlayerWeekSummary[] {
  return useMemo(() => {
    // Filter entries for the selected week
    const weekLoot = lootLog.filter((e) => e.weekNumber === week);
    const weekMaterials = materialLog.filter((e) => e.weekNumber === week);
    const weekLedger = pageLedger.filter((e) => e.weekNumber === week);

    // Build summary per player
    return players
      .filter((p) => p.configured)
      .map((player) => {
        // Get loot for this player
        const playerLoot = weekLoot.filter(
          (e) => e.recipientPlayerId === player.id
        );
        const lootReceived = playerLoot.map((e) => ({
          floor: e.floor,
          slot: e.itemSlot,
          slotName:
            GEAR_SLOT_NAMES[e.itemSlot as keyof typeof GEAR_SLOT_NAMES] ||
            e.itemSlot,
          method: e.method,
          entryId: e.id,
        }));

        // Get materials for this player
        const playerMaterials = weekMaterials.filter(
          (e) => e.recipientPlayerId === player.id
        );
        const materialEntries: MaterialEntry[] = playerMaterials.map((e) => ({
          entryId: e.id,
          floor: e.floor,
          materialType: e.materialType as MaterialType,
        }));
        const materialsReceived = {
          twine: playerMaterials.filter((e) => e.materialType === 'twine')
            .length,
          glaze: playerMaterials.filter((e) => e.materialType === 'glaze')
            .length,
          solvent: playerMaterials.filter((e) => e.materialType === 'solvent')
            .length,
        };

        // Get book changes for this player
        const playerLedger = weekLedger.filter(
          (e) => e.playerId === player.id
        );
        const bookChanges = {
          I: playerLedger
            .filter((e) => e.bookType === 'I')
            .reduce((sum, e) => sum + e.quantity, 0),
          II: playerLedger
            .filter((e) => e.bookType === 'II')
            .reduce((sum, e) => sum + e.quantity, 0),
          III: playerLedger
            .filter((e) => e.bookType === 'III')
            .reduce((sum, e) => sum + e.quantity, 0),
          IV: playerLedger
            .filter((e) => e.bookType === 'IV')
            .reduce((sum, e) => sum + e.quantity, 0),
        };

        // Determine which floors were cleared (earned entries)
        const floorsCleared = [
          ...new Set(
            playerLedger
              .filter((e) => e.transactionType === 'earned')
              .map((e) => e.floor)
          ),
        ];

        return {
          player,
          lootReceived,
          materialEntries,
          materialsReceived,
          bookChanges,
          floorsCleared,
        };
      });
  }, [players, lootLog, materialLog, pageLedger, week]);
}

/**
 * Format materials received as a compact string
 * e.g., "T:1 G:1" for 1 twine and 1 glaze
 */
export function formatMaterials(materials: {
  twine: number;
  glaze: number;
  solvent: number;
}): string {
  const parts: string[] = [];
  if (materials.twine > 0) parts.push(`T:${materials.twine}`);
  if (materials.glaze > 0) parts.push(`G:${materials.glaze}`);
  if (materials.solvent > 0) parts.push(`S:${materials.solvent}`);
  return parts.length > 0 ? parts.join(' ') : '-';
}

/**
 * Format book change as a signed number
 * e.g., "+1" for earned, "-2" for spent
 */
export function formatBookChange(change: number): string {
  if (change === 0) return '-';
  return change > 0 ? `+${change}` : String(change);
}

/**
 * Get material type display info
 */
export const MATERIAL_INFO: Record<
  MaterialType,
  { label: string; shortLabel: string; color: string }
> = {
  twine: { label: 'Twine', shortLabel: 'T', color: 'text-blue-400' },
  glaze: { label: 'Glaze', shortLabel: 'G', color: 'text-purple-400' },
  solvent: { label: 'Solvent', shortLabel: 'S', color: 'text-amber-400' },
};
