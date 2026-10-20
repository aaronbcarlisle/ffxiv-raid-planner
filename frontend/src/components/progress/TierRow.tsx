/**
 * TierRow — row 1 of the Progress matrix, always (S2-5, R-S2-7), and from S2a-3b·H3 a row of
 * the table itself (R-T-3, E-5, design §3.2), the first of the active `<tbody>`, so its cells
 * sit under the player columns:
 *   - the name cell (rowheader): the tier's name;
 *   - a lead's menu cell: empty (the menu column has nothing to offer the tier), named "No actions";
 *   - the status cell: the status line ("23/77 BiS slots · Week 11 · 0 of 4 floors cleared")
 *     and Open board, a link-variant `Button` described by that line (R-T-12);
 *   - one cell per column (D-4): a card's BiS cell, or empty for a column with no card.
 *
 * S2a-3b·H3a (E-6, R-T-4): the row is the roving grid's first row (`TIER_ROW_ID`), and every
 * column key has a focus target on it, since the grid stops at a cell with none: the rowheader
 * itself (`NAME_KEY`), the empty menu `<td>` (`MENU_KEY`), Open board (`STATUS_KEY`, the status
 * cell's one control), each BiS cell's `Button`, and a no-card column's empty `<td>`, named
 * "{name}, {tier}, no card" ("…, card not set up" for a Card-not-set-up column). So until a cell
 * is focused the tier's name is the grid's one stop.
 *
 * S2a-3b·H4 (R-T-6, design §3.5): when the row can open (`disclosure`), the name is a disclosure
 * `Button` named "{tier}" with a chevron, `aria-expanded` and `aria-controls` (the panel the matrix
 * renders next), and the grid's props move onto it, the cell's one focus target, as a farm's name
 * button holds them. Otherwise the name stays a plain cell. Each open scrolls the row into view.
 */
import { Fragment, useEffect, useId, useRef } from 'react';
import { Button } from '../primitives/Button';
import { VisuallyHidden } from '../primitives/VisuallyHidden';
import { useAltHeld } from '../../hooks/useAltHeld';
import type { ProgressColumn } from '../../utils/progressModel';
import { TIER_STATUS_SEPARATOR, type TierBisCell } from '../../utils/tierBis';
import { CELL_FOCUS_RING } from './cellFocusRing';
import { tierNameId } from './farmFocus';
import { MENU_KEY, NAME_KEY, STATUS_KEY } from './FarmRow';
import { TierBisCellButton } from './TierBisCellButton';
import { TIER_PANEL_ID, type TierPanelModel } from './TierExpansion';
import type { MatrixKeyboard } from './useMatrixKeyboard';

/** The tier row's id in the roving grid's rows (R-T-4): never a goal id. */
export const TIER_ROW_ID = '__tier';

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
  /** Jump to a card's row on Roster ▸ Board (D-5, E-9): Alt+Click on a cell and the breakdown's Open on board. */
  onJump: (playerId: string) => void;
  /** The row opens into the split plan (R-T-6, R-T-8); absent when it can't, and the name is a plain cell. */
  panel?: TierPanelModel;
}

interface TierRowProps {
  tier: TierRowModel;
  columns: ProgressColumn[];
  /** The reader is a lead: the row has the (empty) menu cell, as every farm row does. */
  lead: boolean;
  /** The matrix's roving grid, which this row leads (R-T-4). */
  keyboard: MatrixKeyboard;
  /** The row can open: whether it is the open row, and its name button's toggle. */
  disclosure?: { open: boolean; onToggle: () => void };
}

export function TierRow({ tier, columns, lead, keyboard, disclosure }: TierRowProps) {
  const statusId = useId();
  // One Alt listener for the row, not one per cell (the cursor shows only while Alt is held).
  const altHeld = useAltHeld();
  const grid = (colKey: string) => keyboard.cellProps(TIER_ROW_ID, colKey);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const open = disclosure?.open === true;
  // Once per open (S2-9), a deep link's included. (Optional: jsdom has no scrollIntoView.)
  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);
  return (
    <tr ref={rowRef} role="row" data-testid="progress-tier-row" className="border-t border-border-subtle">
      <th
        role="rowheader"
        scope="row"
        className={`whitespace-nowrap text-left align-middle ${disclosure ? 'py-1 pl-0 pr-3 font-normal' : `px-3 py-2 text-sm font-medium text-text-primary ${CELL_FOCUS_RING}`}`}
        {...(disclosure ? undefined : grid(NAME_KEY))}
      >
        {disclosure ? (
          <Button
            id={tierNameId}
            variant="ghost"
            size="sm"
            trailing="chevron"
            aria-expanded={disclosure.open}
            aria-controls={TIER_PANEL_ID}
            onClick={disclosure.onToggle}
            className={`[&>svg:last-child]:transition-transform ${disclosure.open ? '[&>svg:last-child]:rotate-180' : ''}`}
            {...grid(NAME_KEY)}
          >
            {tier.name}
          </Button>
        ) : (
          tier.name
        )}
      </th>
      {lead && (
        <td role="gridcell" className={`px-1 py-2 ${CELL_FOCUS_RING}`} {...grid(MENU_KEY)}>
          <VisuallyHidden>No actions</VisuallyHidden>
        </td>
      )}
      <td role="gridcell" className="px-3 py-2 align-middle">
        <div className="flex max-w-52 flex-col items-start gap-0.5">
          {/* The line wraps between its parts only, so the column stays narrow. */}
          <span id={statusId} className="text-sm text-text-secondary">
            {tier.statusText.split(TIER_STATUS_SEPARATOR).map((part, i) => (
              <Fragment key={part}>
                {i > 0 && TIER_STATUS_SEPARATOR}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </span>
          <Button variant="link" aria-describedby={statusId} onClick={tier.onOpenBoard} {...grid(STATUS_KEY)}>
            Open board
          </Button>
        </div>
      </td>
      {columns.map((column, i) => {
        const cell = tier.cells[i]?.cell ?? null;
        // A column with no card (Not on the roster, Card not set up) is an empty focus target.
        if (cell === null || column.player === null) {
          const unset = column.kind === 'notOnRoster' && column.reason === 'unconfigured';
          return (
            <td
              key={column.key}
              role="gridcell"
              aria-label={`${column.name}, ${tier.name}, ${unset ? 'card not set up' : 'no card'}`}
              className={`px-1 py-1 align-middle ${CELL_FOCUS_RING}`}
              {...grid(column.key)}
            />
          );
        }
        return (
          <td key={column.key} role="gridcell" className="px-1 py-1 align-middle">
            <TierBisCellButton
              column={column}
              cell={cell}
              tierName={tier.name}
              grid={grid(column.key)}
              altHeld={altHeld}
              onJump={tier.onJump}
            />
          </td>
        );
      })}
    </tr>
  );
}
