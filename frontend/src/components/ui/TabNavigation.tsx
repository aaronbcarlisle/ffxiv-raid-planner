import { Settings2 } from 'lucide-react';
import type { PageMode } from '../../types';
import { TAB_ICONS } from '../../types';
import { Tooltip } from '../primitives/Tooltip';

interface TabNavigationProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  /** Show the Priority tab (for leads/owners only) */
  showPriorityTab?: boolean;
}

// Map PageMode to TAB_ICONS keys (priority uses Lucide icon instead)
const PAGE_TO_ICON: Record<Exclude<PageMode, 'priority'>, keyof typeof TAB_ICONS> = {
  players: 'party',
  loot: 'loot',
  stats: 'stats',
  history: 'history',
};

const BASE_TABS: { id: PageMode; label: string; hotkey: string; description: string }[] = [
  { id: 'players', label: 'Roster', hotkey: '1', description: 'View and edit player gear progress' },
  { id: 'loot', label: 'Loot', hotkey: '2', description: 'Plan loot distribution and priority' },
  { id: 'history', label: 'Log', hotkey: '3', description: 'Track weekly loot drops and history' },
  { id: 'stats', label: 'Summary', hotkey: '4', description: 'Team-wide gear statistics' },
];

const PRIORITY_TAB = { id: 'priority' as PageMode, label: 'Priority', hotkey: '5', description: 'Configure loot priority settings' };

export function TabNavigation({ activeTab, onTabChange, showPriorityTab }: TabNavigationProps) {
  const TABS = showPriorityTab ? [...BASE_TABS, PRIORITY_TAB] : BASE_TABS;
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
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border
              ${
                activeTab === tab.id
                  ? 'bg-surface-elevated text-text-primary border-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-transparent'
              }
            `}
          >
            {tab.id === 'priority' ? (
              <Settings2 className="w-5 h-5" />
            ) : (
              <img
                src={TAB_ICONS[PAGE_TO_ICON[tab.id as Exclude<PageMode, 'priority'>]]}
                alt=""
                width={20}
                height={20}
                className="rounded-sm"
              />
            )}
            <span>{tab.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
