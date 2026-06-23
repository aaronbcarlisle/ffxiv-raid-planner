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
  { id: 'overview',  label: 'Overview',     icon: LayoutDashboard },
  { id: 'schedule',  label: 'Schedule',     icon: Calendar },
  { id: 'roster',    label: 'Roster',       icon: Users },
  { id: 'goals',     label: 'Goals & Farms',icon: Trophy },
  { id: 'gear',      label: 'Gear & Sync',  icon: Shield },
  { id: 'more',      label: 'More',         icon: MoreHorizontal },
];

const MORE_DIVIDER_BEFORE = 'more';

export function SidebarNav({ activeTab, onTabChange, staticName }: SidebarNavProps) {
  return (
    <nav
      className="hidden sm:flex flex-col w-48 flex-shrink-0 border-r border-border-subtle"
      style={{
        background: 'linear-gradient(180deg, #0c0c14 0%, #090910 60%, #07070e 100%)',
      }}
      aria-label="Static navigation"
    >
      {/* Identity area */}
      <div
        className="px-4 py-3.5 border-b border-border-subtle flex items-center gap-2.5 min-w-0"
        style={{ background: 'rgba(20,184,166,0.04)' }}
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(20,184,166,0.15)' }}
        >
          <Shield size={11} className="text-accent" />
        </div>
        <span
          className="text-xs font-semibold text-accent truncate font-display tracking-wide leading-none"
          title={staticName}
        >
          {staticName ?? 'Static'}
        </span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-0 py-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id}>
              {item.id === MORE_DIVIDER_BEFORE && (
                <div className="mx-3 my-1.5 border-t border-border-subtle" />
              )}
              {/* design-system-ignore: Sidebar nav requires custom active state styling */}
              <button
                onClick={() => {
                  analytics.track('navigation', 'sidebar_switch', { tab: item.id });
                  onTabChange(item.id);
                }}
                style={isActive ? {
                  boxShadow: 'inset 0 0 24px rgba(20,184,166,0.07)',
                } : undefined}
                className={`
                  relative flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-all text-left
                  ${isActive
                    ? 'bg-accent/[0.11] text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    className="absolute inset-y-0 left-0 w-[2px] rounded-r"
                    style={{
                      background: 'linear-gradient(180deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,1) 50%, rgba(20,184,166,0.4) 100%)',
                      boxShadow: '0 0 8px 1px rgba(20,184,166,0.4)',
                    }}
                  />
                )}
                <Icon size={15} className="flex-shrink-0" />
                <span className="leading-none">{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom label */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'rgba(20,184,166,0.35)' }}
        >
          XIVRaidPlanner
        </p>
      </div>
    </nav>
  );
}
