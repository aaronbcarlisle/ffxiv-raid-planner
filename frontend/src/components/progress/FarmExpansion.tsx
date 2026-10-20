/**
 * FarmExpansion — the open farm row's panel (S2a-3a·G2 Task TG3; design §3.4, R-S3-4). One
 * `<tr role="row">` right after its farm row, whose single `gridcell` spans the whole matrix
 * (`spanAll`). It is NOT one of the roving grid's rows (`rowIds`), so the arrow keys skip it,
 * and Tab moves from the open row's cell into the panel's controls in DOM order. The action
 * bar comes first (TG5's Log a drop / I got it and TG7's Mark finished join Copy plan, which
 * every role has, a finished row included), then the three columns, Next in line · Last drops
 * · About (D-4).
 *
 * The drop action (S2a-3a·G3 Task TG5), on active rows only: a lead's split button
 * (`canManage` and not a viewer, R-S3-6), else "I got it" for a member's own cell (a `claimed`
 * or Not-on-the-roster column) that is not Have (D-5), once the drops have loaded and hold none
 * for `currentUserId`, the viewed user under View As (R-S3-16, D-21). A failed drops load leaves
 * the cell rule to decide, with whatever drops are known. Last drops reads the same load.
 *
 * Escape inside the panel closes it (TG8's Edit excepted), through `escapeClosesPanel`'s
 * filter (R-S3-4, vet I-2): never a key a layer handled already, never one from a portalled
 * node outside this row. Closing returns focus to the name button: the caller's `onClose`.
 *
 * Last drops' delete (S2a-3a·G4 Task TG6, D-14): a lead on every drop, a member on the drops
 * they logged (`createdById` is `currentUserId`), a viewer on none.
 *
 * Mark finished (S2a-3a·G4 Task TG7, D-22, R-S3-17): a lead's `Button` in the action bar on an
 * active row everyone has (n = m > 0), doing what the row menu's item does. The status cell reads
 * only "Everyone has it".
 *
 * Edit (S2a-3a·G5 Task TG8, D-12, R-S3-10): while the page says this row is being edited
 * (`farmEditContext`), `FarmEditBlock` sits on top of the action bar. Escape inside it is the
 * block's (it discards and prevents the key), so the filter above leaves the panel open. Mark
 * finished asks "Discard changes?" first when the block is dirty, as the menu's item does.
 */
import { useCallback, useRef, type KeyboardEvent } from 'react';
import { CircleCheck, Copy } from 'lucide-react';
import type { RewardDrop } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import type { MemberRole } from '../../types';
import { buildDiscordPlan, planEntriesFor, type DiscordPlanEntry } from '../../utils/discordPlan';
import type { WeekClock } from '../../utils/dropWeek';
import type { FarmRow as FarmRowModel } from '../../utils/progressModel';
import { Button } from '../primitives';
import { AboutBlock } from './AboutBlock';
import { useFarmEdit } from './farmEditContext';
import { FarmEditBlock } from './FarmEditBlock';
import { DropList } from './DropList';
import { IGotItButton } from './IGotItButton';
import { LogDropButton } from './LogDropButton';
import { escapeClosesPanel } from './panelEscape';
import { QueueList } from './QueueList';
import { BUSY_CLASS, useGoalDrops } from './useDrops';
import { useGoalStatus } from './useGoalStatus';

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
  /**
   * The matrix scroller's visible width, or null while unmeasured. The cell spans a table wider
   * than the view, so the content is held to this width, left-aligned at the table's edge, and
   * its columns wrap rather than overflow.
   */
  viewWidth?: number | null;
  /** The tier's week clock for the drops' labels (R-S3-9); unknown when absent. */
  clock?: WeekClock;
}

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-text-muted';

const UNKNOWN_CLOCK: WeekClock = { currentWeek: null, weekStartDate: null };

