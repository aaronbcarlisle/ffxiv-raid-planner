/**
 * ApplicantRow — one Applicants-tab row (RH1c, spec §4; R-RH-S dossier
 * parity). Identity, live fit (R-RH-C, third-person reason rows), the
 * applicant's own words, and the status-gated action set; "Full details"
 * opens the existing `JoinRequestReviewModal` so nothing the V1 dossier
 * shows is lost (accept-with-confirm, gear snapshot, readiness, alt jobs,
 * goal-alignment snapshot, exact availability windows all stay there).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock, Copy } from 'lucide-react';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { LinkText } from '../ui/LinkText';
import { SafeAvatar } from '../ui/SafeAvatar';
import { Tag, type Tone } from '../ui/Tag';
import { useDoubleClickConfirm } from '../../hooks/useDoubleClickConfirm';
import { toast } from '../../stores/toastStore';
import { relativeTime } from '../../utils/staticActivity';
import { ReasonRows } from '../finder/ReasonRows';
import { TIER_CONFIG } from '../finder/tierConfig';
import { ROLE_CHIP_LABELS, type RoleKey } from '../finder/types';
import { JoinRequestReviewModal } from '../static-group/JoinRequestReviewModal';
import type { AvailabilitySnapshotSummary, DiscoverySettings, JoinRequest } from '../../types';

const RESOLVED_STATUS_TAG: Record<string, { label: string; tone: Tone }> = {
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

const MISSING_HINTS: Record<string, string> = {
  template: 'No typical week yet',
  jobs: 'No jobs on their Hub',
};

function roleLabel(role?: string): string | null {
  if (!role) return null;
  return ROLE_CHIP_LABELS[role as RoleKey] ?? role;
}

function availabilitySummaryText(summary?: AvailabilitySnapshotSummary): string | null {
  if (!summary) return null;
  const days = (summary.dayLabels?.length ?? 0) > 0
    ? summary.dayLabels!.join(' / ')
    : `${summary.configuredDays} Player Hub availability day${summary.configuredDays !== 1 ? 's' : ''}`;
  const tz = summary.timezone ? `, ${summary.timezone}` : '';
  const exact = summary.detailLevel === 'exact' ? ' (exact)' : '';
  return `${days}${tz}${exact}`;
}

export interface ApplicantRowProps {
  request: JoinRequest;
  staticName: string;
  groupId: string;
  discoverySettings?: DiscoverySettings;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onUnderReview: (id: string) => Promise<void>;
  onLinkRoster?: (request: JoinRequest) => void;
}

export function ApplicantRow({
  request,
  staticName,
  groupId,
  discoverySettings,
  onAccept,
  onDecline,
  onUnderReview,
  onLinkRoster,
}: ApplicantRowProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Mirrors the review modal's isProcessing guard (M3): without it, a
  // double-click on Accept or Under review fires the handler twice, and the
  // second call gets a 400 plus a spurious error toast and refetch.
  const [isProcessing, setIsProcessing] = useState(false);
  const decline = useDoubleClickConfirm({ onConfirm: () => onDecline(request.id), timeout: 3000 });
  const busy = isProcessing || decline.isLoading;

  const runAction = async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await action();
    } finally {
      setIsProcessing(false);
    }
  };

  const requester = request.requester;
  const avatar = request.characterAvatarUrlAtApply ?? requester?.avatarUrl;
  const name = request.characterNameAtApply ?? requester?.displayName ?? 'Unknown';
  const job = request.selectedJob ?? request.jobInterest?.[0];
  const role = request.selectedRole ?? request.roleInterest?.[0];
  const canViewProfile =
    (request.profileVisibilityAtApply === 'shareable' || request.profileVisibilityAtApply === 'discoverable') &&
    !!request.profileShareCodeAtApply;

  const fit = request.fit;
  const tier = fit ? TIER_CONFIG[fit.tier] : null;
  const resolvedTag = RESOLVED_STATUS_TAG[request.status];

  const availabilityText = availabilitySummaryText(request.availabilitySummary) ?? request.availabilityNote ?? null;

  const isPending = request.status === 'pending';
  const isUnderReview = request.status === 'under_review';
  const isActionable = isPending || isUnderReview;
  const isAcceptedNoRoster = request.status === 'accepted' && !request.rosterPlayerId;

  const handleCopyDiscord = async () => {
    if (!request.contactDiscord) return;
    try {
      await navigator.clipboard.writeText(request.contactDiscord);
      setCopied(true);
      toast.success('Copied Discord handle.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <SafeAvatar src={avatar} alt="" className="w-9 h-9 rounded-full shrink-0 object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{name}</p>
            <p className="text-xs text-text-tertiary truncate">
              {[job?.toUpperCase(), roleLabel(role), request.characterWorldAtApply].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-text-muted">{relativeTime(request.createdAt)}</p>
            {canViewProfile && (
              <LinkText onClick={() => navigate(`/profile/${request.profileShareCodeAtApply}`)} className="text-xs">
                View profile
              </LinkText>
            )}
          </div>
        </div>
        {resolvedTag ? (
          <Tag variant="label" tone={resolvedTag.tone} className="flex-shrink-0">{resolvedTag.label}</Tag>
        ) : tier ? (
          <Tag variant="label" tone={tier.tone} className="flex-shrink-0">{tier.label}</Tag>
        ) : null}
      </div>

      {isActionable && fit && (
        <div className="flex flex-col gap-1">
          <ReasonRows reasons={fit.reasons} nights={fit.schedule.nights} subject="they" />
          {fit.missing.filter((m) => MISSING_HINTS[m]).map((m) => (
            <p key={m} className="text-xs text-text-muted">{MISSING_HINTS[m]}</p>
          ))}
        </div>
      )}

      {request.message && (
        <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{request.message}</p>
      )}

      {availabilityText && (
        <div className="flex items-start gap-2 text-xs text-text-muted">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{availabilityText}</span>
        </div>
      )}

      {request.contactDiscord && (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="text-text-muted">Discord:</span>
          <span>{request.contactDiscord}</span>
          <IconButton
            icon={copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
            aria-label={copied ? 'Discord handle copied' : 'Copy Discord handle'}
            variant="ghost"
            size="sm"
            onClick={handleCopyDiscord}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => setReviewOpen(true)}>Full details</Button>
        <div className="flex items-center gap-2">
          {isActionable && (
            <>
              {isPending && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void runAction(() => onUnderReview(request.id))}
                >
                  Under review
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={decline.handleClick}
                onBlur={decline.handleBlur}
                disabled={busy}
              >
                {decline.isArmed ? 'Confirm decline' : 'Decline'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() => void runAction(() => onAccept(request.id))}
              >
                Accept
              </Button>
            </>
          )}
          {isAcceptedNoRoster && onLinkRoster && (
            <Button variant="secondary" size="sm" onClick={() => onLinkRoster(request)}>
              Link to roster slot
            </Button>
          )}
        </div>
      </div>

      <JoinRequestReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        request={request}
        staticName={staticName}
        groupId={groupId}
        discoverySettings={discoverySettings}
        onAccept={onAccept}
        onDecline={onDecline}
        onMarkUnderReview={onUnderReview}
        onAddToRoster={onLinkRoster}
      />
    </div>
  );
}
