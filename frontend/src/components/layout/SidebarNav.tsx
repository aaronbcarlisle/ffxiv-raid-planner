/* eslint-disable design-system/no-raw-button */
import { LayoutDashboard, Calendar, Users, Trophy, Shield, MoreHorizontal } from 'lucide-react';
import type { PageMode } from '../../types';
import { analytics } from '../../services/analytics';

interface SidebarNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
}

const NAV_ITEMS = [
  { id: 'overview' as PageMode, label: 'Overview', icon: LayoutDashboard, hotkey: '`' },
  { id: 'schedule' as PageMode, label: 'Schedule', icon: Calendar, hotkey: '4' },
  { id: 'roster' as PageMode, label: 'Roster', icon: Users, hotkey: '1' },
  { id: 'goals' as PageMode, label: 'Goals & Farms', icon: Trophy, hotkey: '3' },
  { id: 'gear' as PageMode, label: 'Gear & Sync', icon: Shield, hotkey: '2' },
  { id: 'more' as PageMode, label: 'More', icon: MoreHorizontal },
];

export function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  return (
    <nav
      className="hidden sm:flex flex-col w-48 flex-shrink-0 bg-surface-card border-r border-border-subtle py-3 gap-0.5"
      aria-label="Static navigation"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          /* design-system-ignore: Sidebar nav requires custom active state styling */
          <button
            key={item.id}
            onClick={() => {
              analytics.track('navigation', 'sidebar_switch', { tab: item.id });
              onTabChange(item.id);
            }}
            className={`
              flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors text-left
              ${isActive
                ? 'bg-accent/15 text-accent border-r-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
              }
            `}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
