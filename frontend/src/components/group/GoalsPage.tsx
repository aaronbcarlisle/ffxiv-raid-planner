/* eslint-disable design-system/no-raw-button */
import { ObjectiveGoalsPanel } from '../static-group/ObjectiveGoalsPanel';
import { CollectionsHub } from '../collections/CollectionsHub';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { useTranslation } from 'react-i18next';

const GOALS_SUB_TABS = ['objectives', 'farms'] as const;
type GoalsSubTab = (typeof GOALS_SUB_TABS)[number];

interface GoalsPageProps {
  groupId: string;
  currentUserId: string;
  canManage: boolean;
}

export function GoalsPage({ groupId, currentUserId, canManage }: GoalsPageProps) {
  const { t } = useTranslation();
  // Sub-tab in the URL (?goal=objectives|farms) — deep-linkable, reload-safe, and
  // follows back/forward. Links like "Open Mount Farms" target Farms via this param.
  const [subTab, setSubTab] = useUrlTabState('goal', GOALS_SUB_TABS, 'objectives');
  const tabs: { id: GoalsSubTab; label: string }[] = [
    { id: 'objectives', label: t('goalsPage.tabObjectives') },
    { id: 'farms', label: t('goalsPage.tabFarms') },
  ];

  return (
    <div>
      <div className="overflow-x-auto mb-6 flex-shrink-0">
        <div className="flex gap-0.5 p-1 bg-surface-raised rounded-lg border border-border-default w-fit" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
                subTab === tab.id
                  ? 'bg-accent/[0.18] text-accent shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
              }`}
            >
              {tab.label}
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
        />
      )}
    </div>
  );
}
