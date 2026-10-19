/**
 * The open farm row's drops (S2a-3a·G3 Task TG5; R-S3-5, R-S3-8, R-S3-16, D-16, D-21).
 *
 * `useGoalDrops` loads the goal's drops once per open (and on Retry) through `loadDrops`, which
 * reports a failure, and reads them from the store, so a log's prepended drop and an Undo's
 * removal show at once. Its `status` is THIS mount's load: `loading` until it settles, even
 * over a cached list, so "I got it" never flashes before the drops say whether it should show.
 *
 * `useDropLogger` is the one write path for Log a drop and I got it: a lock taken in the click
 * and held through the log AND the read-model refresh (no double drop, R-S3-6, R-S3-16), the
 * toast with Undo (`withUndo`, so it outlives the panel), and the Undo itself: `deleteDrop` on
 * the returned id, then the refresh (R-S3-8). A failed log or Undo is toasted once, unless
 * `api.ts` already did (a true 403).
 */
import { useEffect, useRef, useState } from 'react';
import { wasToastedByApi } from '../../services/api';
import { useCollectionGoalStore, type RewardDrop, type RewardDropCreate } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import { messageOf } from './undoToasts';

export type DropsStatus = 'loading' | 'loaded' | 'failed';

const NO_DROPS: readonly RewardDrop[] = [];

export function useGoalDrops(groupId: string, goalId: string): { drops: readonly RewardDrop[]; status: DropsStatus; retry: () => void } {
  const drops = useCollectionGoalStore((s) => s.drops[goalId]) ?? NO_DROPS;
  const [attempt, setAttempt] = useState(0);
  const key = `${groupId}/${goalId}/${attempt}`;
  // The load that settled last, by its key: a status for any other key is still loading.
  const [settled, setSettled] = useState<{ key: string; failed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void useCollectionGoalStore
      .getState()
      .loadDrops(groupId, goalId)
      .then(({ error }) => {
        if (!cancelled) setSettled({ key, failed: error !== null });
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, goalId, key]);

  const status: DropsStatus = settled?.key !== key ? 'loading' : settled.failed ? 'failed' : 'loaded';
  return { drops, status, retry: () => setAttempt((n) => n + 1) };
}

async function undoDrop(groupId: string, goalId: string, dropId: string): Promise<void> {
  const store = useCollectionGoalStore.getState();
  try {
    await store.deleteDrop(groupId, goalId, dropId);
  } catch (err) {
    if (!wasToastedByApi(err)) toast.error("Couldn't undo the drop");
    return;
  }
  toast.success('Undone');
  await store.refreshGoalProgress(groupId, goalId);
}

export function useDropLogger(groupId: string, goalId: string): {
  busy: boolean;
  log: (data: RewardDropCreate, message: string) => Promise<boolean>;
} {
  const [busy, setBusy] = useState(false);
  // The state alone would let a second click in before the re-render that disables the button.
  const lock = useRef(false);

  const log = async (data: RewardDropCreate, message: string) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      const store = useCollectionGoalStore.getState();
      let drop: RewardDrop;
      try {
        drop = await store.logDrop(groupId, goalId, data);
      } catch (err) {
        if (!wasToastedByApi(err)) toast.error(`Couldn't log the drop: ${messageOf(err)}`);
        return false;
      }
      toast.withUndo(message, () => void undoDrop(groupId, goalId, drop.id));
      await store.refreshGoalProgress(groupId, goalId);
      return true;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return { busy, log };
}
