/**
 * FloorCard — one floor's loot-priority surface (F6d, spec §5.2; Phase-D R-8).
 * Header: floor name + number + drops meta + pending/logged chip. The card
 * carries its floor's identity ONCE — the R-45 accent stripe on the left edge
 * and the floor-coloured "Floor N" in the header (R-8: stated once per group,
 * not repeated on every row).
 * Body: gear rows then material rows, each with a ranked PriorityRow queue via
 * FloorDropRow. Auto-collapses when the week is fully logged (nothing pending)
 * to keep a cleared floor out of the way; `Show` (LinkText) re-expands it.
 * Gear queues use the PICKER's own derivation (`buildRecipientEntries`, R-6
 * D3) — the chips, the QueueWhy popover, and the RecipientPicker modal draw
 * from the same call, so they can't disagree on WHO'S next. Material queues
 * use `materialPriorityEntries` (D5 Task 2) — the ONE derivation shared with
 * the D5 weekly grid's cell suggestion (director F-13); RecipientPicker
 * doesn't cover materials, so there's no shared leaf to converge on there.
 * The enhanced-scoring GATE itself is mirrored, not shared: this file
 * computes its own `enhancedActive` (below, `:~81`) and `materialSuggestion.ts`
 * recomputes the identical expression independently (`:46`) rather than
 * receiving it as an argument — byte-identical today, drift-checked by
 * materialSuggestion.test.ts, but not structurally guaranteed to match.
 * (The weapon-priority footer left with R-3 — Weapons is a peer switcher
 * segment now, not a Floor-4 appendix.)
 */
import { useMemo, useState } from 'react';
import { Tag, LinkText, type PriorityRowEntry } from '../ui';
import { FloorDropRow } from './FloorDropRow';
import { QueueWhy } from './QueueWhy';
import { FLOOR_TEXT_CLASS, FLOOR_ACCENT_CLASS } from './floorClasses';
import { deriveFloorWeekStatus } from '../../utils/lootFairness';
import { calculateAverageDrops } from '../../utils/lootCoordination';
import { isPriorityDisabled } from '../../utils/priority';
import { buildRecipientEntries } from '../../utils/recipientRanking';
import { materialPriorityEntries } from './materialSuggestion';
import { FLOOR_LOOT_TABLES, UPGRADE_MATERIAL_DISPLAY_NAMES, type FloorNumber } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, MaterialLogEntry, PageLedgerEntry, GearSlot, MaterialType } from '../../types';

export interface FloorCardProps {
  floorNumber: FloorNumber; floorName: string;
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
  /**
   * The week this card speaks for — BOTH the week its status chip derives from
   * and the week the enhanced-scoring context measures drought/fair-share
   * against. D4/R-15 collapsed the old `scopedWeek` + optional `currentWeek`
   * pair: Priority is always the clock's current week now (the week scope moved
   * to the Log tab), so the two were the same value on every render and a prop
   * whose only purpose was to *differ* from the other had no model left.
   */
  currentWeek: number;
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

function toRowEntries(entries: Array<{ player: SnapshotPlayer; rank?: number | null }>): PriorityRowEntry[] {
  return entries.map((e, i) => ({
    playerId: e.player.id, name: e.player.name, role: e.player.role, rank: e.rank ?? i + 1,
  }));
}

export function FloorCard({
  floorNumber, floorName, players, settings, lootLog, materialLog, pageLedger,
  currentWeek, canEdit, autoCollapse = true, onAssignGear, onAssignMaterial,
}: FloorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const table = FLOOR_LOOT_TABLES[floorNumber];

  const status = useMemo(
    () => deriveFloorWeekStatus({ floorNumber, floorName, week: currentWeek, players, settings, lootLog, materialLog, pageLedger }),
    [floorNumber, floorName, currentWeek, players, settings, lootLog, materialLog, pageLedger],
  );

  // Legacy gate expression (LootPriorityPanel.tsx:404-408): enhanced scoring
  // requires the setting explicitly enabled, priority mode not disabled, and
  // some loot history to compute drought/balance against.
  const enhancedActive = settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0;

  const averageDrops = useMemo(
    () => (enhancedActive ? calculateAverageDrops(players.map((p) => p.id), lootLog) : 0),
    [enhancedActive, players, lootLog],
  );

  const gearItems: Array<{ slot: GearSlot | 'ring'; label: string }> = table.gearDrops.map((slot) =>
    slot === 'ring1' ? { slot: 'ring' as const, label: 'Ring' } : { slot, label: GEAR_SLOT_NAMES[slot] },
  );

  // R-6 (D3): gear queues use the PICKER's own derivation, so the chips, the
  // why popover and the modal can never disagree. Equivalence proven in
  // recipientRanking.test.ts's order-identity case: same pools, same enhanced
  // gate (enhancedActive already folds in lootLog.length > 0), same week
  // (currentWeek), and mainRosterPlayers is a fixed point of its
  // configured/!isSubstitute filter.
  const gearRows = gearItems.map((item) => ({
    ...item,
    entries: buildRecipientEntries({
      players, slot: item.slot, scope: 'priority', settings, lootLog,
      currentWeek, enhancedActive,
    }),
  }));

  // D5 Task 2: ONE derivation shared with the weekly grid's cell suggestion
  // (director F-13) — pass this card's own memoized averageDrops so the base
  // + enhance pass never runs twice per row.
  const materialRows = table.upgradeMaterials.map((material) => {
    const entries = materialPriorityEntries({
      material, players, settings, lootLog, materialLog, currentWeek, averageDrops,
    });
    return { material, label: UPGRADE_MATERIAL_DISPLAY_NAMES[material], entries: toRowEntries(entries), top: entries[0]?.player };
  });

  const dropLabels = [...gearItems.map((i) => i.label), ...materialRows.map((m) => m.label)];

  const collapsed = autoCollapse && !expanded && status.pendingCount === 0 && status.loggedCount > 0;

  return (
    <div className={`overflow-hidden rounded-lg border border-border-default ${FLOOR_ACCENT_CLASS[floorNumber]} bg-surface-card`}>
      <div className="flex items-center gap-3 border-b border-border-default bg-surface-base px-4 py-3">
        {/* Duty chip only when gamedata actually names the floor — with no
            tier gamedata the caller passes the "Floor N" fallback, and a
            "Floor N" chip beside the "Floor N" heading is the duplication the
            PR #224 review caught at the other two header sites. */}
        {floorName !== `Floor ${floorNumber}` && <Tag variant="label" tone="muted">{floorName}</Tag>}
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
              entries={toRowEntries(row.entries)}
              canEdit={canEdit}
              onAssign={() => onAssignGear({ slot: row.slot, label: row.label })}
              why={row.entries.length > 0
                ? <QueueWhy entries={row.entries} slot={row.slot} lootLog={lootLog} enhancedActive={enhancedActive} />
                : undefined}
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