export function FarmExpansion({
  row,
  finished,
  canManage,
  userRole,
  currentUserId,
  groupId,
  onClose,
  id,
  spanAll,
  viewWidth = null,
  clock = UNKNOWN_CLOCK,
}: FarmExpansionProps) {
  const panelRef = useRef<HTMLTableRowElement>(null);
  // Takes focus from "I got it" when a log hides it.
  const copyRef = useRef<HTMLButtonElement>(null);
  const focusCopyPlan = useCallback(() => copyRef.current?.focus(), []);
  const viewer = userRole === 'viewer';
  const lead = canManage && !viewer;
  const { drops, status: dropsStatus, retry: retryDrops } = useGoalDrops(groupId, row.goal.id);
  const { busy: statusBusy, markFinished } = useGoalStatus(groupId, row.goal);
  const edit = useFarmEdit();
  const editing = lead && !finished && edit.editingId === row.goal.id;

  // D-14, as V1's history: a lead any drop, a member the ones they logged; a viewer none (the API refuses them).
  const canDeleteDrop = (drop: RewardDrop) => !viewer && (lead || drop.createdById === currentUserId);

  const own = row.cells.find((cell) => cell.own) ?? null;
  const ownUserId = own?.column.userId ?? null;
  const gotItShown =
    !finished &&
    !lead &&
    !viewer &&
    ownUserId !== null &&
    own?.state !== 'have' &&
    dropsStatus !== 'loading' &&
    !drops.some((drop) => drop.recipientUserId === currentUserId);

  // R-S3-2: the paste follows the queue, and a viewer's has no counts, so no "Can buy now" (R-S3-15).
  const copyPlan = async () => {
    const { ordered, canBuyFrom } = planEntriesFor(row, row.goal.priorityMode);
    const visible = (entries: DiscordPlanEntry[]) => (viewer ? entries.map((entry) => ({ ...entry, count: null })) : entries);
    const text = buildDiscordPlan(row.goal, visible(ordered), visible(canBuyFrom));
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Plan copied');
    } catch {
      toast.error("Couldn't copy the plan");
    }
  };

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
      <td role="gridcell" colSpan={spanAll} className="p-0 align-top">
        <div
          data-testid="progress-expansion-body"
          style={viewWidth === null ? undefined : { width: viewWidth }}
          className="max-w-full px-4 py-3"
        >
          {editing && (
            <FarmEditBlock groupId={groupId} goal={row.goal} onDone={() => edit.finish(row.goal.id)} onDirtyChange={edit.setDirty} />
          )}
          {/* The action bar: the drop action, Mark finished when everyone has it, then Copy plan. */}
          <div data-testid="progress-expansion-actions" className="mb-3 flex flex-wrap items-center gap-2">
            {!finished && lead && <LogDropButton row={row} groupId={groupId} />}
            {gotItShown && <IGotItButton groupId={groupId} goalId={row.goal.id} userId={ownUserId} onLeave={focusCopyPlan} />}
            {!finished && lead && row.tally.everyone && (
              <Button
                variant="primary"
                size="sm"
                className={BUSY_CLASS}
                leftIcon={<CircleCheck size={14} aria-hidden="true" />}
                aria-disabled={statusBusy || undefined}
                onClick={() => {
                  if (!statusBusy) edit.guard(row.goal.id, () => void markFinished());
                }}
              >
                Mark finished
              </Button>
            )}
            <Button
              ref={copyRef}
              variant="secondary"
              size="sm"
              leftIcon={<Copy size={14} aria-hidden="true" />}
              onClick={() => void copyPlan()}
            >
              Copy plan
            </Button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,21rem),1fr))] gap-4">
            <section aria-labelledby={`${id}-queue`} data-testid="progress-expansion-queue">
              <h2 id={`${id}-queue`} className={HEADING}>
                Next in line
              </h2>
              <div className="mt-2">
                <QueueList row={row} viewer={viewer} />
              </div>
            </section>
            <section aria-labelledby={`${id}-drops`} data-testid="progress-expansion-drops">
              <h2 id={`${id}-drops`} className={HEADING}>
                Last drops
              </h2>
              <div className="mt-2">
                <DropList
                  drops={drops}
                  status={dropsStatus}
                  onRetry={retryDrops}
                  clock={clock}
                  groupId={groupId}
                  goalId={row.goal.id}
                  canDelete={canDeleteDrop}
                  onLeave={focusCopyPlan}
                />
              </div>
            </section>
            <section aria-labelledby={`${id}-about`} data-testid="progress-expansion-about">
              <h2 id={`${id}-about`} className={HEADING}>
                About
              </h2>
              <div className="mt-2">
                <AboutBlock goal={row.goal} />
              </div>
            </section>
          </div>
        </div>
      </td>
    </tr>
  );
}
