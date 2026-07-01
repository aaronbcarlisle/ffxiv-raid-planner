/**
 * Enhanced priority entries — PROMOTED VERBATIM from
 * components/loot/LootPriorityPanel.tsx `enhanceEntries` (F6d Task 1,
 * sanctioned repoint per spec §6.2). One shared implementation for the legacy
 * panel and the v2 Loot surfaces (FloorCard, RecipientPicker). Do not "improve"
 * the logic here — behavior parity with the legacy panel is the contract.
 */
import type { StaticSettings, LootLogEntry } from '../types';
import {
  calculatePriorityScoreWithBreakdown,
  type PriorityEntry,
  type PriorityScoreBreakdown,
} from './priority';
import {
  calculatePlayerLootStats,
  calculateEnhancedScoreWithBreakdown,
} from './lootCoordination';

export interface EnhancedPriorityEntry extends PriorityEntry {
  enhancedScore?: number;
  droughtBonus?: number;
  balancePenalty?: number;
  breakdown?: PriorityScoreBreakdown;
}

export interface EnhanceContext {
  settings: StaticSettings;
  lootLog: LootLogEntry[];
  currentWeek: number;
  averageDrops: number;
  /** The panel's `isEnhancedScoringActive` gate — false ⇒ breakdowns only, no re-sort. */
  active: boolean;
}

export function enhancePriorityEntries(
  entries: PriorityEntry[],
  { settings, lootLog, currentWeek, averageDrops, active }: EnhanceContext,
): EnhancedPriorityEntry[] {
  const entriesWithBreakdown = entries.map((entry) => {
    const breakdown = calculatePriorityScoreWithBreakdown(entry.player, settings);
    return {
      ...entry,
      breakdown,
    };
  });

  if (!active) {
    return entriesWithBreakdown;
  }

  return entriesWithBreakdown.map((entry) => {
    const stats = calculatePlayerLootStats(entry.player.id, lootLog, currentWeek);
    const enhanced = calculateEnhancedScoreWithBreakdown(
      entry.score,
      stats,
      averageDrops,
      settings
    );

    return {
      ...entry,
      enhancedScore: enhanced.score,
      droughtBonus: enhanced.droughtBonus,
      balancePenalty: enhanced.balancePenalty,
    };
  }).sort((a, b) => {
    const scoreA = a.enhancedScore ?? a.score;
    const scoreB = b.enhancedScore ?? b.score;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.player.name.localeCompare(b.player.name);
  });
}
