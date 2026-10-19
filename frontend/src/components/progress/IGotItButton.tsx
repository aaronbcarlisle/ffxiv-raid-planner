/**
 * IGotItButton — a member's own drop (S2a-3a·G3 Task TG5; D-5, D-16, D-21, R-S3-7). One click,
 * no note: it logs the drop for the reader's own column (`userId`, never the caller's id, so
 * under View As it logs for the viewed user) and toasts "Logged as yours" with Undo. It is
 * disabled from the click until the log and the read-model refresh are done. Who sees it (a
 * non-lead member's own cell, not Have, no drop of theirs on the farm yet) is the panel's call.
 */
import { Check } from 'lucide-react';
import { Button } from '../primitives';
import { useDropLogger } from './useDrops';

interface IGotItButtonProps {
  groupId: string;
  goalId: string;
  /** The reader's own column's member. */
  userId: string;
}

export function IGotItButton({ groupId, goalId, userId }: IGotItButtonProps) {
  const { busy, log } = useDropLogger(groupId, goalId);
  return (
    <Button
      variant="accent-subtle"
      size="sm"
      leftIcon={<Check size={14} aria-hidden="true" />}
      disabled={busy}
      onClick={() => void log({ recipientUserId: userId, notes: null }, 'Logged as yours')}
    >
      I got it
    </Button>
  );
}
