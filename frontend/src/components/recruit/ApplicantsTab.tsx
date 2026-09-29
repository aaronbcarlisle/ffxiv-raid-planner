/**
 * ApplicantsTab — the Recruiting page's Applicants tab (RH1c, spec §4).
 *
 * The mount fetch lives in `RecruitPage` (fix wave round 2: two mount
 * fetches raced the store's sequence guard and could swallow a real
 * failure) — this component only reads `applicants` and renders a loading
 * skeleton until the slice belongs to this group. Active rows — waiting
 * (`pending` | `under_review`) plus accepted rows not yet linked to a roster
 * slot, since "Link to roster slot" is the next step in the flow (spec §4:
 * "Accept then shows Link to roster") — sort newest first; the rest sit
 * behind a collapsed Resolved toggle. Action handlers wrap the store's
 * accept/decline/under-review calls with a toast and, on failure (Review
 * Focus 5: the backend's 400 "already accepted" when another lead resolved
 * it first), await a refetch so the row reflects what actually happened and
 * the row's in-flight guard holds until the reload lands (a retry during the
 * GET could otherwise be overwritten by its stale response). Empty states
 * read the listing's live/public/enabled state and its normalised status
 * (spec §3); the positive "No one has asked yet" only shows when there is
 * no history at all.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Button } from '../primitives/Button';
import { CardShell } from '../ui/CardShell';
import { EmptyState } from '../ui/EmptyState';
import { LinkText } from '../ui/LinkText';
import { CardSkeleton } from '../ui/Skeleton';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { toast } from '../../stores/toastStore';
import { useGroupAddToRoster } from '../../pages/groupActionsContext';
import { ApplicantRow } from './ApplicantRow';
import { useRecruitmentStatus } from './useRecruitStatus';
import type { RecruitTab } from './recruitTabs';
import type { JoinRequest, StaticGroup } from '../../types';

const WAITING_STATUSES = new Set(['pending', 'under_review']);

/** Rows that still need the lead: waiting, or accepted but not yet linked to a roster slot. */
function isActive(request: JoinRequest): boolean {
  return WAITING_STATUSES.has(request.status) || (request.status === 'accepted' && !request.rosterPlayerId);
}

interface ApplicantsTabProps {
  group: StaticGroup;
  onTabChange: (tab: RecruitTab) => void;
}

export function ApplicantsTab({ group, onTabChange }: ApplicantsTabProps) {
  const navigate = useNavigate();
  const applicants = useJoinRequestStore((s) => s.applicants);
  const loadError = useJoinRequestStore((s) => s.error);
  const fetchApplicants = useJoinRequestStore((s) => s.fetchApplicants);
  const acceptRequest = useJoinRequestStore((s) => s.acceptRequest);
  const declineRequest = useJoinRequestStore((s) => s.declineRequest);
  const markUnderReview = useJoinRequestStore((s) => s.markUnderReview);
  const onLinkRoster = useGroupAddToRoster();
  const status = useRecruitmentStatus(group);
  const [showResolved, setShowResolved] = useState(false);

  const refetch = async () => {
    try {
      await fetchApplicants(group.id);
    } catch {
      toast.error("Couldn't load applicants.");
    }
  };

  if (!applicants || applicants.groupId !== group.id) {
    return (
      <div data-testid="applicants-loading" className="flex flex-col gap-3">
        <CardSkeleton />
        <CardSkeleton />
        {loadError && (
          <div className="text-center">
            <LinkText onClick={refetch}>Retry</LinkText>
          </div>
        )}
      </div>
    );
  }

  const items: JoinRequest[] = applicants.items;
  const active = items
    .filter(isActive)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const resolved = items.filter((r) => !isActive(r));

  const handleAccept = async (id: string) => {
    try {
      await acceptRequest(id);
      toast.success('Request accepted — member added to static.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept request');
      await refetch();
    }
  };

  const handleDecline = async (id: string) => {
    try {
      await declineRequest(id);
      toast.success('Request declined.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decline request');
      await refetch();
    }
  };

  const handleUnderReview = async (id: string) => {
    try {
      await markUnderReview(id);
      toast.success('Marked as under review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update request');
      await refetch();
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
      {active.length === 0 && (
        <ApplicantsEmptyState
          group={group}
          status={status}
          hasHistory={items.length > 0}
          onGoToListing={() => onTabChange('listing')}
          onBrowseFinder={() => navigate('/discover')}
        />
      )}
      {active.map((request) => (
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
  hasHistory,
  onGoToListing,
  onBrowseFinder,
}: {
  group: StaticGroup;
  status: 'open' | 'selective' | 'paused' | 'closed';
  /** Resolved rows exist: the listing-state branches still apply, but
   *  "No one has asked yet" would contradict the Resolved toggle below. */
  hasHistory: boolean;
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

  if (hasHistory) return null;

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
