/**
 * LootHistoryTable — the flat sortable transparent record (R-29/R-46; D9a+D9b).
 *
 * One `<table>`: seven `SortableHeader` columns (Week · Floor · Slot · Player ·
 * Method · Date · Type) plus the ⋮ kebab column, ordered by a session-local
 * `HistorySortState` (`sortHistoryItems`; default Week desc, ties newest-first —
 * R-29 note 3: not persisted, not in the URL). Cells: R-33 floor chip (`Tag`
 * floor tone, D9a-r), R-39 slot glyph (`GearSlotIcon`; a material dot for
 * material rows), R-38 weapon job in Slot and recipient job in Player, the
 * `aug {slot}` readout in Type (R-34 / R-D9a-A / D9a-t). Rows are inert — the
 * kebab is the only control (D9a-i, D9a-k).
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
 * Later slices: D10 the search box; D11 the row click / right-click
 * `ContextMenu` conversion (R-31/R-32); D12 gear-row anchors.
 */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { SortableHeader } from '../ui/SortableHeader';
import { Tag, type Tone } from '../ui/Tag';
import { GearSlotIcon } from '../ui/GearSlotIcon';
import { JobIcon } from '../ui/JobIcon';
import { IconButton } from '../primitives/IconButton';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../primitives/Dropdown';
import { historyRowDomId, type HistoryItem } from './logWeekGridData';
import {
  buildHistoryItems,
  filterHistoryItems,
  sortHistoryItems,
  nextHistorySort,
  slotNameOf,
  methodLabelOf,
  DEFAULT_HISTORY_SORT,
  type HistoryFilterState,
  type HistorySortContext,
  type HistorySortField,
  type HistorySortState,
} from '../../utils/historyItems';
import { GEAR_SLOTS } from '../../types';
import type { LootLogEntry, LootSlot, MaterialLogEntry, MaterialType, SnapshotPlayer } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import type { WeekRange } from '../../hooks/useWeekClock';

export interface LootHistoryTableProps {
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  players: SnapshotPlayer[];
  floors: string[];
  filters: HistoryFilterState;
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

/** D9a-t: the shipped `null → tome wpn` fallback kept, the `tome_weapon` enum leak closed. */
function augSlotLabel(slotAugmented: MaterialLogEntry['slotAugmented']): string {
  return slotAugmented == null || slotAugmented === 'tome_weapon' ? 'tome wpn' : slotAugmented;
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

interface ActionsCellContext {
  canEdit: boolean;
  playersById: Map<string, SnapshotPlayer>;
  onEdit: (entry: LootLogEntry) => void;
  onCopyLink: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
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
 */
function renderActionsCell(item: HistoryItem, ctx: ActionsCellContext): ReactNode {
  const { kind, entry } = item;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton
          aria-label={`${slotNameOf(item)} entry actions — ${recipientNameOf(item, ctx.playersById)}`}
          icon={<MoreVertical className="h-4 w-4" />}
          variant="ghost"
          size="sm"
        />
      </DropdownTrigger>
      <DropdownContent align="end">
        {kind === 'loot' && ctx.canEdit && (
          <DropdownItem onSelect={() => ctx.onEdit(entry)}>Edit</DropdownItem>
        )}
        <DropdownItem onSelect={() => ctx.onCopyLink(item)}>Copy link</DropdownItem>
        {ctx.canEdit && (
          <DropdownItem danger onSelect={() => ctx.onDelete(item)}>
            Delete
          </DropdownItem>
        )}
      </DropdownContent>
    </Dropdown>
  );
}

export function LootHistoryTable({
  lootLog,
  materialLog,
  players,
  floors,
  filters,
  currentWeek,
  rangeOfWeek,
  logsLoading,
  logsFailed,
  canEdit,
  onEdit,
  onCopyLink,
  onDelete,
}: LootHistoryTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Session-local (R-29 note 3): a fresh mount starts on Week desc.
  const [sort, setSort] = useState<HistorySortState>(DEFAULT_HISTORY_SORT);

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
  const rows = useMemo(
    () => sortHistoryItems(filterHistoryItems(buildHistoryItems(lootLog, materialLog), filters), sort, sortCtx),
    [lootLog, materialLog, filters, sort, sortCtx],
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
  // stale flag says, so zero rows can only be the filter. That keeps the
  // component self-consistent independent of how the flag is driven — the
  // caller also retracts it on a successful refetch, and neither mechanism
  // should be the only thing standing between a user and a false claim
  // (D9b review round 4).
  const emptyMessage = logsLoading
    ? 'Loading entries…'
    : logsFailed && tierIsEmpty
      ? "Couldn't load this tier's entries."
      : tierIsEmpty
        ? 'No loot or materials logged this tier.'
        : 'No entries match your filters.';

  // Plain args to the render functions below (CELL / renderActionsCell), not
  // props on memoized children — identity is irrelevant here, so memoizing
  // these literals would be noise, not a fix.
  const cellCtx: CellContext = { floors, playersById };
  const actionsCtx: ActionsCellContext = { canEdit, playersById, onEdit, onCopyLink, onDelete };

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
                  <tr id={rowId} className={`hover:bg-surface-raised${isHighlighted ? ' highlight-pulse' : ''}`}>
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
    </div>
  );
}
