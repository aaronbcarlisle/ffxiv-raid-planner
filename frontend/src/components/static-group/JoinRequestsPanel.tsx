import { useEffect, useState } from 'react';
import { Check, Clock, Copy, Inbox, UserPlus, X } from 'lucide-react';
import { Button } from '../primitives/Button';
import { Toggle } from '../ui/Toggle';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { toast } from '../../stores/toastStore';
import type { JoinRequest } from '../../types';

interface JoinRequestsPanelProps {
  groupId: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-status-warning',
  accepted: 'text-status-success',
  declined: 'text-status-error',
  cancelled: 'text-text-muted',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function RequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: JoinRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const isPending = request.status === 'pending';
  const requester = request.requester;
  const [copied, setCopied] = useState(false);

  const handleCopyDiscord = async () => {
    if (!request.contactDiscord) return;
    await navigator.clipboard.writeText(request.contactDiscord);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {requester?.avatarUrl && (
            <img
              src={requester.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {requester?.displayName || 'Unknown User'}
            </p>
            {request.contactDiscord && (
              /* design-system-ignore: compact inline copy button for Discord handle */
              <button
                type="button"
                onClick={handleCopyDiscord}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors group"
                title={copied ? 'Copied!' : `Copy Discord: ${request.contactDiscord}`}
              >
                <span className="truncate">{request.contactDiscord}</span>
                {copied
                  ? <Check className="w-3 h-3 text-status-success shrink-0" />
                  : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
              </button>
            )}
            <p className="text-xs text-text-muted">{formatDate(request.createdAt)}</p>
          </div>
        </div>
        <span className={`text-xs font-medium ${STATUS_STYLES[request.status] || 'text-text-muted'}`}>
          {STATUS_LABELS[request.status] || request.status}
        </span>
      </div>

      {(request.roleInterest?.length || request.jobInterest?.length) ? (
        <div className="flex gap-1.5 flex-wrap">
          {request.roleInterest?.map((role) => (
            <span key={role} className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent border border-accent/20 capitalize">
              {role}
            </span>
          ))}
          {request.jobInterest?.map((job) => (
            <span key={job} className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-full bg-surface-interactive text-text-secondary border border-border-default font-mono">
              {job.toUpperCase()}
            </span>
          ))}
        </div>
      ) : null}

      {request.message && (
        <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
          {request.message}
        </p>
      )}

      {request.availabilityNote && (
        <div className="flex items-start gap-2 text-xs text-text-muted">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{request.availabilityNote}</span>
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 pt-1">
          <Button
            variant="success"
            size="sm"
            leftIcon={<Check className="w-3.5 h-3.5" />}
            onClick={() => onAccept(request.id)}
          >
            Accept
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<X className="w-3.5 h-3.5" />}
            onClick={() => onDecline(request.id)}
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

export function JoinRequestsPanel({ groupId }: JoinRequestsPanelProps) {
  const { groupRequests, pendingCount, isLoading, fetchGroupRequests, acceptRequest, declineRequest } =
    useJoinRequestStore();
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    fetchGroupRequests(groupId, showResolved);
  }, [groupId, showResolved, fetchGroupRequests]);

  const handleAccept = async (requestId: string) => {
    try {
      await acceptRequest(requestId);
      toast.success('Request accepted — member added to static.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept request');
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await declineRequest(requestId);
      toast.success('Request declined.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decline request');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Join Requests</h3>
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-accent text-accent-contrast">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Show resolved</span>
          <Toggle checked={showResolved} onChange={setShowResolved} size="sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-text-muted">Loading...</div>
      ) : groupRequests.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <Inbox className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-sm text-text-muted">No join requests yet.</p>
          <p className="text-xs text-text-muted">
            Players who find your static can send a request to join.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))}
        </div>
      )}
    </div>
  );
}
