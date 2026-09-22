/**
 * LootHistoryTable — the flat sortable transparent record (R-29/R-46; D9a+D9b).
 *
 * One `<table>`: seven `SortableHeader` columns (Week · Floor · Slot · Player ·
 * Method · Date · Type) plus the ⋮ kebab column, ordered by a session-local
 * `HistorySortState` (`sortHistoryItems`; default Week desc, ties newest-first —
 * R-29 note 3: not persisted, not in the URL). Cells: R-33 floor chip (`Tag`
 * floor tone, D9a-r), R-39 slot glyph (`GearSlotIcon`; a material dot for
 * material rows), R-38 weapon job in Slot and recipient job in Player, the
 * `aug {slot}` readout in Type (R-34 / R-D9a-A / D9a-t). Since D11 the row
 * itself is a control (below) — D9a-i's "rows are inert" is superseded.
 *
 * D9b adds the three things D9a deferred. **Week separators (R-29)** render
 * ONLY while the sort field is `week` — under a Player sort the rows either
 * side of a week band are no longer a week, so the band would be a lie. They
 * are direction-agnostic (R-D9b-E): week ASC is still grouped by week. The
 * **stats count (R-34)** sits above the `<thead>`, inside the card, as a
 * `role="status"` line so a filter change announces. The **filtered-vs-empty
 * split (R-34)** replaces D9a's single message: "nothing logged this tier" and
 * "nothing matches your filters" are different facts and v1 already said so
 * (`AllWeeksView.tsx:530-537`).
 *
 * Owns the `?entry=&entryType=` deep-link highlight (legacy parity,
 * `SectionedLogView.tsx:628-680`): scrolls to and pulses the matching row, then
 * clears the params after 2.5s. The id the effect scrolls to and the id each
 * `<tr>` renders are the SAME call — `historyRowDomId` (D9a-q, one author).
 *
 * Frozen V1 reference (never imported): `history/AllWeeksView.tsx` renders
 * the same seven data cells (no kebab column, that's v2's) with inline hex
 * and a clickable row.
 *
 * Trades on record: the card is `overflow-clip` (D9a-n) — an `overflow-x-auto`
 * scrollport would defeat the sticky `<thead>`, so the card cannot scroll
 * sideways and *would* clip below the width where eight columns fit. Measured,
 * that width is never reached: the content pane scrolls first, from the stats
 * card row above this table, so the card itself clipped at no width tested down
 * to 880 (numbers in the R-29 build note; Phase P re-decides for mobile). The
 * separator row adds a `colSpan` cell, so those widths were re-measured in D9b.
 *
 * TWO date formatters, deliberately: the Date **column** is LOCAL time (D9a-o,
 * a logged moment) and the separator **range** is UTC-pinned (a lockout
 * boundary, `WeekScopeControl` precedent). Both are correct for what they show.
 *
 * The deep-link pulse rides a `<tr>` inside a `border-collapse: collapse`
 * table. D9a evidenced that from computed style only; D9b looked at it — the
 * `inset` ring paints on all four edges in both themes at 1440 (screenshots in
 * the D9b PR). The outset glow is clipped by `overflow-clip`, as designed.
 *
 * D10 replaced the `filters` prop with a parsed search `query` and deleted
 * `HistoryFilters` outright — the query string is the tab's ONLY filter state
 * (R-30), so nothing here ANDs two surfaces together any more. The four
 * zero-row strings and the stats count are unchanged by that slice (R-7);
 * they are R-34-ruled and byte-restored from V1.
 *
 * D11 makes the row a control (R-31) and converts the kebab (R-32, R-D11-D).
 *
 * **The row.** ONE `activate` handler serves both `onClick` and `onKeyDown`, so
 * R-31 q3's modifiers are designed rather than inherited from a cast: Shift →
 * copy link (and clear the selection Shift+Click extends, V1
 * `AllWeeksView.tsx:315`); Alt → jump to the recipient's roster card when the
 * id resolves in the roster (card-level `?player=` until D12's slot anchors,
 * R-28); plain → edit (loot → `onEdit`, material → `onEditMaterial`, which is
 * D8's modal through Loot's existing `materialState.mode === 'edit'` door,
 * R-D11-H). Activation is PERMISSION-SHAPED (R-D11-E): only a `canEdit` row is
 * focusable (`tabIndex={0}`), roled (`role="button"` — R-D11-L's recorded
 * trade: it costs the `<tr>` its `row` semantics, so the `aria-label` carries
 * the whole row in V1's shape), keyboard-activatable (Enter / Space, V1
 * `:555-559`; only when the row ITSELF is the target, so a keydown bubbling up
 * from the kebab never doubles as a row activation) and ringed
 * (`focus-visible` INSET — the card is `overflow-clip`, so an outset ring would
 * be clipped on the first and last rows, the same reason the pulse ring is
 * inset). The Shift/Alt pointer modifiers stay live for viewers, and
 * `cursor-pointer` is set iff `altHeld ? canJump : canEdit` (R-D11-F; ONE
 * `useAltHeld()` per table, D6 Task 3's rule) — a CHOICE rather than a union,
 * because `activate` returns out of the Alt branch before the edit path, so
 * with Alt held (and Shift not, which is checked FIRST and copies for
 * everyone) the jump is the only activation left on offer to anyone. A
 * viewer's plain click is a no-op that never advertised itself, and so is an
 * editor's Alt-click on a row whose recipient no longer resolves (R-31 q1).
 * Shift is deliberately NOT in the predicate: its copy fires for everyone, so
 * a missing cursor there under-advertises a power-user gesture rather than
 * promising one that will not fire — q1 bans the lie, not the secret. No `select-none` anywhere
 * (R-31 q2): the text is meant to be read back, so a plain CLICK that completes
 * a drag-select is a selection, not an activation (R-D11-G, read off
 * `window.getSelection()` on the pointer path only — a keyboard Enter cannot
 * complete a drag-select, so a stale selection elsewhere does not gate it).
 *
 * **The menu.** ONE `ContextMenu` at the table root with ONE `menu` state and
 * two triggers — kebab click and row right-click — into the same
 * `buildRowMenuItems` list, the `LogWeekGrid` / `BookLedgerCard` family shape.
 * Items: Edit (`canEdit`; loot or material) · Copy link · Jump to {name} (only
 * when the id resolves) · View week {n} in Log (R-D11-A: carries the ENTRY, so
 * the Log lands with the cell pulsing, not merely on the week) · separator +
 * Delete (`canEdit`; the separator is the family's, R-D11-M). No icons — the
 * entry family carries none. The kebab's `onClick` `stopPropagation`s, because
 * its ancestor `<tr>` now has an `onClick` (the grid precedent's did not); a
 * right-click anchors through `jumpMenuAnchor`, so Shift+F10 / the menu key
 * (both coordinates 0) land on the row, not the page corner (R-32 note 2). A
 * viewer keeps Copy link · Jump · View week on the kebab: that is their
 * complete keyboard/AT route (R-D11-E), replacing V1's row-level
 * Shift+Enter / Alt+Enter gesture, which is deliberately not carried.
 *
 * Later slice: D12 gear-row anchors.
 */
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { SortableHeader } from '../ui/SortableHeader';
import { Tag, type Tone } from '../ui/Tag';
import { GearSlotIcon } from '../ui/GearSlotIcon';
import { JobIcon } from '../ui/JobIcon';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { IconButton } from '../primitives/IconButton';
import { jumpMenuAnchor } from '../roster/rosterLedgerJumps';
import { useAltHeld } from '../../hooks/useAltHeld';
import { historyRowDomId, type HistoryItem } from './logWeekGridData';
import {
  buildHistoryItems,
  sortHistoryItems,
  nextHistorySort,
  slotNameOf,
  methodLabelOf,
  augSlotLabel,
  DEFAULT_HISTORY_SORT,
  type HistorySortContext,
  type HistorySortField,
  type HistorySortState,
} from '../../utils/historyItems';
import {
  filterHistoryItemsByQuery,
  type HistoryQueryContext,
  type ParsedHistoryQuery,
} from '../../utils/historyQuery';
import { GEAR_SLOTS } from '../../types';
import type { LootLogEntry, LootSlot, MaterialLogEntry, MaterialType, SnapshotPlayer } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import type { WeekRange } from '../../hooks/useWeekClock';

