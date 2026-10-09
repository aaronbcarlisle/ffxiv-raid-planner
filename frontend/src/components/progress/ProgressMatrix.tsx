/**
 * ProgressMatrix — the farms by player (S2a-2·F3, R-S2-6 / R-S2-7 / R-S2-18). One
 * `<table>`: a column per player in Board order, the unclaimed ones dim with "Claim
 * to track", then the "Not on the roster" / "Card not set up" members; a row per
 * active farm in `compareFarmRows` order; "Finished (n)" last. Read-only.
 *
 * It scrolls sideways inside its own container, never the page (R-S2-18). Nothing is
 * sticky (CLAUDE.md § Product rules). The tier row is the page's, above this.
 */
import { VisuallyHidden } from '../primitives/VisuallyHidden';
import { JobIcon } from '../ui/JobIcon';
import { Tag } from '../ui/Tag';
import { getValidRole } from '../../gamedata';
import type { FarmRow as FarmRowModel, ProgressColumn } from '../../utils/progressModel';
import { FarmRow } from './FarmRow';
import { FinishedFarms } from './FinishedFarms';

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
      <th scope="col" data-testid="progress-column" data-column-kind={column.kind} className="min-w-32 px-3 py-2 text-left align-top font-normal">
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
    <th scope="col" data-testid="progress-column" data-column-kind={column.kind} className="min-w-32 px-3 py-2 text-left align-top font-normal">
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
  /** The finished goals' cells are being fetched. */
  finishedLoading: boolean;
  /** Fetching the finished goals' cells failed. */
  finishedError?: string | null;
  /** Called once, on the first expand of Finished; also the retry. */
  onExpandFinished: () => void;
}

export function ProgressMatrix({ columns, active, finished, canManage, finishedLoading, finishedError = null, onExpandFinished }: ProgressMatrixProps) {
  return (
    <div
      data-testid="progress-matrix"
      role="region"
      aria-label="Farms by player"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scroll region for a keyboard-only user; focus is the keyboard path to the columns off screen (axe scrollable-region-focusable)
      tabIndex={0}
      className="relative overflow-x-auto rounded-lg border border-border-default bg-surface-card focus-visible:outline-2 focus-visible:outline-accent"
    >
      <table className="w-full min-w-max border-collapse">
        <caption>
          <VisuallyHidden>Farm progress by player</VisuallyHidden>
        </caption>
        <thead>
          <tr>
            <th scope="col" className="px-3 py-2 text-left align-top text-xs font-medium text-text-secondary">
              Farm
            </th>
            <th scope="col" className="px-3 py-2 text-left align-top text-xs font-medium text-text-secondary">
              Status
            </th>
            {columns.map((column) => (
              <ColumnHeader key={column.key} column={column} />
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((row) => (
            <FarmRow key={row.goal.id} row={row} canManage={canManage} />
          ))}
        </tbody>
        <FinishedFarms
          rows={finished}
          colSpan={columns.length + 2}
          canManage={canManage}
          loading={finishedLoading}
          error={finishedError}
          onFirstExpand={onExpandFinished}
          onRetry={onExpandFinished}
        />
      </table>
    </div>
  );
}
