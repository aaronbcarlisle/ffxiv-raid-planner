/**
 * ProgressMatrix — the farms by player (S2a-2·F3, R-S2-6 / R-S2-7 / R-S2-18). One
 * `<table>`: a column per player in Board order, the unclaimed ones dim with "Claim
 * to track", then the "Not on the roster" / "Card not set up" members; a row per
 * active farm in `compareFarmRows` order; "Finished (n)" last. Read-only.
 *
 * It scrolls sideways inside its own container, never the page (R-S2-18). Nothing is
 * sticky (CLAUDE.md § Product rules). The tier row is the page's, above this.
 *
 * S2a-2·F4: the active rows and their columns are one `role="grid"` with a single roving
 * Tab stop (`useMatrixKeyboard`), and each cell says where its value came from on hover
 * and focus. The Finished rows are outside that grid (their cells are not focus targets).
 * Still read-only.
 */
import { useMemo } from 'react';
import { VisuallyHidden } from '../primitives/VisuallyHidden';
import { JobIcon } from '../ui/JobIcon';
import { Tag } from '../ui/Tag';
import { getValidRole } from '../../gamedata';
import type { FarmRow as FarmRowModel, ProgressColumn } from '../../utils/progressModel';
import { FarmRow } from './FarmRow';
import { FinishedFarms } from './FinishedFarms';
import type { ProvenanceContext } from './progressProvenance';
import { useMatrixKeyboard } from './useMatrixKeyboard';

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
   * Display names of the static's members by user id, for "set by {name}" when the writer
   * has no column in this tier (a lead without a card, a past tier, the View As admin).
   */
  memberNames?: ReadonlyMap<string, string>;
  /** The finished goals' cells are being fetched. */
  finishedLoading: boolean;
  /** Fetching the finished goals' cells failed. */
  finishedError?: string | null;
  /** Called once, on the first expand of Finished; also the retry. */
  onExpandFinished: () => void;
}

export function ProgressMatrix({
  columns,
  active,
  finished,
  canManage,
  currentUserId,
  memberNames,
  finishedLoading,
  finishedError = null,
  onExpandFinished,
}: ProgressMatrixProps) {
  const rowIds = useMemo(() => active.map((r) => r.goal.id), [active]);
  const colKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const keyboard = useMatrixKeyboard(rowIds, colKeys);
  // With at least one cell the grid's single Tab stop is the keyboard's way into the
  // scroller; without one the scroller itself is the stop (axe scrollable-region-focusable).
  const hasCells = rowIds.length > 0 && colKeys.length > 0;

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

  return (
    <div
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
            <FarmRow key={row.goal.id} row={row} canManage={canManage} provenance={provenance} keyboard={keyboard} />
          ))}
        </tbody>
        <FinishedFarms
          rows={finished}
          colSpan={columns.length + 2}
          canManage={canManage}
          provenance={provenance}
          loading={finishedLoading}
          error={finishedError}
          onFirstExpand={onExpandFinished}
          onRetry={onExpandFinished}
        />
      </table>
    </div>
  );
}
