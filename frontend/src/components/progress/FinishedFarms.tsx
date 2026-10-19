/**
 * FinishedFarms — the "Finished (n)" section of the Progress matrix (R-S2-7): the
 * `complete` goals, most recently completed first, collapsed under a disclosure
 * `Button`. The first expand asks the page to fetch their cells; the rows are the
 * same read-only rows, over the columns the active farms already built (TF5 ruling
 * 2). They are outside the roving grid (TF6): their cells show provenance on hover but
 * are not Tab stops or arrow targets, so the matrix stays one stop. Reopen is S2a-3a's.
 * Rendered inside the matrix `<table>` so the columns line up.
 */
import { useState } from 'react';
import { Button } from '../primitives/Button';
import type { FarmRow as FarmRowModel } from '../../utils/progressModel';
import { FarmRow } from './FarmRow';
import type { ProvenanceContext } from './progressProvenance';

interface FinishedFarmsProps {
  rows: FarmRowModel[];
  /** Total columns of the matrix (farm + status + one per column), for the full-width rows. */
  colSpan: number;
  canManage: boolean;
  provenance: ProvenanceContext;
  /** The finished goals' cells are being fetched. */
  loading: boolean;
  /** Fetching the finished goals' cells failed; shown here so the active rows stay. */
  error: string | null;
  /** Called on the first expand only. */
  onFirstExpand: () => void;
  /** Fetch the finished goals' cells again. */
  onRetry: () => void;
}

export function FinishedFarms({ rows, colSpan, canManage, provenance, loading, error, onFirstExpand, onRetry }: FinishedFarmsProps) {
  const [expanded, setExpanded] = useState(false);
  const [requested, setRequested] = useState(false);

  if (rows.length === 0) return null;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !requested) {
      setRequested(true);
      onFirstExpand();
    }
  };

  return (
    <tbody data-testid="progress-finished">
      <tr className="border-t border-border-default">
        <td colSpan={colSpan} className="px-3 py-2">
          <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={toggle}>
            {`Finished (${rows.length})`}
          </Button>
        </td>
      </tr>
      {expanded && loading && (
        <tr>
          <td colSpan={colSpan} className="px-3 py-2 text-sm text-text-secondary">
            <span role="status">Loading finished farms…</span>
          </td>
        </tr>
      )}
      {expanded && !loading && error !== null && (
        <tr>
          <td colSpan={colSpan} className="px-3 py-2">
            <div role="alert" data-testid="progress-finished-error" className="flex flex-wrap items-center gap-3 text-sm text-text-primary">
              <span>{`Couldn't load finished farms: ${error}`}</span>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          </td>
        </tr>
      )}
      {expanded && !loading && error === null && rows.map((row) => <FarmRow key={row.goal.id} row={row} canManage={canManage} provenance={provenance} />)}
    </tbody>
  );
}
