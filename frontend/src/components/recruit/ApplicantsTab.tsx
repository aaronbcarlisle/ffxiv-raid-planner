/**
 * ApplicantsTab — the Recruiting page's Applicants tab (RH1c, spec §4).
 *
 * Fetches the applicants slice on mount (R-RH-R). Waiting (`pending` |
 * `under_review`) rows sort newest first; resolved rows sit behind a
 * collapsed toggle. Action handlers wrap the store's accept/decline/under-
 * review calls with a toast and, on failure (Review Focus 5: the backend's
 * 400 "already accepted" when another lead resolved it first), refetch so
 * the row reflects what actually happened. Empty states read the listing's
 * live/public/enabled state and its normalised status (spec §3).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Button } from '../primitives/Button';
import { CardShell } from '../ui/CardShell';
import { EmptyState } from '../ui/EmptyState';
import { LinkText } from '../ui/LinkText';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { toast } from '../../stores/toastStore';
import { useGroupAddToRoster } from '../../pages/groupActionsContext';
import { ApplicantRow } from './ApplicantRow';
import { useRecruitStatus } from './useRecruitStatus';
import type { RecruitTab } from './recruitTabs';
import type { JoinRequest, StaticGroup } from '../../types';

const WAITING_STATUSES = new Set(['pending', 'under_review']);

interface ApplicantsTabProps {
  group: StaticGroup;
  onTabChange: (tab: RecruitTab) => void;
}

export function ApplicantsTab({ group, onTabChange }: ApplicantsTabProps) {
  const navigate = useNavigate();
  const applicants = useJoinRequestStore((s) => s.applicants);
  const fetchApplicants = useJoinRequestStore((s) => s.fetchApplicants);
  const acceptRequest = useJoinRequestStore((s) => s.acceptRequest);
  const declineRequest = useJoinRequestStore((s) => s.declineRequest);
  const markUnderReview = useJoinRequestStore((s) => s.markUnderReview);
  const onLinkRoster = useGroupAddToRoster();
  const { status } = useRecruitStatus(group);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    void fetchApplicants(group.id);
  }, [group.id, fetchApplicants]);

  const items: JoinRequest[] = applicants?.groupId === group.id ? applicants.items : [];
  const waiting = items
    .filter((r) => WAITING_STATUSES.has(r.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const resolved = items.filter((r) => !WAITING_STATUSES.has(r.status));

  const refetch = () => void fetchApplicants(group.id);

  const handleAccept = async (id: string) => {
    try {
      await acceptRequest(id);
      toast.success('Request accepted — member added to static.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept request');
      refetch();
    }
  };

  const handleDecline = async (id: string) => {
    try {
      await declineRequest(id);
      toast.success('Request declined.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decline request');
      refetch();
    }
  };

  const handleUnderReview = async (id: string) => {
    try {
      await markUnderReview(id);
      toast.success('Marked as under review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update request');
      refetch();
    }
  };

  const discoverySettings = group.settings?.discovery;
  const rowProps = {
    staticName: group.name,
    groupId: group.id,
    discoverySettings,
    onAccept: handleAccept,
    onDecline: handleDecline,
    onUnderReview: handleUnderReview,
    onLinkRoster,
  };

  return (
    <div className="flex flex-col gap-3">
      {waiting.length === 0 && (
        <ApplicantsEmptyState
          group={group}
          status={status}
          onGoToListing={() => onTabChange('listing')}
          onBrowseFinder={() => navigate('/discover')}
        />
      )}
      {waiting.map((request) => (
        <ApplicantRow key={request.id} request={request} {...rowProps} />
      ))}
      {resolved.length > 0 && (
        <div className="flex flex-col gap-3">
          <Button variant="link" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? 'Hide resolved' : `Resolved (${resolved.length})`}
          </Button>
          {showResolved && resolved.map((request) => (
            <ApplicantRow key={request.id} request={request} {...rowProps} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicantsEmptyState({
  group,
  status,
  onGoToListing,
  onBrowseFinder,
}: {
  group: StaticGroup;
  status: 'open' | 'selective' | 'paused' | 'closed';
  onGoToListing: () => void;
  onBrowseFinder: () => void;
}) {
  const discovery = group.settings?.discovery;
  const live = !!group.isPublic && !!discovery?.enabled;

  if (!discovery) {
    return (
      <CardShell as="div">
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
          <EmptyIcon />
          <LinkText onClick={onGoToListing} className="text-base font-display">
            Set up your listing
          </LinkText>
        </div>
      </CardShell>
    );
  }

  if (!live) {
    return (
      <CardShell as="div">
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
          <EmptyIcon />
          <p className="text-text-secondary text-sm">
            Your listing is off. <LinkText onClick={onGoToListing}>Turn it on in the Listing tab</LinkText>
          </p>
        </div>
      </CardShell>
    );
  }

  if (status === 'paused' || status === 'closed') {
    return (
      <CardShell as="div">
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
          <EmptyIcon />
          <p className="text-text-secondary text-sm max-w-sm">
            {`Your listing is ${status}, so no one can ask right now. Change the status above.`}
          </p>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell as="div">
      <EmptyState
        icon={<Inbox className="w-6 h-6" aria-hidden="true" />}
        heading="No one has asked yet"
        description="Applicants who request to join from the Static Finder show up here."
      />
      <div className="text-center pb-4 -mt-2">
        <LinkText onClick={onBrowseFinder}>Browse the Static Finder</LinkText>
      </div>
    </CardShell>
  );
}

function EmptyIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
      <Inbox className="w-6 h-6" aria-hidden="true" />
    </div>
  );
}
