import { useState } from 'react';
import type { Player, StaticSettings, TeamSummary as TeamSummaryType } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import { LootPriorityPanel } from './LootPriorityPanel';
import { TeamSummary } from '../team/TeamSummary';

type Tab = 'loot' | 'stats';

interface SummaryPanelProps {
  players: Player[];
  settings: StaticSettings;
  selectedFloor: FloorNumber;
  floorName: string;
  teamSummary: TeamSummaryType;
}

export function SummaryPanel({
  players,
  settings,
  selectedFloor,
  floorName,
  teamSummary,
}: SummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('loot');

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-1 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('loot')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'loot'
              ? 'bg-bg-card border border-b-0 border-border-default text-accent'
              : 'bg-bg-hover text-text-muted hover:text-text-primary'
          }`}
        >
          Loot Priority
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'bg-bg-card border border-b-0 border-border-default text-accent'
              : 'bg-bg-hover text-text-muted hover:text-text-primary'
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
        />
      ) : (
        <TeamSummary summary={teamSummary} />
      )}
    </div>
  );
}
