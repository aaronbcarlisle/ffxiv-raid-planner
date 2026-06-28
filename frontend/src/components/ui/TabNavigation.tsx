import type { ReactNode } from 'react';
import type { PageMode } from '../../types';
import { Tooltip } from '../primitives/Tooltip';
import { LayoutDashboard, Users, Shield, Calendar, Trophy, MoreHorizontal } from 'lucide-react';

interface TabNavigationProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
}


const PAGE_TO_LUCIDE_ICON: Partial<Record<PageMode, ReactNode>> = {
  overview: <LayoutDashboard size={20} />,
  roster: <Users size={20} />,
  gear: <Shield size={20} />,
  schedule: <Calendar size={20} />,
  goals: <Trophy size={20} />,
  more: <MoreHorizontal size={20} />,
};

const BASE_TABS: { id: PageMode; label: string; hotkey: string; description: string }[] = [
  { id: 'overview', label: 'Overview', hotkey: '`', description: 'Static overview, next raid, and pending applications' },
  { id: 'roster', label: 'Roster', hotkey: '1', description: 'View and edit player gear progress' },
  { id: 'gear', label: 'Gear & Sync', hotkey: '2', description: 'Loot priority, loot log, and team summary' },
  { id: 'goals', label: 'Goals & Farms', hotkey: '3', description: 'Track mounts, music, rare drops, ownership, and farm plans' },
  { id: 'schedule', label: 'Schedule', hotkey: '4', description: 'Raid schedule and RSVP across time zones' },
  { id: 'more', label: 'More', hotkey: '', description: 'Settings, integrations, and admin tools' },
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
            {PAGE_TO_LUCIDE_ICON[tab.id] && (
              <span className={`flex-shrink-0 transition-opacity ${activeTab === tab.id ? 'opacity-100' : 'opacity-45'}`}>
                {PAGE_TO_LUCIDE_ICON[tab.id]}
              </span>
            )}
            <span>{tab.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
