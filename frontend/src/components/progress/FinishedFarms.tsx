/**
 * FinishedFarms — the "Finished (n)" section of the Progress matrix (R-S2-7): the
 * `complete` goals, most recently completed first, collapsed under a disclosure
 * `Button`. The first expand asks the page to fetch their cells; the rows are the
 * same read-only rows, over the columns the active farms already built (TF5 ruling
 * 2). They are outside the roving grid (TF6): their cells show provenance on hover but
 * are not Tab stops or arrow targets, so the matrix stays one stop. Reopen is S2a-3a's.
 * Rendered inside the matrix `<table>` so the columns line up.
 *
 * S2a-3a·G2 (R-S3-3, R-S3-4): a finished row opens like an active one (its name button is
 * a plain tab stop), and `?track=<finished id>` expands the section first, once per id's
 * arrival, so a later collapse by the button holds while that id stays in the URL.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** The one open row's goal id, which may be a finished one (D-8). */
  openId: string | null;
  onToggle: (goalId: string) => void;
  /** The open row's panel (see `FarmRow`). */
  renderExpansion: (row: FarmRowModel, onClose: () => void, id: string) => ReactNode;
}

export function FinishedFarms({
  rows,
  colSpan,
  canManage,
  provenance,
  loading,
  error,
  onFirstExpand,
  onRetry,
  openId,
  onToggle,
  renderExpansion,
}: FinishedFarmsProps) {
  const [expanded, setExpanded] = useState(false);

  // A finished id in `?track` expands the section when it arrives (a deep link, a tab switch
  // back), adjusted during the render that sees it; the same id never re-expands, so collapsing
  // by the button holds, and the memory clears once the id is gone.
  // The rule (TG3 ruling): a manual collapse holds, and `?track` stays until the row is toggled or closed.
  const openHere = openId !== null && rows.some((r) => r.goal.id === openId);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  if (openHere && expandedFor !== openId) {
    setExpandedFor(openId);
    if (!expanded) setExpanded(true);
  } else if (!openHere && expandedFor !== null) {
    setExpandedFor(null);
  }

  // The first expand, however it came, asks the page for the cells once.
  const requested = useRef(false);
  useEffect(() => {
    if (!expanded || requested.current) return;
    requested.current = true;
    onFirstExpand();
  }, [expanded, onFirstExpand]);

  if (rows.length === 0) return null;

  return (
    <tbody data-testid="progress-finished">
      <tr className="border-t border-border-default">
        <td colSpan={colSpan} className="px-3 py-2">
          <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
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
      {expanded &&
        !loading &&
        error === null &&
        rows.map((row) => (
          <FarmRow
            key={row.goal.id}
            row={row}
            canManage={canManage}
            provenance={provenance}
            open={row.goal.id === openId}
            onToggle={() => onToggle(row.goal.id)}
            renderExpansion={(onClose, id) => renderExpansion(row, onClose, id)}
          />
        ))}
    </tbody>
  );
}
