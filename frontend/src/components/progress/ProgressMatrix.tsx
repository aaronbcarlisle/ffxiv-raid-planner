/**
 * ProgressMatrix — the farms by player (S2a-2·F3, R-S2-6 / R-S2-7 / R-S2-18). One
 * `<table>`: a column per player in Board order, the unclaimed ones dim with "Claim
 * to track", then the "Not on the roster" / "Card not set up" members; a row per
 * active farm in `compareFarmRows` order; "Finished (n)" last.
 *
 * It scrolls sideways inside its own container, never the page (R-S2-18). Nothing is
 * sticky (CLAUDE.md § Product rules). The tier row is the page's, above this.
 *
 * S2a-2·F4: the active rows and their columns are one `role="grid"` with a single roving
 * Tab stop (`useMatrixKeyboard`), and each cell says where its value came from on hover
 * and focus. The Finished rows are outside that grid (their cells are not focus targets).
 *
 * S2a-2·F5 (R-S2-10): the active cells `editFor` resolves a write target for (the reader's
 * own; every claimed cell in a lead's Edit statuses, S2a-2·F6) are pickers, and the
 * picker's Button is then that cell's stop. Everything else is read-only.
 *
 * S2a-3a·G2 (D-7, R-S3-3, R-S3-4): the grid's keys start with the name column (`NAME_KEY`),
 * whose cell is each row's disclosure Button, so the first row's name is the stop until a
 * cell is focused, and Home / ArrowLeft reach it. For leads `MENU_KEY` follows it (S2a-3a·G4
 * Task TG7, R-S3-17): a narrow "Actions" column holding each row's ⋯ menu, an arrow target, and
 * one more column in `spanAll`; members and viewers have neither. The one open row (`openId`, the page's `?track`) renders its panel
 * (`FarmExpansion`) as the next `<tr>`, spanning every column (`spanAll`) and outside
 * `rowIds`, in whichever `<tbody>` holds the row.
 */
import { useMemo } from 'react';
import { VisuallyHidden } from '../primitives/VisuallyHidden';
import { JobIcon } from '../ui/JobIcon';
import { Tag } from '../ui/Tag';
import { getValidRole } from '../../gamedata';
import type { MemberRole } from '../../types';
import type { WeekClock } from '../../utils/dropWeek';
import type { FarmRow as FarmRowModel, ProgressColumn } from '../../utils/progressModel';
import type { CellWriteResolver } from './editStatuses';
import { FarmExpansion } from './FarmExpansion';
import { FarmRow, MENU_KEY, NAME_KEY } from './FarmRow';
import { FinishedFarms } from './FinishedFarms';
import type { ProvenanceContext } from './progressProvenance';
import { useMatrixKeyboard } from './useMatrixKeyboard';
import { useVisibleWidth } from './useVisibleWidth';

/** Literal classes, so Tailwind's scanner sees every one. */
const ROLE_TEXT = {
  tank: 'text-role-tank',
  healer: 'text-role-healer',
  melee: 'text-role-melee',
  ranged: 'text-role-ranged',
  caster: 'text-role-caster',
} as const;

function ColumnHeader({ column }: { column: ProgressColumn }) {
  if (column.kind === 'notOnRoster') {
    return (
      <th role="columnheader" scope="col" data-testid="progress-column" data-column-kind={column.kind} className="min-w-32 px-3 py-2 text-left align-top font-normal">
        <div className="truncate text-sm font-medium text-text-secondary">{column.name}</div>
        <Tag variant="label" className="mt-1">
          {column.reason === 'unconfigured' ? 'Card not set up' : 'Not on the roster'}
        </Tag>
      </th>
    );
  }
  const { player } = column;
  const claimed = column.kind === 'claimed';
  return (
    <th role="columnheader" scope="col" data-testid="progress-column" data-column-kind={column.kind} className="min-w-32 px-3 py-2 text-left align-top font-normal">
      <div className="flex items-center gap-1.5">
        <JobIcon job={player.job} size="xs" className={claimed ? '' : 'opacity-60'} />
        {player.position != null && <span className="text-xs text-text-secondary">{player.position}</span>}
        <span
          className={`truncate text-sm font-medium ${claimed ? ROLE_TEXT[getValidRole(player.role)] : 'text-text-muted'}`}
        >
          {column.name}
        </span>
      </div>
      {!claimed && (
        <Tag variant="label" className="mt-1">
          Claim to track
        </Tag>
      )}
    </th>
  );
}

