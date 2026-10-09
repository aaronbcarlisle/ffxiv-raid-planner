/**
 * FinishedFarms — the "Finished (n)" section of the Progress matrix (R-S2-7): the
 * `complete` goals, most recently completed first, collapsed under a disclosure
 * `Button`. The first expand asks the page to fetch their cells; the rows are the
 * same read-only rows, over the columns the active farms already built (TF5 ruling
 * 2). Reopen is S2a-3a's. Rendered inside the matrix `<table>` so the columns line up.
 */
import { useState } from 'react';
import { Button } from '../primitives/Button';
import type { FarmRow as FarmRowModel } from '../../utils/progressModel';
import { FarmRow } from './FarmRow';

interface FinishedFarmsProps {
  rows: FarmRowModel[];
  /** Total columns of the matrix (farm + status + one per column), for the full-width rows. */
  colSpan: number;
  canManage: boolean;
  /** The finished goals' cells are being fetched. */
  loading: boolean;
  /** Called on the first expand only. */
  onFirstExpand: () => void;
}

export function FinishedFarms({ rows, colSpan, canManage, loading, onFirstExpand }: FinishedFarmsProps) {
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
      {expanded && !loading && rows.map((row) => <FarmRow key={row.goal.id} row={row} canManage={canManage} />)}
    </tbody>
  );
}
