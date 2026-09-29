/**
 * RecruitPage — the V2 Recruiting home at `/group/:shareCode/recruit` (RH1b).
 *
 * The frame (R-RH-G, R-RH-H): `RecruitHeader` with the status `Select`, three
 * URL-synced `Tabs` (`?rtab=`), and the guard — a skeleton until the store
 * holds THIS static (a stale group from a rail switch must not flash another
 * static's inbox), then a replace-redirect to the static for anyone who can't
 * manage it (owner, lead, or admin access), so a member deep link never mounts
 * the inbox and Back is one step.
 *
 * Bodies: the Applicants tab (RH1c) fetches its own slice. The Listing tab
 * (RH1d) is a slim status card over the existing `DiscoveryTab` editor, and
 * the Invites tab (RH1d) lists and creates invitations directly — both no
 * longer hand off to the Settings dock.
 */
import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { PageSkeleton, Tabs } from '../components/ui';
import { ApplicantsTab } from '../components/recruit/ApplicantsTab';
import { ListingTab } from '../components/recruit/ListingTab';
import { InvitesTab } from '../components/recruit/InvitesTab';
import { RecruitHeader } from '../components/recruit/RecruitHeader';
import { RECRUIT_TAB_VALUES, withCarriedParams, type RecruitTab } from '../components/recruit/recruitTabs';
import { useUrlTabState } from '../hooks/useUrlTabState';
import { useStaticPermissions } from '../hooks/useStaticPermissions';
import { useJoinRequestStore } from '../stores/joinRequestStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { toast } from '../stores/toastStore';
import type { StaticGroup } from '../types';

const RECRUIT_TABS: { id: RecruitTab; label: string }[] = [
  { id: 'applicants', label: 'Applicants' },
  { id: 'listing', label: 'Listing' },
  { id: 'invites', label: 'Invites' },
];

export function RecruitPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const { canEdit: canManage } = useStaticPermissions();
  const [tab, setTab] = useUrlTabState('rtab', RECRUIT_TAB_VALUES, 'applicants');
  const [searchParams] = useSearchParams();

  if (!shareCode || !currentGroup || currentGroup.shareCode !== shareCode) {
    return <PageSkeleton />;
  }
  if (!canManage) {
    // Carry the search minus the route's own params: the tier so the static
    // opens on the one the link had, `viewAs`/`adminMode` so URL-driven access
    // is not lost on the way back.
    return <Navigate to={withCarriedParams(`/group/${shareCode}`, searchParams.toString())} replace />;
  }
  return (
    <RecruitPageBody
      group={currentGroup}
      tab={tab}
      onTabChange={setTab}
    />
  );
}

function RecruitPageBody({
  group,
  tab,
  onTabChange,
}: {
  group: StaticGroup;
  tab: RecruitTab;
  onTabChange: (tab: RecruitTab) => void;
}) {
  // The page is the SOLE mount fetch for `applicants` (fix wave round 2): the
  // header's waiting count reads it regardless of which tab is active, so a
  // deep link straight to Listing or Invites must not show a stale/empty
  // count, and having both the page and the Applicants tab fetch on mount
  // raced two sequence numbers against the store's stale-response guard — the
  // page's own call could lose to the tab's and its rejection then got
  // swallowed, leaving a permanent skeleton with no toast and no retry. The
  // tab keeps `refetch()` for the action-error path (Review Focus 5) but no
  // longer fetches on mount.
  const fetchApplicants = useJoinRequestStore((s) => s.fetchApplicants);
  useEffect(() => {
    fetchApplicants(group.id).catch(() => {
      toast.error("Couldn't load applicants.");
    });
  }, [group.id, fetchApplicants]);

  return (
    <div data-testid="recruit-page" className="w-full max-w-[120rem] px-3 sm:px-6 pb-6">
      <RecruitHeader group={group} tab={tab} />
      <Tabs
        tabs={RECRUIT_TABS}
        value={tab}
        onChange={(id) => onTabChange(id as RecruitTab)}
        aria-label="Recruiting sections"
        className="mb-4"
      />
      {tab === 'applicants' && <ApplicantsTab group={group} onTabChange={onTabChange} />}
      {tab === 'listing' && <ListingTab group={group} onTabChange={onTabChange} />}
      {tab === 'invites' && <InvitesTab groupId={group.id} />}
    </div>
  );
}
