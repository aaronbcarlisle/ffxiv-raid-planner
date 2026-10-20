/**
 * TierExpansion — the tier row's panel (S2a-3b·H4 Task TH5; design §3.5, D-3, D-10, E-11, R-T-8).
 * One `<tr role="row">` right after the tier row, whose single `gridcell` spans the matrix
 * (`spanAll`) and lays out at the scroller's width (`viewWidth`), as a farm's panel does. It is
 * NOT one of the roving grid's rows, so the arrows skip it and Tab enters it from the open row.
 *
 * It shows the split plan by the page's settled split-clear result for this static, never the
 * store's `data` or `error` (a refresh blanks the one, and every write sets the other):
 *   - failed: "Couldn't load the split plan" and Retry, which refetches;
 *   - on: the existing `SplitClearPlanner` (D-3, unchanged), read-only unless `canEdit`;
 *   - off, which only a lead can open: Turn on split clears, the store's settings PUT. The
 *     planner mounts only while on, so its own "Enable split planning" card never shows here.
 * Once the planner has mounted, a failed refetch puts the error above it and leaves it mounted in
 * place (it renders nothing while the store has no data), so Retry brings the draft back. A first
 * load that fails shows the error alone.
 *
 * The matrix mounts it on the first open and keeps it mounted, `hidden` while the tier row is
 * closed, so the planner's draft (its component state) survives a collapse or a farm opened in
 * between (D-10). Escape inside it closes it, through the farm panel's filter (`escapeClosesPanel`).
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../primitives/Button';
import { SplitClearPlanner } from '../split-clear/SplitClearPlanner';
import { useSplitClearStore } from '../../stores/splitClearStore';
import type { SnapshotPlayer } from '../../types';
import { escapeClosesPanel } from './panelEscape';

/** `?track=tier`: the tier row is the open row (R-T-6). Never a goal id. */
export const TIER_TRACK = 'tier';

/** The panel's DOM id, which the tier name button's `aria-controls` names. */
export const TIER_PANEL_ID = 'progress-tier-expansion';

/** What the page hands the matrix when the tier row can open (R-T-6); absent when it can't. */
export interface TierPanelModel {
  groupId: string;
  /** This static's settled split-clear result (R-T-7): a failed fetch, else on or off. */
  state: 'failed' | 'on' | 'off';
  /** The planner's players: the columns' configured, non-substitute cards, in column order. */
  players: SnapshotPlayer[];
  /** The planner's editor controls (`canManage`, as V1 passes it). */
  canEdit: boolean;
  onRetry: () => void;
  onTurnOn: () => void;
}

interface TierExpansionProps {
  panel: TierPanelModel;
  /** The tier row is closed (nothing open, or a farm): the panel stays mounted, hidden (D-10). */
  hidden: boolean;
  /** Every column of the matrix, for the one cell that spans them. */
  spanAll: number;
  /** The matrix scroller's visible width, or null while unmeasured (as `FarmExpansion`). */
  viewWidth: number | null;
  /** The panel asks to close (Escape); the caller closes it and returns focus to the name button. */
  onClose: () => void;
}

export function TierExpansion({ panel, hidden, spanAll, viewWidth, onClose }: TierExpansionProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const isSaving = useSplitClearStore((s) => s.isSaving);
  const isLoading = useSplitClearStore((s) => s.isLoading);
  // The planner stays mounted through a failed refetch (its draft is its own state), and goes with
  // the off-state, which only a refetch that finds split clears off brings back.
  const [plannerMounted, setPlannerMounted] = useState(false);
  const showPlanner = panel.state === 'on' || (panel.state === 'failed' && plannerMounted);
  if (showPlanner !== plannerMounted) setPlannerMounted(showPlanner);

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!escapeClosesPanel(event, rowRef.current)) return;
    event.preventDefault();
    onClose();
  };

  return (
    <tr
      ref={rowRef}
      id={TIER_PANEL_ID}
      role="row"
      data-testid="progress-tier-expansion"
      hidden={hidden}
      className="border-t border-border-subtle bg-surface-elevated"
      onKeyDown={onKeyDown}
    >
      <td role="gridcell" colSpan={spanAll} className="p-0 align-top">
        <div
          data-testid="progress-tier-expansion-body"
          style={viewWidth === null ? undefined : { width: viewWidth }}
          className="max-w-full space-y-3 px-4 py-3"
        >
          {/* Three fixed slots, so the planner keeps its place (and its state) under the error. */}
          {panel.state === 'failed' && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-text-primary"
            >
              <span>Couldn&apos;t load the split plan</span>
              <Button variant="secondary" size="sm" loading={isLoading} onClick={panel.onRetry}>
                Retry
              </Button>
            </div>
          )}
          {panel.state === 'off' && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-text-secondary">Split clears are off. Plan a main and alt run for each card.</p>
              <Button variant="primary" size="sm" disabled={isSaving} onClick={panel.onTurnOn}>
                Turn on split clears
              </Button>
            </div>
          )}
          {showPlanner && <SplitClearPlanner groupId={panel.groupId} players={panel.players} canEdit={panel.canEdit} />}
        </div>
      </td>
    </tr>
  );
}