export interface LootHistoryTableProps {
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  players: SnapshotPlayer[];
  floors: string[];
  /**
   * The DEBOUNCED, parsed search query (D10). It replaced the three-pill
   * `HistoryFilterState`: the query string is the tab's only filter state
   * (R-30), so there is nothing here to AND against a second surface. An
   * empty parse filters nothing.
   */
  query: ParsedHistoryQuery;
  /** pass clock.currentWeek — which separator carries the current-week marker. */
  currentWeek: number;
  /** pass clock.rangeOfWeek — returns null for a week the clock can't date. */
  rangeOfWeek: (week: number) => WeekRange | null;
  /**
   * True when the log fetch for this tier FAILED. Same reason as
   * `logsLoading`: empty arrays after a failed request are not evidence of an
   * empty tier, and saying so is a false claim the user cannot act on — the
   * toast tells them something broke while the table tells them there is
   * nothing to see (D9b review, Copilot).
   */
  logsFailed: boolean;
  /**
   * True while either log is being fetched. The empty state AND the stats
   * count read it: "No loot or materials logged this tier." and "0 entries"
   * are both claims about the tier, and the component cannot make either over
   * arrays that simply haven't arrived (D9b review M1 + round 2). Rows are
   * still rendered while true — a tier
   * switch shows the previous tier's rows until the new ones land, which is
   * the pre-existing behaviour on both shells and not this slice's to change.
   */
  logsLoading: boolean;
  canEdit: boolean;
  onEdit: (entry: LootLogEntry) => void;
  /**
   * D11 (R-D11-H): a material row's Edit — D8's modal through Loot's existing
   * `materialState.mode === 'edit'` door, a second CALLER of one mount.
   * Required, like the two below, for `LogWeekGridProps`' own reason: an
   * optional callback would make a menu item's presence a function of the
   * caller rather than of the data, and this table has exactly one mount.
   */
  onEditMaterial: (entry: MaterialLogEntry) => void;
  /** Alt+Click / "Jump to {name}" — card-level (`?player=`) until D12's slot anchors (R-28). */
  onJumpToPlayer: (playerId: string) => void;
  /** "View week {n} in Log" (R-D11-A): a same-tab jump carrying the entry, not just its week. */
  onViewWeekInLog: (item: HistoryItem) => void;
  onCopyLink: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
}

