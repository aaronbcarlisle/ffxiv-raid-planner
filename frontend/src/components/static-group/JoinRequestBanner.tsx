import { useEffect, useState } from 'react';
import { Check, Clock, Eye, LogIn, Send, X as XIcon } from 'lucide-react';
import { Button } from '../primitives/Button';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useAuthStore } from '../../stores/authStore';
import { JoinRequestModal } from './JoinRequestModal';
import { useModal } from '../../hooks/useModal';
import type { JoinRequest, StaticGroupSettings } from '../../types';

interface JoinRequestBannerProps {
  shareCode: string;
  staticName: string;
  groupId: string;
  settings?: StaticGroupSettings;
  userRole?: string | null;
}

function isDiscoverable(settings?: StaticGroupSettings): boolean {
  return settings?.discovery?.enabled === true;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, label: 'Request pending', color: 'text-status-warning' },
  under_review: { icon: Eye, label: 'Under review', color: 'text-status-info' },
  accepted: { icon: Check, label: 'Request accepted', color: 'text-status-success' },
  declined: { icon: XIcon, label: 'Request declined', color: 'text-status-error' },
  cancelled: { icon: XIcon, label: 'Request cancelled', color: 'text-text-muted' },
} as const;

export function JoinRequestBanner({ shareCode, staticName, groupId, settings, userRole }: JoinRequestBannerProps) {
  const { user, login } = useAuthStore();
  const { myRequests, fetchMyRequests, cancelRequest } = useJoinRequestStore();
  const modal = useModal();
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyRequests();
    }
  }, [user, fetchMyRequests]);

  if (userRole) return null;
  if (!isDiscoverable(settings)) return null;

  const existingRequest: JoinRequest | undefined = myRequests.find(
    (r) => r.staticGroupId === groupId
  );

  const activeRequest = existingRequest?.status === 'pending' || existingRequest?.status === 'under_review' || existingRequest?.status === 'accepted'
    ? existingRequest
    : existingRequest?.status === 'declined'
      ? existingRequest
      : undefined;

  const handleCancel = async () => {
    if (!existingRequest || existingRequest.status !== 'pending') return;
    setIsCancelling(true);
    try {
      await cancelRequest(existingRequest.id);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="mb-3 rounded-lg border border-accent/20 bg-accent/5 p-3 flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Interested in joining this static? Log in to send a request.
        </p>
        <Button size="sm" leftIcon={<LogIn className="w-4 h-4" />} onClick={() => login()}>
          Log In
        </Button>
      </div>
    );
  }

  if (activeRequest) {
    const config = STATUS_CONFIG[activeRequest.status as keyof typeof STATUS_CONFIG];
    const Icon = config?.icon || Clock;
    return (
      <div className="mb-3 rounded-lg border border-border-default bg-surface-elevated p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config?.color || 'text-text-muted'}`} />
          <span className={`text-sm font-medium ${config?.color || 'text-text-muted'}`}>
            {config?.label || activeRequest.status}
          </span>
        </div>
        {activeRequest.status === 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            loading={isCancelling}
          >
            Cancel Request
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 rounded-lg border border-accent/20 bg-accent/5 p-3 flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Looking for a static? Send a request to join.
        </p>
        <Button
          size="sm"
          leftIcon={<Send className="w-4 h-4" />}
          onClick={modal.open}
        >
          Request to Join
        </Button>
      </div>

      <JoinRequestModal
        isOpen={modal.isOpen}
        onClose={modal.close}
        shareCode={shareCode}
        staticName={staticName}
        neededJobs={settings?.discovery?.neededJobs}
        neededRoles={settings?.discovery?.neededRoles}
        recruitmentStatus={settings?.discovery?.recruitmentStatus}
      />
    </>
  );
}
