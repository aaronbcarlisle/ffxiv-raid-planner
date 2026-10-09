/**
 * editStatuses — who may write which Progress cell, and which cells the bulk Need sends
 * (S2a-2·F6 Task TF8; R-S2-10, R-S2-12). Pure: the page passes the reader and the mode in,
 * and `ProgressCell` reads the answer per cell, so one place decides.
 */
import type { MarkNeedCell } from '../../stores/collectionGoalStore';
import type { MemberRole } from '../../types';
import type { FarmRow, ProgressCell } from '../../utils/progressModel';
import type { CellWriteTarget } from './CellPicker';

export interface EditContext {
  groupId: string;
  /** The effective user and role (View As aware, as NewShell passes them). */
  currentUserId: string | null;
  userRole: MemberRole | null | undefined;
  /** NewShell's `canManage` (owner, lead or admin access, R-S2-4): without it the mode grants nothing. */
  canManage: boolean;
  isViewingAs: boolean;
  /** Edit statuses is on: a lead corrects any claimed cell (R-S2-10). */
  editing: boolean;
}

/** Where a cell writes, or undefined for one this reader may not write; the matrix passes it down to each cell. */
export type CellWriteResolver = (cell: ProgressCell) => CellWriteTarget | undefined;

/**
 * Where a cell on an ACTIVE row writes, or undefined when this reader may not write it.
 * Finished rows never ask: the matrix passes them no resolver.
 * - A member (any role but viewer) writes their own cell wherever it appears, Not on the
 *   roster included: the self route, or under View As the lead route aimed at the viewed
 *   user, so the admin's own row is never written by mistake.
 * - In Edit statuses, a reader who may manage writes every claimed column's cell through
 *   the lead route aimed at that member (a correction). Others' Not-on-the-roster cells
 *   and unclaimed cells stay read-only ("every claimed cell", S2-7).
 */
export function cellWriteTarget(cell: ProgressCell, ctx: EditContext): CellWriteTarget | undefined {
  if (ctx.userRole == null || ctx.userRole === 'viewer' || ctx.currentUserId === null) return undefined;
  if (cell.own) return ctx.isViewingAs ? { groupId: ctx.groupId, targetUserId: ctx.currentUserId } : { groupId: ctx.groupId };
  if (ctx.editing && ctx.canManage && cell.column.kind === 'claimed') return { groupId: ctx.groupId, targetUserId: cell.column.userId };
  return undefined;
}

/**
 * The cells the bulk Need sends (R-S2-12, Q2): every blank cell of a claimed column on the
 * given rows (the page passes the ACTIVE rows), in row then column order, as shown. A
 * record-only Have has a state, so it is never blank (Q1); unclaimed and Not-on-the-roster
 * columns are never sent.
 */
export function blankClaimedCells(rows: readonly FarmRow[]): MarkNeedCell[] {
  const cells: MarkNeedCell[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.column.kind === 'claimed' && cell.state === null) cells.push({ goalId: row.goal.id, userId: cell.column.userId });
    }
  }
  return cells;
}
