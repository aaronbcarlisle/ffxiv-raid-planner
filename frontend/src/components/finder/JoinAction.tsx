/**
 * JoinAction — the Static Finder card's join affordance (R-SF-I).
 *
 * Reads `myRequests` from `useJoinRequestStore` itself and matches by
 * `item.id` (present for every signed-in `fitV2` response, R-SF-A) — never
 * by name, since two statics can share a name (mutation (a)).
 *
 * There is one `JoinRequestModal` per page, not per card: this component
 * only asks its parent to open it, via `onRequestJoin`.
 */
import { useState } from 'react';
import { Send, LogIn } from 'lucide-react';
import { Button } from '../primitives';
import { Tag } from '../ui/Tag';
import { useAuthStore } from '../../stores/authStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { toast } from '../../stores/toastStore';
import type { FinderItem } from './types';

interface JoinActionProps {
  item: FinderItem;
  onRequestJoin: (item: FinderItem) => void;
}

export function JoinAction({ item, onRequestJoin }: JoinActionProps) {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const myRequests = useJoinRequestStore((s) => s.myRequests);
  const cancelRequest = useJoinRequestStore((s) => s.cancelRequest);
  const [cancelling, setCancelling] = useState(false);

  if (!user) {
    return (
      <Button variant="ghost" size="sm" leftIcon={<LogIn className="w-3.5 h-3.5" />} onClick={() => login()}>
        Log in to join
      </Button>
    );
  }

  const existing = myRequests
    .filter((r) => r.staticGroupId === item.id)
    .reduce<typeof myRequests[number] | undefined>(
      (newest, r) => (!newest || r.createdAt > newest.createdAt ? r : newest),
      undefined,
    );

  const handleCancel = async () => {
    if (!existing) return;
    setCancelling(true);
    try {
      await cancelRequest(existing.id);
    } catch {
      toast.error("Couldn't cancel the request");
    } finally {
      setCancelling(false);
    }
  };

  if (existing?.status === 'pending' || existing?.status === 'under_review') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-status-warning font-medium">Request pending</span>
        <Button variant="ghost" size="sm" onClick={handleCancel} loading={cancelling}>
          Cancel request
        </Button>
      </div>
    );
  }

  if (existing?.status === 'accepted') {
    return <Tag variant="label" tone="success">Accepted</Tag>;
  }

  if (existing?.status === 'declined') {
    return <Tag variant="label" tone="error">Declined</Tag>;
  }

  return (
    <Button variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />} onClick={() => onRequestJoin(item)}>
      Request to join
    </Button>
  );
}
