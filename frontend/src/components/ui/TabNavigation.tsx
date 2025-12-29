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
};

const TABS: { id: PageMode; label: string }[] = [
  { id: 'players', label: 'Roster' },
  { id: 'loot', label: 'Loot' },
  { id: 'stats', label: 'Progress' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex gap-1 bg-surface-raised rounded-lg p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
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
