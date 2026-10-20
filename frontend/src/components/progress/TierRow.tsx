/**
 * TierRow — row 1 of the Progress matrix, always (S2-5, R-S2-7), and from S2a-3b·H3 a row of
 * the table itself (R-T-3, E-5, design §3.2), the first of the active `<tbody>`, so its cells
 * sit under the player columns:
 *   - the name cell (rowheader): the tier's name;
 *   - a lead's menu cell: empty (the menu column has nothing to offer the tier);
 *   - the status cell: the status line ("23/77 BiS slots · Week 11 · 0 of 4 floors cleared")
 *     and Open board, a link-variant `Button` described by that line (R-T-12);
 *   - one cell per column (D-4): a card's BiS cell, or empty for a column with no card.
 *
 * In H3 the row sits outside the roving grid's rows: its buttons are plain tab stops, as
 * Finished rows' are. H3a joins it to the grid (R-T-4).
 */
import { Fragment, useId } from 'react';
import { Button } from '../primitives/Button';
import type { ProgressColumn } from '../../utils/progressModel';
import type { TierBisCell } from '../../utils/tierBis';
import { TierBisCellButton } from './TierBisCellButton';

/** `tierStatusText` joins its parts with this. */
const STATUS_SEPARATOR = ' · ';

/** One column's tier cell: null for a column with no card; `counted` says whether it adds to the total (D-4, D-7). */
export interface TierColumnCell {
  cell: TierBisCell | null;
  counted: boolean;
}

/** What the page hands the matrix for the tier row; `cells` is aligned to the matrix's columns. */
export interface TierRowModel {
  name: string;
  cells: TierColumnCell[];
  statusText: string;
  onOpenBoard: () => void;
}

interface TierRowProps {
  tier: TierRowModel;
  columns: ProgressColumn[];
  /** The reader is a lead: the row has the (empty) menu cell, as every farm row does. */
  lead: boolean;
}

export function TierRow({ tier, columns, lead }: TierRowProps) {
  const statusId = useId();
  return (
    <tr role="row" data-testid="progress-tier-row" className="border-t border-border-subtle">
      <th role="rowheader" scope="row" className="whitespace-nowrap px-3 py-2 text-left align-middle text-sm font-medium text-text-primary">
        {tier.name}
      </th>
      {lead && <td role="gridcell" className="px-1 py-2" />}
      <td role="gridcell" className="px-3 py-2 align-middle">
        <div className="flex max-w-52 flex-col items-start gap-0.5">
          {/* The line wraps between its parts only, so the column stays narrow. */}
          <span id={statusId} className="text-sm text-text-secondary">
            {tier.statusText.split(STATUS_SEPARATOR).map((part, i) => (
              <Fragment key={part}>
                {i > 0 && STATUS_SEPARATOR}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </span>
          <Button variant="link" aria-describedby={statusId} onClick={tier.onOpenBoard}>
            Open board
          </Button>
        </div>
      </td>
      {columns.map((column, i) => (
        <td key={column.key} role="gridcell" className="px-1 py-1 align-middle">
          <TierBisCellButton column={column} cell={tier.cells[i]?.cell ?? null} tierName={tier.name} />
        </td>
      ))}
    </tr>
  );
}
