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
 * Bodies: the Applicants tab (RH1c) fetches its own slice. Listing and Invites
 * hand off to the Settings dock through `openDock` (R-RH-J) until RH1d moves
 * the editor and the invite list here.
 */
import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/primitives';
import { CardShell, PageSkeleton, Tabs } from '../components/ui';
import { ApplicantsTab } from '../components/recruit/ApplicantsTab';
import { RecruitHeader } from '../components/recruit/RecruitHeader';
import { RECRUIT_TAB_VALUES, withCarriedParams, type RecruitTab } from '../components/recruit/recruitTabs';
import { useUrlTabState } from '../hooks/useUrlTabState';
import { useStaticPermissions } from '../hooks/useStaticPermissions';
import { useJoinRequestStore } from '../stores/joinRequestStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import type { RecruitmentSection } from '../components/settings';
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
      createRequested={searchParams.get('create') === '1'}
    />
  );
}

function RecruitPageBody({
  group,
  tab,
  onTabChange,
  createRequested,
}: {
  group: StaticGroup;
  tab: RecruitTab;
  onTabChange: (tab: RecruitTab) => void;
  /** `?create=1`: the Invites hand-off keeps the create-invite highlight it carried. */
  createRequested: boolean;
}) {
  // The header's waiting count (RecruitHeader) reads `applicants` regardless
  // of which tab is active, so the page fetches it here rather than only
  // inside the Applicants tab (IMPORTANT 1, whole-branch review): a deep link
  // straight to Listing or Invites must not show a stale/empty count. The
  // Applicants tab's own effect stays — the store's sequence guard absorbs
  // the duplicate call when both land. A failure here is silent (no tab is
  // showing the inbox to explain a toast against); the Applicants tab's own
  // effect toasts if the applicant ever opens it.
  const fetchApplicants = useJoinRequestStore((s) => s.fetchApplicants);
  useEffect(() => {
    fetchApplicants(group.id).catch(() => {});
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
      {tab === 'listing' && <DockFallback section="listing" />}
      {tab === 'invites' && <DockFallback section="invitations" highlightCreateInvite={createRequested} />}
    </div>
  );
}

/** R-RH-J: the interim hand-off to the Settings dock, bypassing the route redirect. */
function DockFallback({
  section,
  highlightCreateInvite = false,
}: {
  section: RecruitmentSection;
  highlightCreateInvite?: boolean;
}) {
  return (
    <CardShell as="div" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text-secondary">Coming in the next update, use Settings → Recruitment for now</p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          useSettingsPanelStore.getState().openDock({ tab: 'recruitment', section, highlightCreateInvite })
        }
      >
        Open Settings → Recruitment
      </Button>
    </CardShell>
  );
}
