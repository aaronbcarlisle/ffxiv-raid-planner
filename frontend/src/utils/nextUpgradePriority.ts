/**
 * computeNextUpgradePriorities — the `need.up` derivation (spec §5.8).
 *
 * For each droppable gear slot, the #1 entry in the Loot queue marks that
 * `(player, slot)` as "next upgrade". The correctness contract is AGREEMENT
 * WITH THE LOOT QUEUE: this reproduces `components/loot/FloorCard.tsx:56-87`'s
 * pipeline exactly — the legacy enhanced-scoring gate, `calculateAverageDrops`,
 * and the `enhancePriorityEntries` call — so the Board's ● can never contradict
 * the Loot tab's #1. The ring drop is resolved to the top player's actually
 * needed ring slot using `getPriorityForRing`'s own need predicate
 * (`priority.ts:381-382`: `bisSource === 'raid' && !hasItem`).
 */
import { FLOOR_LOOT_TABLES, type FloorNumber } from '../gamedata/loot-tables';
import { getPriorityForItem, getPriorityForRing, isPriorityDisabled } from './priority';
import { enhancePriorityEntries } from './priorityEntries';
import { calculateAverageDrops } from './lootCoordination';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, GearSlot } from '../types';

export function computeNextUpgradePriorities(args: {
  /** Pass the MAIN ROSTER (configured, non-substitute) — FloorCard parity. */
  players: SnapshotPlayer[];
  settings: StaticSettings;
  lootLog: LootLogEntry[];
  currentWeek: number;
}): Map<string, Set<GearSlot>> {
  const { players, settings, lootLog, currentWeek } = args;
  const map = new Map<string, Set<GearSlot>>();

  // spec §5.8: need.up is only rendered when priority is active.
  if (isPriorityDisabled(settings)) return map;

  // FloorCard.tsx:68 parity — the Board ● must agree with the Loot queue #1.
  // The legacy gate is `enableEnhancedScoring && !isPriorityDisabled && lootLog.length > 0`;
  // the `!isPriorityDisabled(settings)` term is hoisted out because the early
  // return above already guarantees it here (leaving it in would read as drift).
  const enhancedActive = settings.enableEnhancedScoring === true && lootLog.length > 0;
  const averageDrops = enhancedActive ? calculateAverageDrops(players.map((p) => p.id), lootLog) : 0;

  for (const floorNumber of [1, 2, 3, 4] as FloorNumber[]) {
    for (const slot of FLOOR_LOOT_TABLES[floorNumber].gearDrops) {
      const base = slot === 'ring1'
        ? getPriorityForRing(players, settings)
        : getPriorityForItem(players, slot, settings);
      const top = enhancePriorityEntries(base, {
        settings, lootLog, currentWeek, averageDrops, active: enhancedActive,
      })[0];
      if (!top) continue;

      let resolved: GearSlot = slot;
      if (slot === 'ring1') {
        // getPriorityForRing counts a player as needing "ring" if EITHER ring is
        // an unowned raid slot. Resolve to the ring they actually still need,
        // preferring ring1 when both are needed.
        const ring1 = top.player.gear.find((g) => g.slot === 'ring1');
        const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
        resolved = needsRing1 ? 'ring1' : 'ring2';
      }

      const set = map.get(top.player.id) ?? new Set<GearSlot>();
      set.add(resolved);
      map.set(top.player.id, set);
    }
  }

  return map;
}
