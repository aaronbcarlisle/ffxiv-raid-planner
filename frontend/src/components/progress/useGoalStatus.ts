/**
 * Mark finished and Reopen (S2a-3a·G4 Task TG7; D-9, D-10, D-22, R-S3-8), the status writes the row
 * menu and the open panel's action bar share.
 *
 * Mark finished sends `{ status: 'complete' }`, toasts "Marked finished" with Undo, and refreshes
 * with `lists` (the farm moved from the active rows to Finished). Its Undo is `{ status: <the
 * status the goal held> }`, read from the click's render before the write. Reopen sends
 * `{ status: 'farming' }` and toasts "Reopened". The lock is taken in the click and held through
 * the write and the refresh (no double write); a failure is toasted once, unless `api.ts` already
 * did (a true 403). The Undo is a `withUndo` toast, so it outlives the row, the panel and a
 * static switch (the store's `updateGoal` maps the goals by id; `refreshGoalProgress` guards its
 * lists on the loaded static).
 *
 * Focus (`farmFocus`): the row remounts in the other section, so the write expects focus for its
 * goal and the new row (or, for Mark finished while Finished is collapsed or loading, its
 * disclosure) takes it; a failed write cancels it. A successful Undo puts focus on the restored
 * row's name only when it was lost to <body>.
 */
import { useRef, useState } from 'react';
import { wasToastedByApi } from '../../services/api';
import { useCollectionGoalStore, type CollectionGoal } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import { cancelFarmFocus, expectFarmFocus, FINISHED_TOGGLE_ID, settleFarmFocus } from './farmFocus';
import { messageOf } from './undoToasts';

interface GoalStatusActions {
  /** A write is in flight: controls that start one are unavailable (`aria-disabled`, clicks ignored). */
  busy: boolean;
  markFinished: () => Promise<void>;
  reopen: () => Promise<void>;
}

export function useGoalStatus(groupId: string, goal: Pick<CollectionGoal, 'id' | 'status'>): GoalStatusActions {
  const [busy, setBusy] = useState(false);
  // The state alone would let a second click in before the re-render that disables the control.
  const lock = useRef(false);
  const { id: goalId, status } = goal;

  const write = async (next: CollectionGoal['status'], failure: string, onDone: () => void) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    expectFarmFocus(goalId, next === 'complete' ? 'finished' : 'active');
    try {
      const store = useCollectionGoalStore.getState();
      try {
        await store.updateGoal(groupId, goalId, { status: next });
      } catch (err) {
        cancelFarmFocus(goalId);
        if (!wasToastedByApi(err)) toast.error(`${failure}: ${messageOf(err)}`);
        return;
      }
      onDone();
      await store.refreshGoalProgress(groupId, goalId, { lists: true });
    } finally {
      settleFarmFocus(goalId, next === 'complete' ? FINISHED_TOGGLE_ID : undefined);
      lock.current = false;
      setBusy(false);
    }
  };

  const undo = (prior: CollectionGoal['status']) => async () => {
    const store = useCollectionGoalStore.getState();
    // The restored row takes the focus only if the toast's own click left it on <body>.
    expectFarmFocus(goalId, 'active', true);
    try {
      try {
        await store.updateGoal(groupId, goalId, { status: prior });
      } catch (err) {
        if (!wasToastedByApi(err)) toast.error(`Couldn't undo: ${messageOf(err)}`);
        return;
      }
      toast.success('Undone');
      await store.refreshGoalProgress(groupId, goalId, { lists: true });
    } finally {
      settleFarmFocus(goalId);
    }
  };

  return {
    busy,
    markFinished: () =>
      write('complete', "Couldn't mark it finished", () => toast.withUndo('Marked finished', () => void undo(status)())),
    reopen: () => write('farming', "Couldn't reopen it", () => toast.success('Reopened')),
  };
}
