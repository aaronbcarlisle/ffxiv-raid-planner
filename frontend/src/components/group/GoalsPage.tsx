/* eslint-disable design-system/no-raw-button */
import { ObjectiveGoalsPanel } from '../static-group/ObjectiveGoalsPanel';
import { CollectionsHub } from '../collections/CollectionsHub';
import { MembersOnlyCard } from '../auth';
import { useUrlTabState } from '../../hooks/useUrlTabState';

const GOALS_SUB_TABS = ['objectives', 'farms'] as const;
type GoalsSubTab = (typeof GOALS_SUB_TABS)[number];

const GOALS_TABS: { id: GoalsSubTab; label: string }[] = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'farms', label: 'Farms' },
];

interface GoalsPageProps {
  groupId: string;
  /** Required so a call site that omits them fails `tsc -b` (GUEST-2 R-G2-5). */
  groupName: string;
  currentUserId: string;
  canManage: boolean;
  isViewer: boolean;
  /** `userRole != null`, matching the backend's require_membership (viewers and
   *  admins pass). A non-member gets the members-only card and nothing mounts. */
  isMember: boolean;
}

export function GoalsPage({ groupId, groupName, currentUserId, canManage, isViewer, isMember }: GoalsPageProps) {
  // Sub-tab in the URL (?goal=objectives|farms) — deep-linkable, reload-safe, and
  // follows back/forward. Links like "Open Mount Farms" target Farms via this param.
  const [subTab, setSubTab] = useUrlTabState('goal', GOALS_SUB_TABS, 'objectives');

  if (!isMember) {
    return <MembersOnlyCard staticName={groupName} subject="Objectives and farms" />;
  }

  return (
    <div>
      <div className="overflow-x-auto mb-6 flex-shrink-0">
        <div className="flex gap-0.5 p-1 bg-surface-raised rounded-lg border border-border-default w-fit" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          {GOALS_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
                subTab === t.id
                  ? 'bg-accent/[0.18] text-accent shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'objectives' && (
        <ObjectiveGoalsPanel groupId={groupId} canManage={canManage} />
      )}
      {subTab === 'farms' && (
        <CollectionsHub
          groupId={groupId}
          currentUserId={currentUserId}
          canManage={canManage}
          isViewer={isViewer}
        />
      )}
    </div>
  );
}
