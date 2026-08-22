/**
 * LogWeekGrid — v2 Log tab's weekly-grid chassis (Phase-D D5, Task 3).
 *
 * Renders Task 2's `buildLogWeekGrid` output: 4 floor sections, ascending
 * F1→F4 (the §4 mockup order — Priority's floor Queues run 4→1, but the Log
 * reads as a record top-to-bottom, so the order deliberately differs from
 * FloorCard's stack). One `LogWeekGridProps` shape is the whole contract —
 * Task 4 wires this straight into `Loot.tsx`'s Log view.
 *
 * Header treatment (R-19 + R-D5b, user-ruled): matches FloorCard's shipped
 * header EXACTLY — `FLOOR_ACCENT_CLASS[n]` stripe, duty name as
 * `Tag variant="label" tone="muted"` (only when gamedata actually names the
 * floor — `floorName !== 'Floor N'`, same guard FloorCard uses to avoid the
 * "Floor N" chip beside "Floor N" heading duplication PR #224 caught), and
 * `Floor {n}` / `· Book {numeral}`. NO tint band. Floor colour appears ONLY
 * in the header — every cell body stays neutral, which is why the accent
 * class lives on the header bar `div`, not on the section/table wrapper (a
 * FloorCard difference: FloorCard's whole card carries the accent border
 * because FloorCard IS one floor's surface; here one wrapper holds all 4
 * floors, so the stripe has to scope to just the header row per floor).
 *
 * Table semantics: a real `<table>` per floor (F-4/history-parity call —
 * legacy `WeeklyLootGrid` is a div/flex layout with no header row at all;
 * this file is a re-expression, never a transcription — reference-only,
 * never imported from). Each floor's `<thead>` row leads with a visually
 * blank, unscoped `<th>` — a pure column-alignment filler so the `<tbody>`
 * row's leading `<th scope="row">Loot</th>` lines up under it; it describes
 * no column of data, so it takes no `scope` and is excluded from the "column
 * count" the per-floor gear+material `<th scope="col">` count is measured
 * against (F1 4 · F2 5 · F3 4 · F4 1, tested against the loot table shape,
 * not this filler). It carries an `sr-only` "Recipient" name — nothing to
 * show sighted users (there's no second axis label to give it), but
 * `jsx-a11y/control-has-associated-label` wants every header cell to
 * announce something to assistive tech.
 *
 * Column-header content: gear headers pair `GearSlotIcon` (decorative,
 * unlabeled — the header ALSO spells the slot name, so a `label` would
 * double-read) with the label text, both inside ONE `inline-flex items-center
 * gap-1` wrapper span (F-4: `GearSlotIcon`'s own aria-hidden span is
 * `inline-block`; the app-wide index.css rule
 * `[aria-hidden="true"]:not([role="presentation"])... { display: revert
 * !important }` reverts that to `inline` — losing its explicit width/height —
 * UNLESS a flex/grid ancestor blockifies it, which this wrapper does. The
 * wrapper itself is NOT aria-hidden — it carries the real, announced label
 * text, so hiding it would silence the column name). Material headers colour
 * the label text itself via `style={{ color: MATERIAL_TOKEN[material] }}`
 * (the shared material→token map `NeedMatrix` already reuses from
 * `FloorDropRow`, per director F-13's "one derivation" rule) — no separate
 * icon, no duplicate label; the coloured text IS the column name.
 *
 * Cell body: `RecipientBadge` (file-local) — role-tinted per `roleVar`
 * (`NeedMatrix.tsx:46`'s pattern), `JobIcon` + name, `min-h-7` reserved on
 * its wrapper so empty↔filled never shifts row height (legacy's fixed-28px
 * rationale, `WeeklyLootGrid.tsx:374-376`, re-expressed as `h-7`). An unknown
 * `recipientPlayerId` (player left the roster) falls back to
 * `entry.recipientPlayerName` in `var(--color-text-secondary)`, no job icon —
 * the record survives the player. A second+ entry adds a STATIC `×N` text
 * chip (never a button, never aria-hidden — `EntryPopover` for older entries
 * is D6; Task 6 records the interim). Editing a cell always targets
 * `entries[0]` (newest — Task 2 sorts DESC).
 *
 * Interactivity (R-17 / director F-15): `Button variant="ghost" size="sm"`
 * wraps the WHOLE cell body as one control — never `IconButton` (that's
 * `NeedMatrix`'s pattern for a single glyph; here the control's accessible
 * name already carries the recipient, so a text-capable `Button` is the
 * right primitive, not a workaround). `canEdit=false` drops the `Button`
 * entirely — bare badge/dash + an `sr-only` sentence, `NeedMatrix.tsx:226-
 * 229`'s read-only pattern. `canEdit && !canAssignMaterial`: EMPTY material
 * cells take the same read-only branch (F-12 — no enabled button whose
 * handler cannot act, `FloorCard.tsx:174-180` precedent); filled material
 * cells stay editable regardless (the edit door needs no suggestion pool).
 */
