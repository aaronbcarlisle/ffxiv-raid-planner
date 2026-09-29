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
 * Bodies: the Applicants slot is a placeholder RH1c fills; Listing and Invites
 * hand off to the Settings dock through `openDock` (R-RH-J) until RH1d moves
 * the editor and the invite list here.
 */
import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Button } from '../components/primitives';
import { CardShell, EmptyState, PageSkeleton, Tabs } from '../components/ui';
import { RecruitHeader } from '../components/recruit/RecruitHeader';
import { RECRUIT_TAB_VALUES, type RecruitTab } from '../components/recruit/recruitTabs';
import { useUrlTabState } from '../hooks/useUrlTabState';
import { useStaticPermissions } from '../hooks/useStaticPermissions';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useJoinRequestStore } from '../stores/joinRequestStore';
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

  if (!shareCode || !currentGroup || currentGroup.shareCode !== shareCode) {
    return <PageSkeleton />;
  }
  if (!canManage) {
    return <Navigate to={`/group/${shareCode}`} replace />;
  }
  return <RecruitPageBody group={currentGroup} tab={tab} onTabChange={setTab} />;
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
  // The header's waiting count reads the store's pending count; keep it fresh
  // for a cold load of the route (RH1c replaces this with the applicants fetch).
  const fetchGroupRequests = useJoinRequestStore((s) => s.fetchGroupRequests);
  useEffect(() => {
    void fetchGroupRequests(group.id);
  }, [group.id, fetchGroupRequests]);

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
      {tab === 'applicants' && (
        <CardShell as="div">
          <EmptyState
            icon={<Inbox className="w-6 h-6" aria-hidden="true" />}
            heading="No one has asked yet"
            description="Applicants who request to join from the Static Finder show up here."
          />
        </CardShell>
      )}
      {tab === 'listing' && <DockFallback section="listing" />}
      {tab === 'invites' && <DockFallback section="invitations" />}
    </div>
  );
}

/** R-RH-J: the interim hand-off to the Settings dock, bypassing the route redirect. */
function DockFallback({ section }: { section: RecruitmentSection }) {
  return (
    <CardShell as="div" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text-secondary">Coming in the next update, use Settings → Recruitment for now</p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => useSettingsPanelStore.getState().openDock({ tab: 'recruitment', section })}
      >
        Open Settings → Recruitment
      </Button>
    </CardShell>
  );
}