/** Header order IS column order; the `CELL` map renders one cell per field from the same list. */
const COLUMNS: ReadonlyArray<{
  field: HistorySortField;
  label: string;
  thClassName?: string;
}> = [
  { field: 'week', label: 'Week', thClassName: 'w-16' },
  { field: 'floor', label: 'Floor', thClassName: 'w-24' },
  { field: 'slot', label: 'Slot' },
  { field: 'player', label: 'Player' },
  { field: 'method', label: 'Method', thClassName: 'w-24' },
  { field: 'date', label: 'Date' },
  { field: 'type', label: 'Type', thClassName: 'w-36' },
];

/** A logged `itemSlot` the glyph set knows — the bare `'ring'` included, unknown keys excluded. */
function isLootSlot(s: string): s is LootSlot {
  return s === 'ring' || (GEAR_SLOTS as readonly string[]).includes(s);
}

/** Typed floor→tone (D9a-r): `Tone` is a closed union, so only floors 1–4 tint; anything else is muted. */
function floorToneOf(floors: string[], floor: string): Tone {
  const idx = floors.indexOf(floor);
  return idx >= 0 && idx < 4 ? `floor-${(idx + 1) as FloorNumber}` : 'muted';
}

/** The one authored spelling of "what name does this row show" — sort key and cell text both call it. */
function recipientNameOf(item: HistoryItem, playersById: Map<string, SnapshotPlayer>): string {
  return playersById.get(item.entry.recipientPlayerId)?.name ?? item.entry.recipientPlayerName;
}

const MATERIAL_DOT: Record<MaterialType, string> = {
  twine: 'bg-material-twine',
  glaze: 'bg-material-glaze',
  solvent: 'bg-material-solvent',
  universal_tomestone: 'bg-material-tomestone',
};

/** Local time (D9a-o) — a logged moment, not a lockout boundary. */
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * UTC-pinned so the shown date never shifts a day (WeekScopeControl precedent).
 * Carried verbatim from the deleted `WeekGroupHeader`
 * (`3f90d420:frontend/src/components/loot/WeekGroupHeader.tsx:14-19`), comment
 * included — a lockout boundary is a UTC fact, unlike the Date column above.
 */
const RANGE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function formatRange(range: WeekRange): string {
  return `${RANGE_FMT.format(range.start)} – ${RANGE_FMT.format(range.end)}`;
}

/**
 * R-D9b-A: "entries", not the archaeology's "{n} drop(s)". The count includes
 * material rows, and the stats line above the table says "entries" too — one
 * screen, one word. ONE author for both readouts.
 */
function entryCount(n: number): string {
  return `${n} ${n === 1 ? 'entry' : 'entries'}`;
}

interface CellContext {
  floors: string[];
  playersById: Map<string, SnapshotPlayer>;
}

/**
 * The Slot cell's lead-ins for a loot row: the R-39 glyph (known slots only),
 * then the R-38 job icon of the WEAPON that dropped — not the recipient's job,
 * which is the Player cell's. Gated on the weapon slot, not on `weaponJob`
 * presence: the loot edit API keeps a non-null `weapon_job` when an entry's
 * slot is changed away from weapon, so a Body row can carry a stale job.
 */
function lootSlotLeadIns(entry: LootLogEntry): ReactNode {
  return (
    <>
      {isLootSlot(entry.itemSlot) && <GearSlotIcon slot={entry.itemSlot} size={16} />}
      {entry.itemSlot === 'weapon' && entry.weaponJob && <JobIcon job={entry.weaponJob} size="xs" />}
    </>
  );
}

/**
 * One renderer per field, iterated by `COLUMNS` — the cells never appear as one
 * contiguous block, which is what keeps this file from cloning the frozen
 * `AllWeeksView.tsx` row it re-expresses.
 */
