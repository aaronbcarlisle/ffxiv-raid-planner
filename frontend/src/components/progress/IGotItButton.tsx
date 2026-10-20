/**
 * IGotItButton — a member's own drop (S2a-3a·G3 Task TG5; D-5, D-16, D-21, R-S3-7). One click,
 * no note: it logs the drop for the reader's own column (`userId`, never the caller's id, so
 * under View As it logs for the viewed user) and toasts "Logged as yours" with Undo. From the
 * click until the log and the read-model refresh are done it is unavailable but keeps focus
 * (`aria-disabled`, clicks ignored). Who sees it (a non-lead member's own cell, not Have, no drop
 * of theirs on the farm yet) is the panel's call; when a log hides it while it holds focus,
 * `onLeave` moves focus on (to the panel's Copy plan), never leaving it on <body>.
 */
import { useLayoutEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../primitives';
import { BUSY_CLASS, useDropLogger } from './useDrops';

interface IGotItButtonProps {
  groupId: string;
  goalId: string;
  /** The reader's own column's member. */
  userId: string;
  /** Moves focus on when this button unmounts while it holds it. Keep it stable (`useCallback`). */
  onLeave: () => void;
}

export function IGotItButton({ groupId, goalId, userId, onLeave }: IGotItButtonProps) {
  const { busy, log } = useDropLogger(groupId, goalId);
  const ref = useRef<HTMLButtonElement>(null);

  // A layout cleanup runs before React removes the button, so it can still see the focus.
  useLayoutEffect(() => {
    const button = ref.current;
    return () => {
      if (button !== null && document.activeElement === button) onLeave();
    };
  }, [onLeave]);

  return (
    <Button
      ref={ref}
      variant="accent-subtle"
      size="sm"
      className={BUSY_CLASS}
      leftIcon={<Check size={14} aria-hidden="true" />}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) void log({ recipientUserId: userId, notes: null }, 'Logged as yours');
      }}
    >
      I got it
    </Button>
  );
}
