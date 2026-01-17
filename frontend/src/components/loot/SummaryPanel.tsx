import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SnapshotPlayer, StaticSettings, TeamSummary as TeamSummaryType } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import { LootPriorityPanel } from './LootPriorityPanel';
import { TeamSummary } from '../team/TeamSummary';

type Tab = 'loot' | 'stats';

interface SummaryPanelProps {
  players: SnapshotPlayer[];
  settings: StaticSettings;
  selectedFloor: FloorNumber;
  floorName: string;
  floors: string[];
  teamSummary: TeamSummaryType;
  initialTab?: Tab;
}

export function SummaryPanel({
  players,
  settings,
  selectedFloor,
  floorName,
  floors,
  teamSummary,
  initialTab = 'loot',
}: SummaryPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize active tab from URL param > initialTab prop > default
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    const urlTab = searchParams.get('statsTab');
    if (urlTab === 'loot' || urlTab === 'stats') return urlTab;
    return initialTab;
  });

  // Wrapper to update activeTab and sync to URL
  const setActiveTab = useCallback((tab: Tab) => {
    setActiveTabState(tab);
    // Update URL - only include if not default
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (tab === 'loot') {
        params.delete('statsTab');
      } else {
        params.set('statsTab', tab);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-1 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('loot')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'loot'
              ? 'bg-surface-card border border-b-0 border-border-default text-accent'
              : 'bg-surface-interactive text-text-muted hover:text-text-primary'
          }`}
        >
          Loot Priority
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'bg-surface-card border border-b-0 border-border-default text-accent'
              : 'bg-surface-interactive text-text-muted hover:text-text-primary'
          }`}
        >
          Team Stats
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'loot' ? (
        <LootPriorityPanel
          players={players}
          settings={settings}
          selectedFloor={selectedFloor}
          floorName={floorName}
          floors={floors}
        />
      ) : (
        <TeamSummary summary={teamSummary} />
      )}
    </div>
  );
}
