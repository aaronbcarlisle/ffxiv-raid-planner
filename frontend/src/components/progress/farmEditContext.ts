/**
 * Inline Edit's state, owned by `ProgressPage` and read where it is needed (S2a-3a·G5 Task TG8;
 * D-12, R-S3-10): the row menu's Edit item starts it, the open row's panel shows the block, and
 * every way out of a dirty block (another row, closing the row, Mark finished) asks first. A
 * context keeps those three apart from the matrix's props; the default value is "nothing is
 * being edited", so a row rendered on its own (a test) behaves as before.
 */
import { createContext, useContext } from 'react';

const NOOP = () => {};

export const FarmEditContext = createContext({
  /** The goal whose Edit block is on, or null. It is on screen only while that row is the open one. */
  editingId: null as string | null,
  /** The row menu's Edit: open this row and enter the block, asking first if another row's edit is dirty. */
  start: NOOP as (goalId: string) => void,
  /** The block ended (saved or discarded); focus returns to the row's menu button. */
  finish: NOOP as (goalId: string) => void,
  /** The block reports whether it holds unsaved changes. */
  setDirty: NOOP as (dirty: boolean) => void,
  /**
   * Runs `proceed`, after "Discard changes?" when this goal's block is dirty and `proceed` would drop
   * it. `opener` is the control Keep editing gives focus back to when the focused one is about to go
   * (a menu item): by default the focused element.
   */
  guard: ((_goalId: string, proceed: () => void) => proceed()) as (
    goalId: string,
    proceed: () => void,
    opener?: HTMLElement | null,
  ) => void,
});

export const useFarmEdit = () => useContext(FarmEditContext);
