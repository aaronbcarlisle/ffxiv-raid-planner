/**
 * LootHistoryTable — the flat sortable transparent record (R-29/R-46; D9a).
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
 * Owns the `?entry=&entryType=` deep-link highlight (legacy parity,
 * `SectionedLogView.tsx:628-680`): scrolls to and pulses the matching row, then
 * clears the params after 2.5s. The id the effect scrolls to and the id each
 * `<tr>` renders are the SAME call — `historyRowDomId` (D9a-q, one author).
 *
 * Frozen V1 reference (never imported): `history/AllWeeksView.tsx` renders
 * the same eight cells with inline hex and a clickable row.
 *
 * Trades on record: the card is `overflow-clip` (D9a-n) — an `overflow-x-auto`
 * scrollport would defeat the sticky `<thead>`, so below the width where eight
 * columns fit the right edge clips (Phase P re-decides for mobile). The Date
 * column is LOCAL time (D9a-o); D9b's week-range separators stay UTC-pinned.
 *
 * Later slices: D9b re-adds week separators / current-week marker / the stats
 * count and the filtered-vs-empty split (and with them `currentWeek` +
 * `rangeOfWeek`, D9a-l); D10 the search box; D11 the row click / right-click
 * `ContextMenu` conversion (R-31/R-32); D12 gear-row anchors.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

export interface LootHistoryTableProps {
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  players: SnapshotPlayer[];
  floors: string[];
  filters: HistoryFilterState;
  canEdit: boolean;
  onEdit: (entry: LootLogEntry) => void;
  onCopyLink: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
} // currentWeek / rangeOfWeek REMOVED (D9a-l) — D9b re-adds both with the week separators.

/** Header order IS column order; the `CELL` map renders one cell per field from the same list. */
const COLUMNS: ReadonlyArray<{
  field: HistorySortField;
  label: string;
  thClassName?: string;
  align?: 'left' | 'center';
}> = [
  { field: 'week', label: 'Week', thClassName: 'w-16' },
  { field: 'floor', label: 'Floor', thClassName: 'w-24' },
  { field: 'slot', label: 'Slot' },
  { field: 'player', label: 'Player' },
  { field: 'method', label: 'Method', thClassName: 'w-24' },
  { field: 'date', label: 'Date' },
  { field: 'type', label: 'Type', thClassName: 'w-28' },
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

interface CellContext {
  floors: string[];
  playersById: Map<string, SnapshotPlayer>;
}

/**
 * The Slot cell's lead-ins for a loot row: the R-39 glyph (known slots only),
 * then the R-38 job icon of the WEAPON that dropped — not the recipient's job,
 * which is the Player cell's.
 */
function lootSlotLeadIns(entry: LootLogEntry): ReactNode {
  return (
    <>
      {isLootSlot(entry.itemSlot) && <GearSlotIcon slot={entry.itemSlot} size={16} />}
      {entry.weaponJob && <JobIcon job={entry.weaponJob} size="xs" />}
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
        <span className="text-text-primary">{p?.name ?? i.entry.recipientPlayerName}</span>
      </span>
    );
  },
  method: (i) => <span className="text-text-secondary">{methodLabelOf(i)}</span>,
  date: (i) => (
    <span className="text-text-secondary whitespace-nowrap">{DATE_FMT.format(new Date(i.entry.createdAt))}</span>
  ),
  type: (i) =>
    i.kind === 'loot' ? (
      i.entry.isExtra ? (
        <Tag variant="label" tone="muted">
          Extra
        </Tag>
      ) : (
        <Tag variant="label" tone="success">
          BiS
        </Tag>
      )
    ) : (
      <Tag variant="label" tone="muted">
        {`aug ${augSlotLabel(i.entry.slotAugmented)}`}
      </Tag>
    ),
};

interface ActionsCellContext {
  canEdit: boolean;
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
 * labelled control is the `IconButton`'s `aria-label="Entry actions"`.
 */
function renderActionsCell(item: HistoryItem, ctx: ActionsCellContext): ReactNode {
  const { kind, entry } = item;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton aria-label="Entry actions" icon={<MoreVertical className="h-4 w-4" />} variant="ghost" size="sm" />
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
      playerNameOf: (i) => playersById.get(i.entry.recipientPlayerId)?.name ?? i.entry.recipientPlayerName,
    }),
    [floors, playersById],
  );
  const rows = useMemo(
    () => sortHistoryItems(filterHistoryItems(buildHistoryItems(lootLog, materialLog), filters), sort, sortCtx),
    [lootLog, materialLog, filters, sort, sortCtx],
  );
  const cellCtx: CellContext = { floors, playersById };
  const actionsCtx: ActionsCellContext = { canEdit, onEdit, onCopyLink, onDelete };

  return (
    <div className="rounded-lg border border-border-default bg-surface-card overflow-clip">
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
                align={c.align}
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
                No entries match — log a drop from the Priority view.
              </td>
            </tr>
          ) : (
            rows.map((item) => {
              const { kind, entry } = item;
              const rowId = historyRowDomId({ kind, id: entry.id });
              const isHighlighted = highlightType === kind && highlightId === entry.id;
              return (
                <tr key={rowId} id={rowId} className={`hover:bg-surface-raised${isHighlighted ? ' highlight-pulse' : ''}`}>
                  {COLUMNS.map((c) => (
                    <td key={c.field} className="px-4 py-2.5">
                      {CELL[c.field](item, cellCtx)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">{renderActionsCell(item, actionsCtx)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
