/**
 * FarmExpansion — the open farm row's panel (S2a-3a·G2 Task TG3; design §3.4, R-S3-4). One
 * `<tr role="row">` right after its farm row, whose single `gridcell` spans the whole matrix
 * (`spanAll`). It is NOT one of the roving grid's rows (`rowIds`), so the arrow keys skip it,
 * and Tab moves from the open row's cell into the panel's controls in DOM order. The action
 * bar comes first (TG5's Log a drop / I got it and TG7's Mark finished join Copy plan, which
 * every role has, a finished row included), then the three columns, Next in line · Last drops
 * (TG5) · About (D-4). The props TG5 reads (`finished`, `canManage`, `currentUserId`,
 * `groupId`) are declared here and unused until then.
 *
 * Escape inside the panel closes it (TG8's Edit excepted), through `escapeClosesPanel`'s
 * filter (R-S3-4, vet I-2): never a key a layer handled already, never one from a portalled
 * node outside this row. Closing returns focus to the name button: the caller's `onClose`.
 */
import { useRef, type KeyboardEvent } from 'react';
import { Copy } from 'lucide-react';
import { toast } from '../../stores/toastStore';
import type { MemberRole } from '../../types';
import { buildDiscordPlan, planEntriesFor, type DiscordPlanEntry } from '../../utils/discordPlan';
import type { FarmRow as FarmRowModel } from '../../utils/progressModel';
import { Button } from '../primitives';
import { AboutBlock } from './AboutBlock';
import { escapeClosesPanel } from './panelEscape';
import { QueueList } from './QueueList';

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
}

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-text-muted';

export function FarmExpansion({ row, userRole, onClose, id, spanAll, viewWidth = null }: FarmExpansionProps) {
  const panelRef = useRef<HTMLTableRowElement>(null);
  const viewer = userRole === 'viewer';

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
          {/* The action bar: TG5's Log a drop / I got it and TG7's Mark finished go before Copy plan. */}
          <div data-testid="progress-expansion-actions" className="mb-3 flex flex-wrap items-center gap-2">
            <Button
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
