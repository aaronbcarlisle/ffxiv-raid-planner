/**
 * FarmExpansion — the open farm row's panel (S2a-3a·G2 Task TG3; design §3.4, R-S3-4). One
 * `<tr role="row">` right after its farm row, whose single `gridcell` spans the whole matrix
 * (`spanAll`). It is NOT one of the roving grid's rows (`rowIds`), so the arrow keys skip it,
 * and Tab moves from the open row's cell into the panel's controls in DOM order. The shell
 * here: the action bar's slot (TG5's Log a drop / I got it / Copy plan, TG7's Mark finished)
 * and the three columns, Next in line (TG4) · Last drops (TG5) · About (TG4), with their
 * headings; the props TG4–TG5 read (`row`, `finished`, `canManage`, `userRole`,
 * `currentUserId`, `groupId`) are declared here and unused until then.
 *
 * Escape inside the panel closes it (TG8's Edit excepted), through `escapeClosesPanel`'s
 * filter (R-S3-4, vet I-2): never a key a layer handled already, never one from a portalled
 * node outside this row. Closing returns focus to the name button: the caller's `onClose`.
 */
import { useRef, type KeyboardEvent } from 'react';
import type { MemberRole } from '../../types';
import type { FarmRow as FarmRowModel } from '../../utils/progressModel';
import { escapeClosesPanel } from './panelEscape';

export interface FarmExpansionProps {
  row: FarmRowModel;
  /** A finished farm's panel (no drop action, TG5). */
  finished: boolean;
  canManage: boolean;
  userRole: MemberRole | null | undefined;
  /** The viewed user under View As, as `ProgressPage` receives it (null with no signed-in viewer). */
  currentUserId: string | null;
  groupId: string;
  /** The panel asks to close (Escape); the caller closes it and returns focus to the name button. */
  onClose: () => void;
  /** The row's DOM id, which the name button's `aria-controls` names. */
  id: string;
  /** Every column of the matrix, for the one cell that spans them. */
  spanAll: number;
}

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-text-muted';

export function FarmExpansion({ onClose, id, spanAll }: FarmExpansionProps) {
  const panelRef = useRef<HTMLTableRowElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!escapeClosesPanel(event, panelRef.current)) return;
    event.preventDefault();
    onClose();
  };

  return (
    <tr
      ref={panelRef}
      id={id}
      role="row"
      data-testid="progress-expansion"
      className="border-t border-border-subtle bg-surface-elevated"
      onKeyDown={onKeyDown}
    >
      <td role="gridcell" colSpan={spanAll} className="px-4 py-3 align-top">
        {/* The action bar (TG5, TG7). */}
        <div data-testid="progress-expansion-actions" className="flex flex-wrap items-center gap-2" />
        <div className="grid gap-4 md:grid-cols-3">
          <section aria-labelledby={`${id}-queue`} data-testid="progress-expansion-queue">
            <h2 id={`${id}-queue`} className={HEADING}>
              Next in line
            </h2>
          </section>
          <section aria-labelledby={`${id}-drops`} data-testid="progress-expansion-drops">
            <h2 id={`${id}-drops`} className={HEADING}>
              Last drops
            </h2>
          </section>
          <section aria-labelledby={`${id}-about`} data-testid="progress-expansion-about">
            <h2 id={`${id}-about`} className={HEADING}>
              About
            </h2>
          </section>
        </div>
      </td>
    </tr>
  );
}
