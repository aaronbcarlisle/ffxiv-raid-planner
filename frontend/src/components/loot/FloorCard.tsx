/**
 * FloorCard — one floor's loot-priority surface (F6d, spec §5.2; Phase-D R-8).
 * Header: floor name + number + drops meta + pending/logged chip. The card
 * carries its floor's identity ONCE — the R-45 accent stripe on the left edge
 * and the floor-coloured "Floor N" in the header (R-8: stated once per group,
 * not repeated on every row).
 * Body: gear rows then material rows, each with a ranked PriorityRow queue via
 * FloorDropRow. Auto-collapses when the week is fully logged (nothing pending)
 * to keep a cleared floor out of the way; `Show` (LinkText) re-expands it.
 * Queues use the SAME derivation as the legacy LootPriorityPanel
 * (getPriorityForItem/Ring/UpgradeMaterial/UniversalTomestone →
 * enhancePriorityEntries with the legacy enhanced-scoring gate expression).
 * (The weapon-priority footer left with R-3 — Weapons is a peer switcher
 * segment now, not a Floor-4 appendix.)
 */
import { useMemo, useState } from 'react';
import { Tag, LinkText, type PriorityRowEntry } from '../ui';
import { FloorDropRow } from './FloorDropRow';
import { FLOOR_TEXT_CLASS, FLOOR_ACCENT_CLASS } from './floorClasses';
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
  scopedWeek: number;
  /**
   * The REAL current week, used ONLY for the enhanced-scoring context (drought /
   * fair-share is computed against "now", not the scoped view week). Defaults to
   * `scopedWeek` when absent. Status derivation always uses `scopedWeek`.
   */
  currentWeek?: number;
  canEdit: boolean;
  /**
   * Whether a fully-logged week may collapse the card (default true — the
   * four-card All stack, where a cleared floor gets out of the way). R-49:
   * when the card is the ONLY one scoped (R-10's single-floor default or an
   * explicit floor pill), there is nothing to get out of the way OF, and
   * auto-collapse would land the user on a nearly-empty screen — so the
   * scoped view passes false and the card always renders its rows.
   */
  autoCollapse?: boolean;
  onAssignGear: (item: { slot: GearSlot | 'ring'; label: string }) => void;
  onAssignMaterial: (material: MaterialType, suggested: SnapshotPlayer) => void;
}

function toRowEntries(entries: { player: SnapshotPlayer }[]): PriorityRowEntry[] {
  return entries.map((e, i) => ({
    playerId: e.player.id, name: e.player.name, role: e.player.role, rank: i + 1,
  }));
}

export function FloorCard({
  floorNumber, floorName, players, settings, lootLog, materialLog, pageLedger,
  scopedWeek, currentWeek, canEdit, autoCollapse = true, onAssignGear, onAssignMaterial,
}: FloorCardProps) {
  // Enhanced-scoring drought is measured against the real current week; the
  // scoped view week only governs which week's log the status chip reflects.
  const enhanceWeek = currentWeek ?? scopedWeek;
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
    enhancePriorityEntries(entries, { settings, lootLog, currentWeek: enhanceWeek, averageDrops, active: enhancedActive });

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

  const collapsed = autoCollapse && !expanded && status.pendingCount === 0 && status.loggedCount > 0;

  return (
    <div className={`overflow-hidden rounded-lg border border-border-default ${FLOOR_ACCENT_CLASS[floorNumber]} bg-surface-card`}>
      <div className="flex items-center gap-3 border-b border-border-default bg-surface-base px-4 py-3">
        <Tag variant="label" tone="muted">{floorName}</Tag>
        <span className={`font-display text-sm font-bold ${FLOOR_TEXT_CLASS[floorNumber]}`}>Floor {floorNumber}</span>
        <span className="text-xs text-text-tertiary">
          · {status.cleared ? 'cleared' : 'in progress'} · drops: {dropLabels.join(', ')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {collapsed && <LinkText onClick={() => setExpanded(true)}>Show</LinkText>}
          {status.pendingCount > 0 ? (
            <Tag variant="label" tone="muted">{status.pendingCount} item{status.pendingCount === 1 ? '' : 's'} pending</Tag>
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
              floorNumber={floorNumber}
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
              floorNumber={floorNumber}
              material={row.material}
              entries={row.entries}
              canEdit={canEdit}
              // A11: always assignable while anyone is on the roster. Zero
              // needers → fall back to the first roster player as the suggested
              // recipient (QuickLogMaterialModal's own Select allows immediate
              // reassignment). Disabled only in the degenerate empty-roster
              // case, where players[0] would be undefined.
              disableAssign={players.length === 0}
              onAssign={() => onAssignMaterial(row.material, row.top ?? players[0])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
