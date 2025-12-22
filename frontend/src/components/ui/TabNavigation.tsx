import type { PageMode } from '../../types';

interface TabNavigationProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
}

const TABS: { id: PageMode; label: string; icon: string }[] = [
  { id: 'players', label: 'Players', icon: '👥' },
  { id: 'loot', label: 'Loot', icon: '🎯' },
  { id: 'stats', label: 'Stats', icon: '📊' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors
            ${
              activeTab === tab.id
                ? 'bg-accent text-bg-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }
          `}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