import { useMemo } from 'react';
import { Button } from '../primitives';
import { Tag } from '../ui';
import { GearSlotIcon } from '../ui/GearSlotIcon';
import { JobIcon } from '../ui/JobIcon';
import { getValidRole } from '../../gamedata';
import { FLOOR_TEXT_CLASS, FLOOR_ACCENT_CLASS } from './floorClasses';
import { MATERIAL_TOKEN } from './FloorDropRow';
import { buildLogWeekGrid, type LogGridFloor } from './logWeekGridData';
import type { FloorNumber } from '../../gamedata/loot-tables';
import type {
  GearSlot, LootLogEntry, MaterialLogEntry, MaterialType, SnapshotPlayer,
} from '../../types';

export interface LogWeekGridProps {
  floors: string[];
  week: number;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  /** Full roster incl. subs — a sub who received loot must still render a badge. */
  players: SnapshotPlayer[];
  canEdit: boolean;
  /** False on a degenerate empty roster — see the F-12 gating note above. */
  canAssignMaterial: boolean;
  onAssignGear: (item: { slot: GearSlot | 'ring'; label: string; floorNumber: FloorNumber }) => void;
  onEditGear: (entry: LootLogEntry) => void;
  onAssignMaterial: (material: MaterialType, floorNumber: FloorNumber) => void;
  onEditMaterial: (entry: MaterialLogEntry) => void;
}

/** Role-colored token — same formula as `NeedMatrix.tsx:46`. */
const roleVar = (player: SnapshotPlayer) => `var(--color-role-${getValidRole(player.role)}, var(--color-text-muted))`;

interface RecipientLike {
  recipientPlayerId: string;
  recipientPlayerName: string;
}

interface ResolvedRecipient {
  name: string;
  color: string;
  job?: string;
}

/** Unknown `recipientPlayerId` (player left the roster) falls back to the entry's own recorded name. */
function resolveRecipient(entry: RecipientLike, playerMap: Map<string, SnapshotPlayer>): ResolvedRecipient {
  const player = playerMap.get(entry.recipientPlayerId);
  if (!player) return { name: entry.recipientPlayerName, color: 'var(--color-text-secondary)' };
  return { name: player.name, color: roleVar(player), job: player.job };
}

/** File-local — the WeeklyLootGrid.tsx:392-400 badge treatment re-expressed with `roleVar`. */
function RecipientBadge({ color, name, job }: { color: string; name: string; job?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {job && <JobIcon job={job} size="xs" />}
      {name}
    </span>
  );
}

interface GridCellProps<E extends RecipientLike> {
  entries: E[];
  label: string;
  floorName: string;
  interactive: boolean;
  playerMap: Map<string, SnapshotPlayer>;
  onEmpty: () => void;
  onFilled: (entry: E) => void;
}

