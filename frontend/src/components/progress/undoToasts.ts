/**
 * undoWithToasts — runs an Undo and tells how it went (R-S2-11), for the cell picker's
 * single token and the bulk Need's list of them (S2a-2·F5, F6): "Undone", or a warning
 * when any cell was skipped because it changed since; a failure is toasted once, unless
 * `api.ts` already did (a true 403). `messageOf` is the failure text every Progress toast
 * uses.
 */
import { wasToastedByApi } from '../../services/api';
import { toast } from '../../stores/toastStore';

/** A failure's text for a toast: the error's message, or a plain fallback. */
export const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'something went wrong');

export async function undoWithToasts(run: () => Promise<{ skipped: number }>): Promise<void> {
  try {
    const { skipped } = await run();
    if (skipped > 0) toast.warning('Couldn\'t undo: it changed since');
    else toast.success('Undone');
  } catch (err) {
    if (!wasToastedByApi(err)) toast.error(`Couldn't undo: ${messageOf(err)}`);
  }
}
