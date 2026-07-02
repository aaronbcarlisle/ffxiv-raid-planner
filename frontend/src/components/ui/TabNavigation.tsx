import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageMode } from '../../types';
import { Tooltip } from '../primitives/Tooltip';
import { analytics } from '../../services/analytics';
import { XivIcon } from './XivIcon';

interface TabNavigationProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
}


const PAGE_TO_XIV_ICON: Partial<Record<PageMode, ReactNode>> = {
  overview: <XivIcon name="stats" size={20} />,
  roster: <XivIcon name="party" size={20} />,
  gear: <XivIcon name="loot" size={20} />,
  schedule: <XivIcon name="schedule" size={20} />,
  goals: <XivIcon name="goals" size={20} />,
  more: <XivIcon name="options" size={20} />,
};

const BASE_TABS: { id: PageMode; labelKey: string; hotkey: string; descriptionKey: string }[] = [
  { id: 'overview', labelKey: 'nav.overview', hotkey: '`', descriptionKey: 'nav.overviewDesc' },
  { id: 'roster', labelKey: 'nav.roster', hotkey: '1', descriptionKey: 'nav.rosterDesc' },
  { id: 'gear', labelKey: 'nav.gearAndSync', hotkey: '2', descriptionKey: 'nav.gearAndSyncDesc' },
  { id: 'goals', labelKey: 'nav.goalsAndFarms', hotkey: '3', descriptionKey: 'nav.goalsAndFarmsDesc' },
  { id: 'schedule', labelKey: 'nav.schedule', hotkey: '4', descriptionKey: 'nav.scheduleDesc' },
  { id: 'more', labelKey: 'nav.more', hotkey: '', descriptionKey: 'nav.moreDesc' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const { t } = useTranslation();
  const TABS = BASE_TABS;
  return (
    <div className="flex gap-1 bg-surface-raised rounded-lg p-1">
      {TABS.map((tab) => (
        <Tooltip
          key={tab.id}
          content={
            <div>
              <div className="flex items-center gap-2 font-medium">
                {t(tab.labelKey)}
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">
                  {tab.hotkey}
                </kbd>
              </div>
              <div className="text-text-secondary text-xs mt-0.5">{t(tab.descriptionKey)}</div>
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
            {PAGE_TO_XIV_ICON[tab.id] && (
              <span className={`flex-shrink-0 transition-opacity ${activeTab === tab.id ? 'opacity-100' : 'opacity-45'}`}>
                {PAGE_TO_XIV_ICON[tab.id]}
              </span>
            )}
            <span>{t(tab.labelKey)}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