interface ProgressMatrixProps {
  columns: ProgressColumn[];
  active: FarmRowModel[];
  finished: FarmRowModel[];
  canManage: boolean;
  /** The effective viewer (View As aware): the provenance tooltip's "you". */
  currentUserId: string | null;
  /**
   * Display names by user id, for "set by {name}" when the writer has no column in this
   * tier: the static's members (a lead without a card, a past tier) and, since a View As
   * admin who is no member writes the viewed user's row, the signed-in user, which the
   * page adds below the members (TF7 ruling 8).
   */
  memberNames?: ReadonlyMap<string, string>;
  /** Where each active cell writes (R-S2-10), undefined for a read-only one; absent when nothing is editable (a viewer). */
  editFor?: CellWriteResolver;
  /** The finished goals' cells are being fetched. */
  finishedLoading: boolean;
  /** Fetching the finished goals' cells failed. */
  finishedError?: string | null;
  /** Called once, on the first expand of Finished; also the retry. */
  onExpandFinished: () => void;
  /** The one open row (D-7, D-8): a goal id of this static, or null. */
  openId: string | null;
  /** A row's name button was activated: open it, or close it when it is the open one. */
  onToggle: (goalId: string) => void;
  /** For the open row's panel. */
  groupId: string;
  userRole: MemberRole | null | undefined;
  /** The tier's week clock, for the open panel's drop labels (R-S3-9). */
  clock?: WeekClock;
}

export function ProgressMatrix({
  columns,
  active,
  finished,
  canManage,
  currentUserId,
  memberNames,
  editFor,
  finishedLoading,
  finishedError = null,
  onExpandFinished,
  openId,
  onToggle,
  groupId,
  userRole,
  clock,
}: ProgressMatrixProps) {
  const rowIds = useMemo(() => active.map((r) => r.goal.id), [active]);
  // Leads manage the farms (the ⋯ menu column, R-S3-17), as LogDropButton gates its split button.
  const lead = canManage && userRole !== 'viewer';
  // The name column leads (R-S3-4), then a lead's menu column, then the players.
  const colKeys = useMemo(
    () => [NAME_KEY, ...(lead ? [MENU_KEY] : []), ...columns.map((c) => c.key)],
    [columns, lead],
  );
  const keyboard = useMatrixKeyboard(rowIds, colKeys);
  // The open panel spans the table, which outgrows the view: it lays out at the scroller's width.
  const [scrollerRef, viewWidth] = useVisibleWidth<HTMLDivElement>();
  // Every column of the table: the grid's keys (name, a lead's menu, the players) plus Status, which is never a focus target.
  const spanAll = colKeys.length + 1;
  // With an active row the grid's single Tab stop (its name button at least) is the keyboard's
  // way into the scroller; without one the scroller itself is the stop (axe
  // scrollable-region-focusable).
  const hasCells = rowIds.length > 0;

  // Names for "set by {name}": a writer's column first, then the static's members.
  const columnNames = useMemo(() => {
    const byId = new Map<string, string>();
    for (const column of columns) if (column.userId !== null) byId.set(column.userId, column.name);
    return byId;
  }, [columns]);
  const provenance: ProvenanceContext = {
    viewerUserId: currentUserId,
    nameOf: (userId) => columnNames.get(userId) ?? memberNames?.get(userId) ?? null,
  };

  const renderExpansion = (row: FarmRowModel, finishedRow: boolean, onClose: () => void, id: string) => (
    <FarmExpansion
      row={row}
      finished={finishedRow}
      canManage={canManage}
      userRole={userRole}
      currentUserId={currentUserId}
      groupId={groupId}
      onClose={onClose}
      id={id}
      spanAll={spanAll}
      viewWidth={viewWidth}
      clock={clock}
    />
  );

  return (
    <div
      ref={scrollerRef}
      data-testid="progress-matrix"
      role="region"
      aria-label="Farms by player"
      tabIndex={hasCells ? undefined : 0}
      className="relative overflow-x-auto rounded-lg border border-border-default bg-surface-card focus-visible:outline-2 focus-visible:outline-accent"
    >
      <table role="grid" className="w-full min-w-max border-collapse">
        <caption>
          <VisuallyHidden>Farm progress by player</VisuallyHidden>
        </caption>
        <thead>
          <tr role="row">
            <th role="columnheader" scope="col" className="px-3 py-2 text-left align-top text-xs font-medium text-text-secondary">
              Farm
            </th>
            {lead && (
              <th role="columnheader" scope="col" className="px-1 py-2 text-left align-top">
                <VisuallyHidden>Actions</VisuallyHidden>
              </th>
            )}
            <th role="columnheader" scope="col" className="px-3 py-2 text-left align-top text-xs font-medium text-text-secondary">
              Status
            </th>
            {columns.map((column) => (
              <ColumnHeader key={column.key} column={column} />
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((row) => (
            <FarmRow
              key={row.goal.id}
              row={row}
              canManage={canManage}
              userRole={userRole}
              groupId={groupId}
              provenance={provenance}
              keyboard={keyboard}
              editFor={editFor}
              open={row.goal.id === openId}
              onToggle={() => onToggle(row.goal.id)}
              renderExpansion={(onClose, id) => renderExpansion(row, false, onClose, id)}
            />
          ))}
        </tbody>
        <FinishedFarms
          rows={finished}
          colSpan={spanAll}
          canManage={canManage}
          userRole={userRole}
          groupId={groupId}
          provenance={provenance}
          loading={finishedLoading}
          error={finishedError}
          onFirstExpand={onExpandFinished}
          onRetry={onExpandFinished}
          openId={openId}
          onToggle={onToggle}
          renderExpansion={(row, onClose, id) => renderExpansion(row, true, onClose, id)}
        />
      </table>
    </div>
  );
}
