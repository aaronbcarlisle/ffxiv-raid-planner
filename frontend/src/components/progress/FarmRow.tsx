/**
 * FarmRow — one farm of the Progress matrix (R-S2-7): the name cell, a "Wanted" /
 * "Scheduled" tag when it isn't Farming (Q-3), the status column ("{n} of {m} have it"),
 * then one cell per column. From S2a-2·F5 a cell that `editFor` gives a target is a picker
 * (the reader's own; every claimed cell in a lead's Edit statuses from F6).
 *
 * S2a-3a·G2 (D-7, R-S3-4): the name is a disclosure `Button` named "{title}", with the type
 * icon, a chevron, `aria-expanded` and `aria-controls`; the " · {type}" reads beside it. On an
 * active row the button is the grid's `'__name'` cell (`cellProps`), so Home, ArrowLeft and
 * the arrows reach it and Enter or Space toggles (a native button); on a Finished row it is a
 * plain tab stop. The open row renders its panel (`renderExpansion`) as the next `<tr>`, and
 * scrolls itself and the panel into view once per open (R-S3-3). When the panel asks to close (Escape),
 * focus returns to the name button, found by its id (the button may be anywhere the row
 * moved to).
 *
 * S2a-3a·G4 Task TG7 (D-22, R-S3-17): a lead's row has a second cell right after the name, the
 * ⋯ menu (`FarmRowMenu`), which on an active row is the grid's `'__menu'` cell (`cellProps`) and
 * on a Finished row a plain tab stop. The status cell reads only "Everyone has it"; Mark finished
 * lives in the menu and the open panel's action bar. Members and viewers get no such cell.
 *
 * S2a-3b·H3a (E-6, R-T-4): on an active row the status `<td>` is the grid's `'__status'` cell
 * (`STATUS_KEY`), a read-only focus target as a blank cell is, so the arrows cross it.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Button } from '../primitives/Button';
import { Tag } from '../ui/Tag';
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from '../../utils/goalTypeMeta';
import type { MemberRole } from '../../types';
import type { FarmRow as FarmRowModel } from '../../utils/progressModel';
import type { CellWriteResolver } from './editStatuses';
import { claimFarmFocus, farmNameId } from './farmFocus';
import { FarmRowMenu } from './FarmRowMenu';
import { ProgressCell } from './ProgressCell';
import type { ProvenanceContext } from './progressProvenance';
import type { MatrixKeyboard } from './useMatrixKeyboard';

/** The roving grid's key for the name column (R-S3-4); a lead's `MENU_KEY` follows it (R-S3-17). */
export const NAME_KEY = '__name';
/** The roving grid's key for a lead's row menu column (R-S3-17). */
export const MENU_KEY = '__menu';
/** The roving grid's key for the status column, after the name (or a lead's menu) and before the players (R-T-4). */
export const STATUS_KEY = '__status';

interface FarmRowProps {
  row: FarmRowModel;
  /** Leads read "Everyone has it" at n = m; everyone else reads the count. */
  canManage: boolean;
  /** With `canManage`, whether the reader is a lead (not a viewer): the row has the ⋯ menu cell (R-S3-17). */
  userRole: MemberRole | null | undefined;
  groupId: string;
  /** Who is looking and how to name a writer, for each cell's provenance tooltip. */
  provenance: ProvenanceContext;
  /** The matrix's roving grid; absent for rows outside it (Finished), whose cells are not tab stops. */
  keyboard?: MatrixKeyboard;
  /** Where each cell writes (R-S2-10); absent for read-only rows (Finished). */
  editFor?: CellWriteResolver;
  /** This is the one open row (D-7): its panel renders right after it. */
  open: boolean;
  /** The name button was activated. */
  onToggle: () => void;
  /** The open row's panel, given the close callback (which also returns focus here) and the panel's DOM id. */
  renderExpansion: (onClose: () => void, id: string) => ReactNode;
}

function statusText(tally: FarmRowModel['tally'], canManage: boolean): string {
  if (tally.m === 0) return 'Nobody to track yet';
  if (tally.everyone && canManage) return 'Everyone has it';
  return `${tally.n} of ${tally.m} have it`;
}

export function FarmRow({ row, canManage, userRole, groupId, provenance, keyboard, editFor, open, onToggle, renderExpansion }: FarmRowProps) {
  const { goal } = row;
  const TypeIcon = GOAL_TYPE_ICONS[goal.goalType];
  const stateTag = goal.status === 'wanted' ? 'Wanted' : goal.status === 'scheduled' ? 'Scheduled' : null;
  const panelId = `progress-expansion-${goal.id}`;
  const nameId = farmNameId(goal.id);
  const lead = canManage && userRole !== 'viewer';
  const rowRef = useRef<HTMLTableRowElement>(null);

  // Once per open (R-S3-3): the row, then its panel (the next <tr>, committed before this effect),
  // so a deep link to the last row shows both, and a click barely moves them (`nearest`).
  // (Optional: jsdom has no scrollIntoView.)
  useEffect(() => {
    if (!open) return;
    const rowEl = rowRef.current;
    rowEl?.scrollIntoView?.({ block: 'nearest' });
    rowEl?.nextElementSibling?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);

  // An active row that a status write just moved here takes the focus the old row held
  // (`farmFocus`). A Finished row's focus is `FinishedFarms`'s call: its rows come and go with
  // the section's fetch.
  const inGrid = keyboard !== undefined;
  useLayoutEffect(() => {
    if (inGrid && claimFarmFocus(goal.id, 'active')) document.getElementById(nameId)?.focus();
  }, [inGrid, goal.id, nameId]);

  const close = () => {
    onToggle();
    document.getElementById(nameId)?.focus();
  };

  return (
    <>
      <tr ref={rowRef} role="row" data-testid="progress-farm-row" data-goal-id={goal.id} className="border-t border-border-subtle">
        <th role="rowheader" scope="row" className="py-1 pl-0 pr-3 text-left align-middle font-normal">
          <div className="flex items-center gap-2">
            <Button
              id={nameId}
              variant="ghost"
              size="sm"
              leftIcon={<TypeIcon size={16} className="shrink-0" aria-hidden="true" />}
              trailing="chevron"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
              className={`[&>svg:last-child]:transition-transform ${open ? '[&>svg:last-child]:rotate-180' : ''}`}
              {...keyboard?.cellProps(goal.id, NAME_KEY)}
            >
              {goal.title}
            </Button>
            <span className="whitespace-nowrap text-sm text-text-secondary">{`· ${GOAL_TYPE_LABELS[goal.goalType]}`}</span>
            {stateTag !== null && <Tag variant="label">{stateTag}</Tag>}
          </div>
        </th>
        {lead && (
          <td role="gridcell" data-testid="progress-menu" className="px-1 py-1 align-middle">
            <FarmRowMenu groupId={groupId} goal={goal} grid={keyboard?.cellProps(goal.id, MENU_KEY)} />
          </td>
        )}
        <td
          role="gridcell"
          data-testid="progress-status"
          className="whitespace-nowrap px-3 py-2 text-sm text-text-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          {...keyboard?.cellProps(goal.id, STATUS_KEY)}
        >
          {statusText(row.tally, canManage)}
        </td>
        {row.cells.map((cell) => (
          <ProgressCell
            key={cell.column.key}
            cell={cell}
            goal={goal}
            provenance={provenance}
            grid={keyboard?.cellProps(goal.id, cell.column.key)}
            editFor={editFor}
          />
        ))}
      </tr>
      {open && renderExpansion(close, panelId)}
    </>
  );
}
