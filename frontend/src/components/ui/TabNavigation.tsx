import type { PageMode } from '../../types';
import { TAB_ICONS } from '../../types';

interface TabNavigationProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
}

// Map PageMode to TAB_ICONS keys
const PAGE_TO_ICON: Record<PageMode, keyof typeof TAB_ICONS> = {
  players: 'party',
  loot: 'loot',
  stats: 'stats',
  history: 'history',
};

const TABS: { id: PageMode; label: string; hotkey: string }[] = [
  { id: 'players', label: 'Roster', hotkey: '1' },
  { id: 'loot', label: 'Loot', hotkey: '2' },
  { id: 'history', label: 'Log', hotkey: '3' },
  { id: 'stats', label: 'Summary', hotkey: '4' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex gap-1 bg-surface-raised rounded-lg p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          title={`${tab.label} (${tab.hotkey})`}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors border
            ${
              activeTab === tab.id
                ? 'bg-surface-elevated text-text-primary border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-transparent'
            }
          `}
        >
          <img
            src={TAB_ICONS[PAGE_TO_ICON[tab.id]]}
            alt=""
            width={20}
            height={20}
            className="rounded-sm"
          />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