/** One `<td>`'s body — shared by gear and material cells (both entry shapes satisfy `RecipientLike`). */
function GridCell<E extends RecipientLike>({
  entries, label, floorName, interactive, playerMap, onEmpty, onFilled,
}: GridCellProps<E>) {
  const newest = entries[0];
  const recipient = newest ? resolveRecipient(newest, playerMap) : undefined;

  const content = newest && recipient ? (
    <>
      <RecipientBadge color={recipient.color} name={recipient.name} job={recipient.job} />
      {entries.length > 1 && (
        <span className="rounded bg-accent/20 px-1 text-xs font-bold text-accent">×{entries.length}</span>
      )}
    </>
  ) : (
    <span className="text-text-muted italic">—</span>
  );

  const body = <span className="inline-flex min-h-7 items-center gap-1">{content}</span>;

  if (!interactive) {
    const sentence = recipient ? `${label}: ${recipient.name}` : `${label}: not logged`;
    return (
      <>
        {body}
        <span className="sr-only">{sentence}</span>
      </>
    );
  }

  const ariaLabel = recipient
    ? `Edit ${label} for ${recipient.name} — ${floorName}`
    : `Log ${label} — ${floorName}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      aria-label={ariaLabel}
      onClick={() => (newest ? onFilled(newest) : onEmpty())}
    >
      {body}
    </Button>
  );
}

interface FloorSectionProps {
  floor: LogGridFloor;
  week: number;
  playerMap: Map<string, SnapshotPlayer>;
  canEdit: boolean;
  canAssignMaterial: boolean;
  onAssignGear: LogWeekGridProps['onAssignGear'];
  onEditGear: LogWeekGridProps['onEditGear'];
  onAssignMaterial: LogWeekGridProps['onAssignMaterial'];
  onEditMaterial: LogWeekGridProps['onEditMaterial'];
  isFirst: boolean;
}

function FloorSection({
  floor, week, playerMap, canEdit, canAssignMaterial,
  onAssignGear, onEditGear, onAssignMaterial, onEditMaterial, isFirst,
}: FloorSectionProps) {
  const {
    floorNumber, floorName, bookNumeral, gearCells, materialCells,
  } = floor;
  // Same guard FloorCard.tsx:127 uses — a "Floor N" chip beside "Floor N"
  // heading is the duplication PR #224's review caught at the other header sites.
  const hasDutyName = floorName !== `Floor ${floorNumber}`;

  return (
    <div className={isFirst ? '' : 'border-t border-border-default'}>
      <div
        className={`flex items-center gap-2 border-b border-border-default bg-surface-base px-4 py-3 ${FLOOR_ACCENT_CLASS[floorNumber]}`}
      >
        {hasDutyName && <Tag variant="label" tone="muted">{floorName}</Tag>}
        <span className={`font-display text-sm font-bold ${FLOOR_TEXT_CLASS[floorNumber]}`}>Floor {floorNumber}</span>
        <span className="text-xs text-text-muted">· Book {bookNumeral}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {floorName} — Floor {floorNumber}, Book {bookNumeral}, week {week} record
          </caption>
          <thead>
            <tr>
              {/* Column-alignment filler above the "Loot" row header — see the file header
                  note on the corner cell. Visually blank (nothing to label — the row below
                  only ever reads "Loot"), but jsx-a11y/control-has-associated-label wants
                  every header cell to announce something, so it carries an sr-only name. */}
              <th className="px-3 py-2"><span className="sr-only">Recipient</span></th>
              {gearCells.map((cell) => (
                <th key={cell.slot} scope="col" className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <GearSlotIcon slot={cell.slot} size={16} />
                    {cell.label}
                  </span>
                </th>
              ))}
              {materialCells.map((cell) => (
                <th
                  key={cell.material}
                  scope="col"
                  className="border-l border-border-default bg-surface-base px-3 py-2 text-left text-xs font-medium text-text-muted"
                >
                  <span style={{ color: MATERIAL_TOKEN[cell.material] }}>{cell.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="px-3 py-2 text-left text-xs uppercase tracking-wide text-text-muted">
                Loot
              </th>
              {gearCells.map((cell) => (
                <td key={cell.slot} className="px-3 py-2">
                  <GridCell
                    entries={cell.entries}
                    label={cell.label}
                    floorName={floorName}
                    interactive={canEdit}
                    playerMap={playerMap}
                    onEmpty={() => onAssignGear({ slot: cell.slot, label: cell.label, floorNumber })}
                    onFilled={onEditGear}
                  />
                </td>
              ))}
              {materialCells.map((cell) => {
                const isEmpty = cell.entries.length === 0;
                // F-12: an empty material cell with no suggestion pool renders read-only,
                // never an enabled button whose handler cannot act. A filled cell's edit
                // door needs no suggestion pool, so it stays editable regardless.
                const interactive = canEdit && (!isEmpty || canAssignMaterial);
                return (
                  <td key={cell.material} className="border-l border-border-default bg-surface-base px-3 py-2">
                    <GridCell
                      entries={cell.entries}
                      label={cell.label}
                      floorName={floorName}
                      interactive={interactive}
                      playerMap={playerMap}
                      onEmpty={() => onAssignMaterial(cell.material, floorNumber)}
                      onFilled={onEditMaterial}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LogWeekGrid(props: LogWeekGridProps) {
  const {
    floors, week, lootLog, materialLog, players, canEdit, canAssignMaterial,
    onAssignGear, onEditGear, onAssignMaterial, onEditMaterial,
  } = props;

  const grid = useMemo(
    () => buildLogWeekGrid({
      floors, week, lootLog, materialLog,
    }),
    [floors, week, lootLog, materialLog],
  );
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  return (
    <div
      data-testid="log-week-grid"
      className="overflow-hidden rounded-lg border border-border-default bg-surface-card"
    >
      {grid.map((floor, idx) => (
        <FloorSection
          key={floor.floorNumber}
          floor={floor}
          week={week}
          playerMap={playerMap}
          canEdit={canEdit}
          canAssignMaterial={canAssignMaterial}
          onAssignGear={onAssignGear}
          onEditGear={onEditGear}
          onAssignMaterial={onAssignMaterial}
          onEditMaterial={onEditMaterial}
          isFirst={idx === 0}
        />
      ))}
    </div>
  );
}