const CELL: Record<HistorySortField, (item: HistoryItem, ctx: CellContext) => ReactNode> = {
  week: (i) => <span className="font-medium text-text-primary">{`W${i.entry.weekNumber}`}</span>,
  floor: (i, c) =>
    i.entry.floor ? (
      <Tag variant="label" tone={floorToneOf(c.floors, i.entry.floor)}>
        {i.entry.floor}
      </Tag>
    ) : (
      <span className="text-text-tertiary">—</span>
    ),
  // The glyph / dot are aria-hidden; the ONE inline-flex wrapper keeps them
  // laid out under index.css's aria-hidden display-revert rule (F-4 hazard).
  slot: (i) => (
    <span className="inline-flex items-center gap-1.5">
      {i.kind === 'loot' ? (
        lootSlotLeadIns(i.entry)
      ) : (
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${MATERIAL_DOT[i.entry.materialType]}`} />
      )}
      <span className="text-text-primary">{slotNameOf(i)}</span>
    </span>
  ),
  player: (i, c) => {
    const p = c.playersById.get(i.entry.recipientPlayerId);
    return (
      <span className="inline-flex items-center gap-1.5">
        {p?.job && <JobIcon job={p.job} size="xs" />}
        <span className="text-text-primary">{recipientNameOf(i, c.playersById)}</span>
      </span>
    );
  },
  method: (i) => <span className="text-text-secondary">{methodLabelOf(i)}</span>,
  date: (i) => {
    const d = new Date(i.entry.createdAt);
    return Number.isNaN(d.getTime()) ? (
      <span className="text-text-tertiary">—</span>
    ) : (
      <span className="text-text-secondary whitespace-nowrap">{DATE_FMT.format(d)}</span>
    );
  },
  type: (i) =>
    i.kind === 'loot' ? (
      i.entry.isExtra ? (
        <Tag variant="label" tone="muted" className="whitespace-nowrap">
          Extra
        </Tag>
      ) : (
        <Tag variant="label" tone="success" className="whitespace-nowrap">
          BiS
        </Tag>
      )
    ) : (
      <Tag variant="label" tone="muted" className="whitespace-nowrap">
        {`aug ${augSlotLabel(i.entry.slotAugmented)}`}
      </Tag>
    ),
};

/**
 * The R-29 week separator, rebuilt from the deleted `WeekGroupHeader`
 * (`3f90d420:.../WeekGroupHeader.tsx`) per R-29 implementation note 1. It lives
 * here rather than in a restored file of its own (R-D9b-D): it is table-coupled
 * now — `colSpan`, row semantics — and has exactly one consumer.
 *
 * The pill goes through `Tag` rather than the archaeology's hand-rolled span,
 * because `Tag`'s `accent` tone IS the measured pair the deleted file's comment
 * argued for — `bg-accent/15 text-accent-hover`, where the default
 * `text-accent` (#0c7d71) clears AA on solid surface-base/card but NOT on the
 * bg-accent/15 tint composited over them (#dbebea ≈ 4.07:1 light, measured via
 * the contrast harness); accent-hover (#0a6b60) clears it with margin. `muted`
 * is likewise the archaeology's `bg-surface-elevated text-text-secondary`. So
 * the design-system primitive preserves the contrast ruling exactly; only
 * `font-display` has to be re-applied on top (R-D9b-F).
 */
function WeekSeparatorRow({
  week,
  isCurrent,
  range,
  count,
}: {
  week: number;
  isCurrent: boolean;
  range: WeekRange | null;
  count: number;
}) {
  // Range and marker share ONE span joined on ` · `, so a week the clock can't
  // date renders "current" without a leading orphan dot (R-D9b-B).
  const meta = [range ? formatRange(range) : null, isCurrent ? 'current' : null]
    .filter((part): part is string => part !== null)
    .join(' · ');

  // Held in a variable, not authored inline, for the same reason
  // `renderActionsCell` is: `jsx-a11y/control-has-associated-label` maps `<td>`
  // to a cell role and scans only two levels deep for accessible text. The text
  // here is real but sits at depth three, so authoring it inline trips a false
  // positive on both the `<tr>` and the `<td>`.
  const body = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {/* `font-display` only: an appended weight utility does NOT win over
            Tag's own `font-medium` (both land in the same Tailwind layer, so
            emission order decides, not string order — measured 500 on the
            rendered pill). The archaeology's `font-extrabold` is therefore
            deliberately not carried; the tone tokens, which are what the
            contrast ruling is about, are (R-D9b-F). */}
        <Tag variant="label" tone={isCurrent ? 'accent' : 'muted'} className="font-display">
          {`WEEK ${week}`}
        </Tag>
        {meta && <span className="text-xs text-text-tertiary">{meta}</span>}
      </div>
      <span className="text-xs text-text-tertiary">{entryCount(count)}</span>
    </div>
  );

  return (
    <tr className="bg-surface-raised/50">
      <td colSpan={COLUMNS.length + 1} className="px-4 py-2">
        {body}
      </td>
    </tr>
  );
}

/**
 * The ONE row menu's state — which row it is about and where it opens
 * (`LogWeekGrid`'s `LogGridMenuState` shape). Never per row.
 */
interface RowMenuState {
  x: number;
  y: number;
  item: HistoryItem;
}

interface ActionsCellContext {
  playersById: Map<string, SnapshotPlayer>;
  openMenu: (menu: RowMenuState) => void;
}

/**
 * The ⋮ cell's body, rendered through a function exactly like the seven `CELL`
 * entries so every `<td>` in the row has the same shape — the `<td>`'s only
 * child stays an expression container rather than JSX authored directly
 * inside it, which is what keeps `jsx-a11y/control-has-associated-label`
 * (mapping `<td>` to the `gridcell` role) from flagging the cell; the actual
 * labelled control is the `IconButton`, whose name is ROW-SPECIFIC —
 * `{slot} entry actions — {player}`, the `LogWeekGrid.tsx:519` precedent
 * (`${label} entry actions — ${floorName}`, R-D6b). Eight rows of an
 * identically-named button tell a screen-reader user nothing about which
 * entry the focused menu would edit or delete.
 *
 * D11 (R-D11-D): a TRIGGER for the table-root `ContextMenu`, anchored at its
 * own rect (`LogWeekGrid.tsx`'s `openKebabMenu`), not a Radix `Dropdown` of
 * its own — one items list, two triggers. `aria-haspopup="menu"` is R-D7b's
 * shape. The `stopPropagation` is the one thing that precedent did NOT need:
 * its ancestor had no `onClick`, and this one's `<tr>` does (m4) — without it a
 * single kebab click would open the menu AND the row's editor.
 */
function renderActionsCell(item: HistoryItem, ctx: ActionsCellContext): ReactNode {
  return (
    <IconButton
      aria-label={`${slotNameOf(item)} entry actions — ${recipientNameOf(item, ctx.playersById)}`}
      aria-haspopup="menu"
      icon={<MoreVertical className="h-4 w-4" />}
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        ctx.openMenu({ x: r.left, y: r.bottom, item });
      }}
    />
  );
}

interface RowMenuContext {
  canEdit: boolean;
  playersById: Map<string, SnapshotPlayer>;
  onEdit: LootHistoryTableProps['onEdit'];
  onEditMaterial: LootHistoryTableProps['onEditMaterial'];
  onCopyLink: LootHistoryTableProps['onCopyLink'];
  onJumpToPlayer: LootHistoryTableProps['onJumpToPlayer'];
  onViewWeekInLog: LootHistoryTableProps['onViewWeekInLog'];
  onDelete: LootHistoryTableProps['onDelete'];
}

/**
 * The row menu's items (R-32), in order: Edit (`canEdit`; loot → `onEdit`,
 * material → `onEditMaterial`) · Copy link · Jump to {name} (only when the id
 * resolves in the roster — the same gate the row's Alt activation applies) ·
 * View week {n} in Log · separator + Delete (`canEdit`, danger; the separator
 * is the entry family's, R-D11-M). No icons: `buildEntryMenuItems` carries
 * none for the entry family, and one menu growing icons its twin lacks is the
 * drift this phase keeps catching. The Jump name is the roster's
 * (`recipientNameOf`), the same resolution the Player cell and the kebab's
 * label use, so a renamed player reads consistently in all three.
 *
 * Module-level and deliberately NOT exported: `react-refresh/only-export-
 * components` is an error in this repo (D9a-m recorded the same for
 * `isLootSlot`). Exercised through the table, where its permission and kind
 * branches are observable anyway.
 */
function buildRowMenuItems(item: HistoryItem, ctx: RowMenuContext): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  if (ctx.canEdit) {
    items.push({
      label: 'Edit',
      onClick: () => (item.kind === 'loot' ? ctx.onEdit(item.entry) : ctx.onEditMaterial(item.entry)),
    });
  }
  items.push({ label: 'Copy link', onClick: () => ctx.onCopyLink(item) });
  const recipientId = item.entry.recipientPlayerId;
  if (ctx.playersById.has(recipientId)) {
    items.push({
      label: `Jump to ${recipientNameOf(item, ctx.playersById)}`,
      onClick: () => ctx.onJumpToPlayer(recipientId),
    });
  }
  items.push({ label: `View week ${item.entry.weekNumber} in Log`, onClick: () => ctx.onViewWeekInLog(item) });
  if (ctx.canEdit) {
    items.push({ separator: true });
    items.push({ label: 'Delete', danger: true, onClick: () => ctx.onDelete(item) });
  }
  return items;
}

/**
 * R-D11-G: is there a live text selection on the page? A plain click that
 * COMPLETES a drag-select (mouseup → click) is a selection, not an activation
 * — and rows are selectable on purpose (R-31 q2), so this is what stands in
 * for the `select-none` V1 used.
 */
function selectionActive(): boolean {
  return (window.getSelection()?.toString() ?? '') !== '';
}

export function LootHistoryTable({
  lootLog,
  materialLog,
  players,
  floors,
  query,
  currentWeek,
  rangeOfWeek,
  logsLoading,
  logsFailed,
  canEdit,
  onEdit,
  onEditMaterial,
  onJumpToPlayer,
  onViewWeekInLog,
  onCopyLink,
  onDelete,
}: LootHistoryTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Session-local (R-29 note 3): a fresh mount starts on Week desc.
  const [sort, setSort] = useState<HistorySortState>(DEFAULT_HISTORY_SORT);
  // R-D11-F: ONE `useAltHeld()` at the table top level — never one per row
  // (D6 Task 3's rule; `LogWeekGrid.tsx` is the precedent).
  const altHeld = useAltHeld();
  // R-D11-D: ONE `ContextMenu` mount at the table root, ONE state — every
  // row's kebab and right-click share it (`LogWeekGrid.tsx`'s `menu`).
  const [menu, setMenu] = useState<RowMenuState | null>(null);

  // Derived (not stored) — the highlight tracks the URL param directly, so
  // there's nothing to desync. Two primitives (not an object) so the effect's
  // dep array can name them directly — an object identity would either
  // re-fire every render (new object each time) or need a memo keyed on the
  // stores, which would re-fire the scroll on unrelated store refetches.
  // `null` when the param is absent OR the id isn't found in the *unfiltered*
  // logs (matches the brief).
  const entryParam = searchParams.get('entry');
  const entryType: 'loot' | 'material' = searchParams.get('entryType') === 'material' ? 'material' : 'loot';
  const parsedEntryId = entryParam ? parseInt(entryParam, 10) : null;
  const entryFound =
    parsedEntryId != null &&
    !Number.isNaN(parsedEntryId) &&
    (entryType === 'material'
      ? materialLog.some((e) => e.id === parsedEntryId)
      : lootLog.some((e) => e.id === parsedEntryId));
  const highlightId: number | null = entryFound ? parsedEntryId : null;
  const highlightType: 'loot' | 'material' | null = entryFound ? entryType : null;

  useEffect(() => {
    if (highlightId == null || highlightType == null) return;

    const elementId = historyRowDomId({ kind: highlightType, id: highlightId });
    const scrollTimer = setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    const clearTimer = setTimeout(() => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('entry');
        params.delete('entryType');
        return params;
      }, { replace: true });
    }, 2500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightId, highlightType, setSearchParams]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const sortCtx = useMemo<HistorySortContext>(
    () => ({
      floors,
      playerNameOf: (i) => recipientNameOf(i, playersById),
    }),
    [floors, playersById],
  );
  // Same `playersById` the sort context reads, for the same reason: the name
  // a `player:` token matches must be the name the Player cell shows, and the
  // job a `job:` token matches must be the job its icon shows.
  const queryCtx = useMemo<HistoryQueryContext>(
    () => ({
      playerNameOf: (i) => recipientNameOf(i, playersById),
      playerJobOf: (i) => playersById.get(i.entry.recipientPlayerId)?.job ?? '',
    }),
    [playersById],
  );
  const rows = useMemo(
    () => sortHistoryItems(
      filterHistoryItemsByQuery(buildHistoryItems(lootLog, materialLog), query, queryCtx),
      sort,
      sortCtx,
    ),
    [lootLog, materialLog, query, queryCtx, sort, sortCtx],
  );
  // Separators are a property of the WEEK SORT, not of the data (R-29): under
  // any other field the rows either side of a band are no longer one week.
  // Direction-agnostic — week asc is still grouped by week (R-D9b-E).
  const showSeparators = sort.field === 'week';
  // Counted off `rows` (the FILTERED set), so a separator always describes what
  // is on screen rather than what the tier holds.
  const weekCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of rows) {
      counts.set(item.entry.weekNumber, (counts.get(item.entry.weekNumber) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  // R-34's filtered-vs-empty split. Read off the RAW props, not `rows`: the
  // question is whether the tier holds anything at all, which is what the
  // unfiltered logs answer ONCE THEY HAVE LOADED — hence the `logsLoading`
  // guard, which withholds the claim rather than asserting it over arrays that
  // are empty only because the request is still in flight.
  const tierIsEmpty = lootLog.length === 0 && materialLog.length === 0;

  // R-34's stats count. The split is gated on both kinds being PRESENT, which
  // replaces v1's `entryType === 'all'` gate (`AllWeeksView.tsx:508`) — a state
  // R-30/D10 deletes outright.
  //
  // Blank — not "0 entries" — while the logs are in flight with nothing to
  // show: "0 entries" is a COUNT OF THE TIER, the same claim-over-unloaded-data
  // the empty message below withholds, and this one sits in a live region, so
  // it would also announce "0 entries" and then "17 entries" on every load.
  // The element stays mounted either way: a live region inserted already
  // populated is not reliably announced (the `role="status"` precedent at
  // `Loot.tsx`'s priority toolbar), so the text empties, never the node.
  const lootShown = rows.filter((item) => item.kind === 'loot').length;
  const materialShown = rows.length - lootShown;
  const statsLabel =
    (logsLoading || (logsFailed && tierIsEmpty)) && rows.length === 0
      ? ''
      : lootShown > 0 && materialShown > 0
        ? `${entryCount(rows.length)} (${lootShown} gear, ${materialShown} material)`
        : entryCount(rows.length);

  // Four zero-row states, in precedence order. The first two WITHHOLD a claim
  // the component cannot support; only the last two assert anything.
  //
  // `logsFailed` is gated on `tierIsEmpty` rather than taken on its own: if
  // this component is HOLDING logs then they demonstrably loaded, whatever a
  // stale flag says, so zero rows can only be the filter.
  //
  // ⚠ This gate is the ONLY thing stopping a stale verdict. It began as
  // defence in depth beside a caller-side retraction, but round 7 deleted that
  // retraction — it could not be made correct, because array identity means
  // "some fetch succeeded", never "this one did" (see the docblock at the
  // removal site in `Loot.tsx`). `Loot` now sets `logsFailed` in its tier
  // effect and clears it only on a tier change, so do not relax this gate on
  // the assumption that something upstream also lifts the flag.
  const emptyMessage = logsLoading
    ? 'Loading entries…'
    : logsFailed && tierIsEmpty
      ? "Couldn't load this tier's entries."
      : tierIsEmpty
        ? 'No loot or materials logged this tier.'
        : 'No entries match your filters.';

  // Plain args to the render functions below (CELL / renderActionsCell /
  // buildRowMenuItems), not props on memoized children — identity is
  // irrelevant here, so memoizing these literals would be noise, not a fix.
  const cellCtx: CellContext = { floors, playersById };
  const actionsCtx: ActionsCellContext = { playersById, openMenu: setMenu };
  const menuCtx: RowMenuContext = {
    canEdit, playersById, onEdit, onEditMaterial, onCopyLink, onJumpToPlayer, onViewWeekInLog, onDelete,
  };

  /** The row's Alt activation and the menu's Jump item share this gate: the id resolves in the roster. */
  const canJumpTo = (item: HistoryItem) => playersById.has(item.entry.recipientPlayerId);

  // R-31: ONE activation handler for both `onClick` and `onKeyDown`, so the
  // modifier family is designed here rather than inherited from a cast (V1
  // routed the keyboard through `handleRowClick` via `e as unknown as
  // React.MouseEvent`). Order matters: Shift and Alt are live for EVERYONE
  // (R-D11-E — that is R-31's own premise, "plus R-18's Alt-held swap" is
  // vacuous otherwise); only the plain activation is permission-shaped.
  const activate = (mods: { shiftKey: boolean; altKey: boolean }, item: HistoryItem) => {
    if (mods.shiftKey) {
      onCopyLink(item);
      // V1 `AllWeeksView.tsx:315`: Shift+Click extends the browser selection
      // to the click point; clear it so copying leaves no selection artifact.
      window.getSelection()?.removeAllRanges();
      return;
    }
    if (mods.altKey) {
      if (canJumpTo(item)) onJumpToPlayer(item.entry.recipientPlayerId);
      return;
    }
    if (!canEdit) return; // R-D11-E: a viewer's plain activation is a no-op that never advertised itself
    if (item.kind === 'loot') onEdit(item.entry);
    else onEditMaterial(item.entry); // R-D11-H
  };

  const onRowClick = (e: ReactMouseEvent<HTMLTableRowElement>, item: HistoryItem) => {
    // R-D11-G, pointer path only: a plain click that completes a drag-select
    // is a selection. Shift/Alt are exempt (Shift+Click's own selection is
    // cleared inside `activate`), and so is the keyboard path below — Enter
    // cannot complete a drag-select, so a stale selection elsewhere on the
    // page must not silently gate a focused row.
    if (!e.shiftKey && !e.altKey && selectionActive()) return;
    activate(e, item);
  };

  const onRowKeyDown = (e: ReactKeyboardEvent<HTMLTableRowElement>, item: HistoryItem) => {
    // Only when the ROW itself is focused: the kebab's own Enter/Space
    // bubbles through here, and its native click already opens the menu.
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return; // V1 `:555-559` handles both
    e.preventDefault();
    activate(e, item);
  };

  const openRowMenu = (e: ReactMouseEvent<HTMLTableRowElement>, item: HistoryItem) => {
    e.preventDefault();
    // R-32 note 2 / PR #200: Shift+F10 and the menu key dispatch at (0, 0) —
    // anchor those to the row's rect rather than the page corner.
    const { x, y } = jumpMenuAnchor(e, e.currentTarget.getBoundingClientRect());
    setMenu({ x, y, item });
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-card overflow-clip">
      {/* R-D9b-C: inside the card, above the header, so the count travels with
          the table it describes. `role="status"` announces a filter change —
          the one moment the number changes without the user reading it. */}
      <div
        role="status"
        className="flex justify-end border-b border-border-default px-4 py-2 text-xs text-text-tertiary"
      >
        {statsLabel}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Loot and material history for this tier</caption>
        <thead className="sticky top-0 z-10 bg-surface-card border-b border-border-default">
          <tr>
            {COLUMNS.map((c) => (
              <SortableHeader
                key={c.field}
                field={c.field}
                label={c.label}
                currentField={sort.field}
                currentDirection={sort.direction}
                onSort={(f) => setSort((s) => nextHistorySort(f, s))}
                thClassName={c.thClassName}
              />
            ))}
            <th scope="col" className="w-12 px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-4 py-6 text-sm text-text-tertiary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((item, index) => {
              const { kind, entry } = item;
              const rowId = historyRowDomId({ kind, id: entry.id });
              const isHighlighted = highlightType === kind && highlightId === entry.id;
              // `rows` is already sorted, so a week boundary is simply "the
              // previous row was a different week" — no second grouping pass.
              const week = entry.weekNumber;
              const startsWeek =
                showSeparators && (index === 0 || rows[index - 1].entry.weekNumber !== week);
              // R-D11-F: the pointer cursor is set iff the activation that
              // WOULD fire right now does something — which is a choice, not a
              // union, because `activate` RETURNS out of the `altKey` branch
              // before the edit path. So with Alt held and Shift not (Shift is
              // checked first, and copies for everyone) the only candidate left
              // is the jump, even for an editor: on a row whose recipient no
              // longer resolves, a click does nothing and the cursor must not
              // claim otherwise (`LogWeekGrid.tsx`'s `altHeld && jump` swap).
              // A viewer's row at rest advertises nothing (R-31 q1).
              const pointer = altHeld ? canJumpTo(item) : canEdit;
              // Ring INSET (M3): the card is `overflow-clip`, so an outset ring
              // would be clipped on the first and last rows — the idiom V1's
              // own clickable cells use in the same situation
              // (`history/WeeklyLootGrid.tsx:577,708`), and the reason the
              // pulse ring is inset too. NO `select-none` (R-31 q2).
              const rowClassName =
                `hover:bg-surface-raised${pointer ? ' cursor-pointer' : ''}` +
                (canEdit
                  ? ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
                  : '') +
                (isHighlighted ? ' highlight-pulse' : '');
              // R-D11-L: `role="button"` costs the `<tr>` its `row` semantics,
              // so the label carries the whole row (V1 `AllWeeksView.tsx:553`).
              const rowLabel =
                `${kind === 'loot' ? 'Loot' : 'Material'}: ${slotNameOf(item)} — ` +
                `${recipientNameOf(item, playersById)}, Week ${week}`;
              return (
                <Fragment key={rowId}>
                  {startsWeek && (
                    <WeekSeparatorRow
                      week={week}
                      isCurrent={week === currentWeek}
                      range={rangeOfWeek(week)}
                      count={weekCounts.get(week) ?? 0}
                    />
                  )}
                  {/* R-D11-E: focusable, roled, labelled and keyboard-activatable
                      ONLY when `canEdit` — a focused row whose Enter does nothing
                      is R-31 q1's violation with a keyboard instead of a cursor.
                      `onClick`/`onContextMenu` are unconditional: Shift/Alt and
                      the menu are a viewer's affordances too. */}
                  <tr
                    id={rowId}
                    className={rowClassName}
                    tabIndex={canEdit ? 0 : undefined}
                    role={canEdit ? 'button' : undefined}
                    aria-label={canEdit ? rowLabel : undefined}
                    onClick={(e) => onRowClick(e, item)}
                    onKeyDown={canEdit ? (e) => onRowKeyDown(e, item) : undefined}
                    onContextMenu={(e) => openRowMenu(e, item)}
                  >
                    {COLUMNS.map((c) => (
                      <td key={c.field} className="px-4 py-2.5">
                        {CELL[c.field](item, cellCtx)}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">{renderActionsCell(item, actionsCtx)}</td>
                  </tr>
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      {/* R-D11-D: the ONE menu, outside every `<tr>` — a menu-item click must
          not bubble (React-tree-wise, through the portal) into a row's
          `onClick`. Rendered per open, like the grid's. */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildRowMenuItems(menu.item, menuCtx)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
