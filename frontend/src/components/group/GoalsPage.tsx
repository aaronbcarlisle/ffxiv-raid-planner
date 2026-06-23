/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import { ObjectiveGoalsPanel } from '../static-group/ObjectiveGoalsPanel';
import { CollectionsHub } from '../collections/CollectionsHub';

type GoalsSubTab = 'objectives' | 'farms';

const GOALS_TABS: { id: GoalsSubTab; label: string }[] = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'farms', label: 'Farms' },
];

interface GoalsPageProps {
  groupId: string;
  currentUserId: string;
  canManage: boolean;
}

export function GoalsPage({ groupId, currentUserId, canManage }: GoalsPageProps) {
  const [subTab, setSubTab] = useState<GoalsSubTab>('objectives');

  return (
    <div>
      <div className="flex gap-1 mb-6 p-1 bg-surface-raised rounded-lg border border-border-subtle w-fit">
        {GOALS_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              subTab === t.id
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
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
