/**
 * lootActivity — loot/material "recent activity" derivation for the v2 Home feed.
 *
 * Deliberately a SEPARATE file from `utils/staticActivity.ts`: that file's
 * `StaticActivityItem` type/icon unions are keyed exhaustively by the FROZEN
 * legacy `StaticHomeTab.tsx` (`Record<StaticActivityItem['icon'], …>`), so they
 * must never widen. Loot rows get their own item type + icon union instead and
 * are merged with mount rows locally by the v2-only `StaticActivityFeed`.
 *
 * No anonymization needed: loot/material entries carry `recipientPlayerName`
 * unconditionally and are already shown by name to all static members in
 * Loot History / WeeklyLootGrid — unlike mount plugin-sync rows, whose
 * anonymization exists to avoid leaking personal Dalamud sync timestamps.
 *
 * Labels are terse, mount-row style (method distinction deferred to polish):
 *   loot     → "{recipient} received {slot display name} — {fight}"
 *   material → "{recipient} received {material display name}"
 */

import { GEAR_SLOT_NAMES } from '../types';
import type { LootLogEntry, MaterialLogEntry } from '../types';
import { UPGRADE_MATERIAL_DISPLAY_NAMES } from '../gamedata/loot-tables';
import { relativeTime } from './staticActivity';

export interface LootActivityItem {
  key: string;
  type: 'loot_received' | 'material_received';
  icon: 'loot' | 'material';
  label: string;
  createdAt: string;
  time: string;
}

export function deriveLootActivityItems(
  lootLog: LootLogEntry[],
  materialLog: MaterialLogEntry[],
): LootActivityItem[] {
  const items: LootActivityItem[] = [];

  for (const entry of lootLog) {
    const slotName =
      GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] ?? entry.itemSlot;
    items.push({
      key: `loot-${entry.id}`,
      type: 'loot_received',
      icon: 'loot',
      label: `${entry.recipientPlayerName} received ${slotName} — ${entry.floor}`,
      createdAt: entry.createdAt,
      time: relativeTime(entry.createdAt),
    });
  }

  for (const entry of materialLog) {
    items.push({
      key: `material-${entry.id}`,
      type: 'material_received',
      icon: 'material',
      label: `${entry.recipientPlayerName} received ${UPGRADE_MATERIAL_DISPLAY_NAMES[entry.materialType]}`,
      createdAt: entry.createdAt,
      time: relativeTime(entry.createdAt),
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}
