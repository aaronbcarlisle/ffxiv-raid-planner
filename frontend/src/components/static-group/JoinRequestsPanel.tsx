import { useEffect, useState } from 'react';
import { Check, Clock, Copy, ExternalLink, Eye, Inbox, ScrollText, UserPlus, X } from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Toggle } from '../ui/Toggle';
import { JobIcon } from '../ui/JobIcon';
import { SafeAvatar } from '../ui/SafeAvatar';
import { ReadinessBadge } from '../profile/ReadinessBadge';
import { SourceBadge } from '../profile/SourceBadge';
import { formatSyncAge, getFreshness, freshnessColor } from '../profile/freshness';
import { JoinRequestReviewModal, DevReviewModalPreview } from './JoinRequestReviewModal';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { toast } from '../../stores/toastStore';
import type { JoinRequest, DiscoverySettings } from '../../types';

interface JoinRequestsPanelProps {
  groupId: string;
  discoverySettings?: DiscoverySettings;
  onAddToRoster?: (request: JoinRequest) => void;
  /** When false, accept/decline/review actions are hidden. Default: true. */
  canAct?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-status-warning',
  under_review: 'text-status-info',
  accepted: 'text-status-success',
  declined: 'text-status-error',
  cancelled: 'text-text-muted',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
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
  onMarkUnderReview,
  onReview,
  onAddToRoster,
  discoverySettings,
  canAct = true,
}: {
  request: JoinRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onMarkUnderReview: (id: string) => void;
  onReview: (request: JoinRequest) => void;
  onAddToRoster?: (request: JoinRequest) => void;
  discoverySettings?: DiscoverySettings;
  canAct?: boolean;
}) {
  const isActionable = request.status === 'pending' || request.status === 'under_review';
  const requester = request.requester;
  const [copied, setCopied] = useState(false);
  const hasProfileData = !!request.selectedJob;

  // Fit matching
  const neededRoles = discoverySettings?.neededRoles?.map((r) => r.toLowerCase()) ?? [];
  const neededJobs = discoverySettings?.neededJobs?.map((j) => j.toLowerCase()) ?? [];
  const roleMatches = request.selectedRole && neededRoles.includes(request.selectedRole);
  const jobMatches = request.selectedJob && neededJobs.includes(request.selectedJob);
  const hasMatch = roleMatches || jobMatches;

  const handleCopyDiscord = async () => {
    if (!request.contactDiscord) return;
    await navigator.clipboard.writeText(request.contactDiscord);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const gearSummary = request.gearSnapshotSummary;
  const gearFreshness = gearSummary?.syncedAt ? getFreshness(gearSummary.syncedAt) : 'none';

  return (
    <div className={`rounded-lg border bg-surface-elevated p-4 space-y-3 ${
      hasProfileData ? 'border-l-2 border-l-accent/40 border-border-default' : 'border-border-default'
    }`}>
      {/* Header: avatar, name, discord, date, status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <SafeAvatar
            src={request.characterAvatarUrlAtApply || requester?.avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full shrink-0 object-cover"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {request.characterNameAtApply || requester?.displayName || 'Unknown User'}
            </p>
            {request.characterWorldAtApply && (
              <p className="text-xs text-text-tertiary truncate">
                {request.characterWorldAtApply}
                {request.characterDcAtApply && ` [${request.characterDcAtApply}]`}
              </p>
            )}
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

      {/* Profile-rich: selected job + gear + readiness */}
      {hasProfileData && (
        <div className="rounded-lg bg-surface-raised border border-border-default p-3 space-y-2">
          {/* Primary job */}
          <div className="flex items-center gap-2 flex-wrap">
            <JobIcon job={request.selectedJob!.toUpperCase()} size="md" />
            <span className="font-display font-semibold text-text-primary text-sm">
              {request.selectedJob!.toUpperCase()}
            </span>
            {request.selectedRole && (
              <Badge variant={request.selectedRole as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster'} size="sm">
                {request.selectedRole}
              </Badge>
            )}
            {request.readinessAtApply && (
              <ReadinessBadge readiness={request.readinessAtApply} />
            )}
            {/* Fit match */}
            {hasMatch && (
              <Badge variant="success" size="sm">
                Matches needed {jobMatches ? request.selectedJob!.toUpperCase() : request.selectedRole}
              </Badge>
            )}
          </div>

          {/* Saved gear */}
          {gearSummary && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-text-primary font-mono">iLv {gearSummary.avgItemLevel}</span>
              <SourceBadge source={gearSummary.source} />
              <span className={freshnessColor(gearFreshness)}>
                {formatSyncAge(gearSummary.syncedAt)}
              </span>
            </div>
          )}

          {request.availabilitySummary && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Clock className="w-3.5 h-3.5 text-text-tertiary" />
              <span>
                {(request.availabilitySummary.dayLabels?.length ?? 0) > 0
                  ? request.availabilitySummary.dayLabels!.join(' / ')
                  : `${request.availabilitySummary.configuredDays} Player Hub availability day${request.availabilitySummary.configuredDays !== 1 ? 's' : ''}`}
                {request.availabilitySummary.timezone ? `, ${request.availabilitySummary.timezone}` : ''}
                {request.availabilitySummary.detailLevel === 'exact' ? ' (exact)' : ''}
              </span>
            </div>
          )}

          {/* Alt jobs */}
          {request.includedAltJobs && request.includedAltJobs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border-default">
              <span className="text-xs text-text-tertiary">Also plays:</span>
              {request.includedAltJobs.map((alt) => (
                <div key={alt.job} className="flex items-center gap-1">
                  <JobIcon job={alt.job.toUpperCase()} size="sm" />
                  <span className="text-xs text-text-secondary">{alt.job.toUpperCase()}</span>
                  <ReadinessBadge readiness={alt.readiness} />
                </div>
              ))}
            </div>
          )}

          {/* View profile link */}
          {request.profileShareCodeAtApply && (
            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ExternalLink className="w-3 h-3" />}
                onClick={() => window.open(`/profile/${request.profileShareCodeAtApply}`, '_blank')}
              >
                View Full Profile
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Legacy: role/job chips (only when no profile data) */}
      {!hasProfileData && (request.roleInterest?.length || request.jobInterest?.length) ? (
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

      {isActionable && canAct && (
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ScrollText className="w-3.5 h-3.5" />}
            onClick={() => onReview(request)}
          >
            Review
          </Button>
          <div className="flex gap-2">
            {request.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Eye className="w-3.5 h-3.5" />}
                onClick={() => onMarkUnderReview(request.id)}
              >
                Maybe Later
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              leftIcon={<X className="w-3.5 h-3.5" />}
              onClick={() => onDecline(request.id)}
            >
              Decline
            </Button>
            <Button
              variant="success"
              size="sm"
              leftIcon={<Check className="w-3.5 h-3.5" />}
              onClick={() => onAccept(request.id)}
            >
              Accept
            </Button>
          </div>
        </div>
      )}

      {/* Accepted: roster onboarding CTA */}
      {request.status === 'accepted' && (
        <div className="flex items-center gap-2 pt-1">
          {request.rosterPlayerId ? (
            <Badge variant="success" size="sm">On Roster</Badge>
          ) : onAddToRoster && request.selectedJob ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={() => onAddToRoster(request)}
            >
              Add to Roster
            </Button>
          ) : (
            <Badge variant="default" size="sm">Member</Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function JoinRequestsPanel({ groupId, discoverySettings, onAddToRoster, canAct = true }: JoinRequestsPanelProps) {
  const { groupRequests, pendingCount, isLoading, fetchGroupRequests, acceptRequest, declineRequest, markUnderReview } =
    useJoinRequestStore();
  const [showResolved, setShowResolved] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<JoinRequest | null>(null);

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

  const handleMarkUnderReview = async (requestId: string) => {
    try {
      await markUnderReview(requestId);
      toast.success('Marked as under review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update request');
    }
  };

  // Keep the review modal in sync with store updates
  const reviewRequest = reviewingRequest
    ? groupRequests.find((r) => r.id === reviewingRequest.id) ?? reviewingRequest
    : null;

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
              onMarkUnderReview={handleMarkUnderReview}
              onReview={setReviewingRequest}
              onAddToRoster={onAddToRoster}
              discoverySettings={discoverySettings}
              canAct={canAct}
            />
          ))}
        </div>
      )}

      {/* Review modal */}
      {reviewRequest && (
        <JoinRequestReviewModal
          isOpen={!!reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          request={reviewRequest}
          staticName={reviewRequest.staticGroupName ?? 'Static'}
          discoverySettings={discoverySettings}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onMarkUnderReview={handleMarkUnderReview}
          onAddToRoster={onAddToRoster}
        />
      )}

      {/* Dev-only preview for visual testing */}
      <DevReviewModalPreview />
    </div>
  );
}
