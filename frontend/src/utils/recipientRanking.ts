/**
 * Recipient ranking for the unified RecipientPicker (F6d, spec §5.3).
 * FRESH-AUDITED consolidation of the ranking + visibility logic the two legacy
 * gear-drop modals forked (QuickLogDropModal.tsx:193-235 hardcoded-caps variant,
 * AddLootEntryModal.tsx:203-294 visibility matrix). v2 uses the CONFIGURABLE
 * enhanced scoring (utils/priorityEntries) everywhere — the modals' hardcoded
 * caps 50/45 drift ends here (spec §9 documents the possible v1↔v2 ranking
 * difference under custom caps; the legacy modals were the bug).
 */
import type { SnapshotPlayer, StaticSettings, GearSlot, LootLogEntry } from '../types';
import { GEAR_SLOT_NAMES } from '../types';
import { getPriorityForItem, getPriorityForRing } from './priority';
import { calculatePlayerLootStats, calculateAverageDrops } from './lootCoordination';
import { enhancePriorityEntries } from './priorityEntries';

export type PickerScope = 'priority' | 'all' | 'offspec';
export type NeedTag = 'bis' | 'minor' | 'free';

export interface RecipientEntry {
  player: SnapshotPlayer;
  rank: number | null;
  needsItem: boolean;
  reason: string;
  needTag: NeedTag;
}

function slotLabel(slot: GearSlot | 'ring'): string {
  return slot === 'ring' ? 'Ring' : (GEAR_SLOT_NAMES[slot] ?? slot);
}

function dropsPhrase(playerId: string, lootLog: LootLogEntry[], currentWeek: number): string {
  const drops = calculatePlayerLootStats(playerId, lootLog, currentWeek).totalDrops;
  return `${drops} drop${drops === 1 ? '' : 's'} this tier`;
}

/** Does this player hold the raid-BiS item for the slot (ring = either ring)? */
function slotState(player: SnapshotPlayer, slot: GearSlot | 'ring'): { raidBis: boolean; has: boolean } {
  const slots = slot === 'ring' ? (['ring1', 'ring2'] as const) : ([slot] as const);
  let raidBis = false;
  let hasAll = true;
  for (const s of slots) {
    const g = player.gear.find((x) => x.slot === s);
    if (g?.bisSource === 'raid') {
      raidBis = true;
      if (!g.hasItem) hasAll = false;
    }
  }
  return { raidBis, has: raidBis && hasAll };
}

export function buildRecipientEntries(args: {
  players: SnapshotPlayer[];
  slot: GearSlot | 'ring';
  scope: PickerScope;
  settings: StaticSettings;
  lootLog: LootLogEntry[];
  currentWeek: number;
  enhancedActive: boolean;
}): RecipientEntry[] {
  const { players, slot, scope, settings, lootLog, currentWeek, enhancedActive } = args;
  const configured = players.filter((p) => p.configured);
  const mainRoster = configured.filter((p) => !p.isSubstitute);
  const label = slotLabel(slot);

  if (scope === 'offspec') {
    return [...configured]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((player) => ({
        player, rank: null, needsItem: false, needTag: 'free' as const,
        reason: `Off-spec / free roll · ${dropsPhrase(player.id, lootLog, currentWeek)}`,
      }));
  }

  const pool = scope === 'priority' ? mainRoster : configured;
  const baseEntries = slot === 'ring'
    ? getPriorityForRing(pool, settings)
    : getPriorityForItem(pool, slot, settings);
  const averageDrops = lootLog.length > 0 ? calculateAverageDrops(pool.map((p) => p.id), lootLog) : 0;
  const ranked = enhancePriorityEntries(baseEntries, {
    settings, lootLog, currentWeek, averageDrops, active: enhancedActive && lootLog.length > 0,
  });

  const needers: RecipientEntry[] = ranked.map((entry, i) => ({
    player: entry.player, rank: i + 1, needsItem: true, needTag: 'bis' as const,
    reason: `${label} is BiS · ${dropsPhrase(entry.player.id, lootLog, currentWeek)}`,
  }));
  if (scope === 'priority') return needers;

  const neederIds = new Set(needers.map((e) => e.player.id));
  const rest: RecipientEntry[] = configured
    .filter((p) => !neederIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((player) => {
      const { has } = slotState(player, slot);
      return has
        ? { player, rank: null, needsItem: false, needTag: 'free' as const,
            reason: 'Already has this slot · would be free / sell' }
        : { player, rank: null, needsItem: false, needTag: 'minor' as const,
            reason: 'Not raid BiS in this slot' };
    });
  return [...needers, ...rest];
}
