import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

export function JoinRequestBanner({ shareCode, staticName, groupId, settings, userRole }: JoinRequestBannerProps) {
  const { t } = useTranslation();
  const { user, login } = useAuthStore();
  const { myRequests, fetchMyRequests, cancelRequest } = useJoinRequestStore();
  const modal = useModal();
  const [isCancelling, setIsCancelling] = useState(false);
  const statusConfig = {
    pending: { icon: Clock, label: t('joinRequest.banner.requestPending'), color: 'text-status-warning' },
    under_review: { icon: Eye, label: t('joinRequest.banner.underReview'), color: 'text-status-info' },
    accepted: { icon: Check, label: t('joinRequest.banner.requestAccepted'), color: 'text-status-success' },
    declined: { icon: XIcon, label: t('joinRequest.banner.requestDeclined'), color: 'text-status-error' },
    cancelled: { icon: XIcon, label: t('joinRequest.banner.requestCancelled'), color: 'text-text-muted' },
  } as const;

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
          {t('joinRequest.banner.loginPrompt')}
        </p>
        <Button size="sm" leftIcon={<LogIn className="w-4 h-4" />} onClick={() => login()}>
          {t('joinRequest.banner.logIn')}
        </Button>
      </div>
    );
  }

  if (activeRequest) {
    const config = statusConfig[activeRequest.status as keyof typeof statusConfig];
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
            {t('joinRequest.banner.cancelRequest')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 rounded-lg border border-accent/20 bg-accent/5 p-3 flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {t('joinRequest.banner.cta')}
        </p>
        <Button
          size="sm"
          leftIcon={<Send className="w-4 h-4" />}
          onClick={modal.open}
        >
          {t('discover.requestToJoin')}
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
