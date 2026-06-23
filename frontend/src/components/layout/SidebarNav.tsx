/* eslint-disable design-system/no-raw-button */
import { LayoutDashboard, Calendar, Users, Trophy, Shield, MoreHorizontal } from 'lucide-react';
import type { PageMode } from '../../types';
import { analytics } from '../../services/analytics';

interface SidebarNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  staticName?: string;
}

const NAV_ITEMS: Array<{ id: PageMode; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'roster', label: 'Roster', icon: Users },
  { id: 'goals', label: 'Goals & Farms', icon: Trophy },
  { id: 'gear', label: 'Gear & Sync', icon: Shield },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const MORE_DIVIDER_BEFORE = 'more';

export function SidebarNav({ activeTab, onTabChange, staticName }: SidebarNavProps) {
  return (
    <nav
      className="hidden sm:flex flex-col w-48 flex-shrink-0 border-r border-border-subtle"
      style={{ background: 'linear-gradient(180deg, #0b0b12 0%, #090910 100%)' }}
      aria-label="Static navigation"
    >
      {/* Identity / branding area */}
      <div className="px-3 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2 px-1">
          <Shield size={13} className="text-accent flex-shrink-0" />
          <span
            className="text-xs font-semibold text-accent truncate font-display tracking-wide"
            title={staticName}
          >
            {staticName ?? 'Static'}
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-0.5 py-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id}>
              {item.id === MORE_DIVIDER_BEFORE && (
                <div className="mx-3 my-1 border-t border-border-subtle" />
              )}
              {/* design-system-ignore: Sidebar nav requires custom active state styling */}
              <button
                onClick={() => {
                  analytics.track('navigation', 'sidebar_switch', { tab: item.id });
                  onTabChange(item.id);
                }}
                className={`
                  relative flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-all text-left
                  ${isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-accent rounded-r" />
                )}
                <Icon size={15} className="flex-shrink-0" />
                <span className="leading-none">{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
