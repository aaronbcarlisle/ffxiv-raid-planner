/**
 * FloorCard — one floor's loot-priority surface (F6d, spec §5.2).
 * Header: floor name + number + drops meta + pending/logged chip.
 * Body: gear rows then material rows, each with a ranked PriorityRow queue via
 * FloorDropRow. Auto-collapses when the week is fully logged (nothing pending)
 * to keep a cleared floor out of the way; `Show` (LinkText) re-expands it.
 * Queues use the SAME derivation as the legacy LootPriorityPanel
 * (getPriorityForItem/Ring/UpgradeMaterial/UniversalTomestone →
 * enhancePriorityEntries with the legacy enhanced-scoring gate expression).
 */
import { useMemo, useState } from 'react';
import { Tag, LinkText, type PriorityRowEntry } from '../ui';
import { FloorDropRow } from './FloorDropRow';
import { deriveFloorWeekStatus } from '../../utils/lootFairness';
import { enhancePriorityEntries } from '../../utils/priorityEntries';
import { calculateAverageDrops } from '../../utils/lootCoordination';
import {
  getPriorityForItem, getPriorityForRing,
  getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone,
  isPriorityDisabled,
  type PriorityEntry,
} from '../../utils/priority';
import { FLOOR_LOOT_TABLES, UPGRADE_MATERIAL_DISPLAY_NAMES, isSlotAugmentationMaterial, type FloorNumber } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, MaterialLogEntry, PageLedgerEntry, GearSlot, MaterialType } from '../../types';

export interface FloorCardProps {
  floorNumber: FloorNumber; floorName: string;
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
  scopedWeek: number; canEdit: boolean;
  onAssignGear: (item: { slot: GearSlot | 'ring'; label: string }) => void;
  onAssignMaterial: (material: MaterialType, suggested: SnapshotPlayer) => void;
  footer?: React.ReactNode;
}

function toRowEntries(entries: { player: SnapshotPlayer }[]): PriorityRowEntry[] {
  return entries.map((e, i) => ({
    playerId: e.player.id, name: e.player.name, role: e.player.role, rank: i + 1,
  }));
}

export function FloorCard({
  floorNumber, floorName, players, settings, lootLog, materialLog, pageLedger,
  scopedWeek, canEdit, onAssignGear, onAssignMaterial, footer,
}: FloorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const table = FLOOR_LOOT_TABLES[floorNumber];

  const status = useMemo(
    () => deriveFloorWeekStatus({ floorNumber, floorName, week: scopedWeek, players, settings, lootLog, materialLog, pageLedger }),
    [floorNumber, floorName, scopedWeek, players, settings, lootLog, materialLog, pageLedger],
  );

  // Legacy gate expression (LootPriorityPanel.tsx:404-408): enhanced scoring
  // requires the setting explicitly enabled, priority mode not disabled, and
  // some loot history to compute drought/balance against.
  const enhancedActive = settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0;

  const averageDrops = useMemo(
    () => (enhancedActive ? calculateAverageDrops(players.map((p) => p.id), lootLog) : 0),
    [enhancedActive, players, lootLog],
  );

  const enhance = (entries: PriorityEntry[]) =>
    enhancePriorityEntries(entries, { settings, lootLog, currentWeek: scopedWeek, averageDrops, active: enhancedActive });

  const gearItems: Array<{ slot: GearSlot | 'ring'; label: string }> = table.gearDrops.map((slot) =>
    slot === 'ring1' ? { slot: 'ring' as const, label: 'Ring' } : { slot, label: GEAR_SLOT_NAMES[slot] },
  );

  const gearRows = gearItems.map((item) => {
    const baseEntries = item.slot === 'ring'
      ? getPriorityForRing(players, settings)
      : getPriorityForItem(players, item.slot, settings);
    return { ...item, entries: toRowEntries(enhance(baseEntries)) };
  });

  const materialRows = table.upgradeMaterials.map((material) => {
    const baseEntries = isSlotAugmentationMaterial(material)
      ? getPriorityForUpgradeMaterial(players, material, settings, materialLog)
      : getPriorityForUniversalTomestone(players, settings, materialLog);
    const entries = enhance(baseEntries);
    return { material, label: UPGRADE_MATERIAL_DISPLAY_NAMES[material], entries: toRowEntries(entries), top: entries[0]?.player };
  });

  const dropLabels = [...gearItems.map((i) => i.label), ...materialRows.map((m) => m.label)];

  const collapsed = !expanded && status.pendingCount === 0 && status.loggedCount > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border-default bg-surface-card">
      <div className="flex items-center gap-3 border-b border-border-default bg-surface-raised px-4 py-3">
        <Tag variant="label" tone="muted">{floorName}</Tag>
        <span className="font-display text-sm font-bold">Floor {floorNumber}</span>
        <span className="text-xs text-text-tertiary">
          · {status.cleared ? 'cleared' : 'in progress'} · drops: {dropLabels.join(', ')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {collapsed && <LinkText onClick={() => setExpanded(true)}>Show</LinkText>}
          {status.pendingCount > 0 ? (
            <Tag variant="label" tone="muted">{status.pendingCount} items pending</Tag>
          ) : (
            <Tag variant="label" tone="success">{status.loggedCount} logged</Tag>
          )}
        </div>
      </div>
      {!collapsed && (
        <div>
          {gearRows.map((row) => (
            <FloorDropRow
              key={row.slot}
              kind="gear"
              label={row.label}
              subLabel={`${row.label} · raid`}
              slot={row.slot}
              entries={row.entries}
              canEdit={canEdit}
              onAssign={() => onAssignGear({ slot: row.slot, label: row.label })}
            />
          ))}
          {materialRows.map((row) => (
            <FloorDropRow
              key={row.material}
              kind="material"
              label={row.label}
              subLabel="Upgrade material"
              material={row.material}
              entries={row.entries}
              canEdit={canEdit}
              onAssign={() => row.top && onAssignMaterial(row.material, row.top)}
            />
          ))}
        </div>
      )}
      {footer}
    </div>
  );
}
