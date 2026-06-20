import type { ReactNode } from 'react';
import type { PageMode } from '../../types';
import { TAB_ICONS } from '../../types';
import { Tooltip } from '../primitives/Tooltip';
import { analytics } from '../../services/analytics';
import { GameIcon } from '../ui/GameIcon';

interface TabNavigationProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
}

const PAGE_TO_ICON: Partial<Record<PageMode, keyof typeof TAB_ICONS>> = {
  players: 'party',
  loot: 'loot',
  stats: 'stats',
  history: 'history',
  schedule: 'schedule',
  'mount-farms': 'mountFarms',
};

const PAGE_TO_LUCIDE_ICON: Partial<Record<PageMode, ReactNode>> = {
  home: <GameIcon name="checklist" size="md" />,
};

const BASE_TABS: { id: PageMode; label: string; hotkey: string; description: string }[] = [
  { id: 'home', label: 'Overview', hotkey: '`', description: 'Static overview, next raid, and pending applications' },
  { id: 'players', label: 'Roster', hotkey: '1', description: 'View and edit player gear progress' },
  { id: 'loot', label: 'Priority', hotkey: '2', description: 'Loot priority rankings and who needs what' },
  { id: 'history', label: 'Loot Log', hotkey: '3', description: 'Track weekly loot drops and history' },
  { id: 'stats', label: 'Summary', hotkey: '4', description: 'Team-wide gear statistics' },
  { id: 'schedule', label: 'Schedule', hotkey: '5', description: 'Raid schedule and RSVP across time zones' },
  { id: 'mount-farms', label: 'Collections & Farms', hotkey: '6', description: 'Track mounts, music, rare drops, ownership, and farm plans' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const TABS = BASE_TABS;
  return (
    <div className="flex gap-1 bg-surface-raised rounded-lg p-1">
      {TABS.map((tab) => (
        <Tooltip
          key={tab.id}
          content={
            <div>
              <div className="flex items-center gap-2 font-medium">
                {tab.label}
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">
                  {tab.hotkey}
                </kbd>
              </div>
              <div className="text-text-secondary text-xs mt-0.5">{tab.description}</div>
            </div>
          }
        >
          {/* design-system-ignore: Tab button requires specific toggle styling */}
          <button
            onClick={() => {
              analytics.track('navigation', 'tab_switch', { tab: tab.id });
              onTabChange(tab.id);
            }}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border
              ${
                activeTab === tab.id
                  ? 'bg-accent/20 text-accent border-accent/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-transparent'
              }
            `}
          >
            {PAGE_TO_LUCIDE_ICON[tab.id] ? (
              <span className={`flex-shrink-0 transition-opacity ${activeTab === tab.id ? 'opacity-100' : 'opacity-45'}`}>
                {PAGE_TO_LUCIDE_ICON[tab.id]}
              </span>
            ) : (
              // Sprite tabs: active = full opacity, inactive = dimmed to match lucide icon treatment
              // Design guide: docs/UI_COMPONENTS.md — icon sizing w-5 h-5 (20px), active/inactive color via opacity
              <img
                src={TAB_ICONS[PAGE_TO_ICON[tab.id]!]}
                alt=""
                width={20}
                height={20}
                className={`rounded-sm transition-opacity ${activeTab === tab.id ? 'opacity-100' : 'opacity-45'}`}
              />
            )}
            <span>{tab.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
