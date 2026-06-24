/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Users, Trophy, Shield,
  MoreHorizontal, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { PageMode } from '../../types';
import { analytics } from '../../services/analytics';

interface SidebarNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  staticName?: string;
}

const NAV_ITEMS: Array<{ id: PageMode; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
  { id: 'overview',  label: 'Overview',      icon: LayoutDashboard },
  { id: 'schedule',  label: 'Schedule',      icon: Calendar },
  { id: 'roster',    label: 'Roster',        icon: Users },
  { id: 'goals',     label: 'Goals & Farms', icon: Trophy },
  { id: 'gear',      label: 'Gear & Sync',   icon: Shield },
  { id: 'more',      label: 'More',          icon: MoreHorizontal },
];

const COLLAPSED_KEY = 'sidebar-collapsed';

export function SidebarNav({ activeTab, onTabChange, staticName }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <motion.nav
      aria-label="Static navigation"
      className="hidden sm:flex flex-col flex-shrink-0 border-r border-border-subtle overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0c0c14 0%, #090910 60%, #07070e 100%)',
        width: collapsed ? 56 : 208,
        minWidth: collapsed ? 56 : 208,
      }}
      variants={{
        expanded: { width: 208, minWidth: 208 },
        collapsed: { width: 56, minWidth: 56 },
      }}
      animate={collapsed ? 'collapsed' : 'expanded'}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* ── Identity header ── */}
      <div
        className="flex items-center h-12 border-b border-border-subtle flex-shrink-0"
        style={{ background: 'rgba(20,184,166,0.045)' }}
      >
        <div className={`flex items-center min-w-0 w-full ${collapsed ? 'justify-center' : 'px-4 gap-2.5'}`}>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(20,184,166,0.18)', boxShadow: '0 0 0 1px rgba(20,184,166,0.2)' }}
          >
            <Shield size={12} className="text-accent" />
          </div>
          {!collapsed && (
            <span
              className="text-xs font-semibold text-accent truncate font-display tracking-wide leading-none"
              title={staticName}
            >
              {staticName ?? 'Static'}
            </span>
          )}
        </div>
      </div>

      {/* ── Nav items ── */}
      <div className="flex flex-col py-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const showDivider = item.id === 'more';
          return (
            <div key={item.id}>
              {showDivider && <div className="mx-3 my-1.5 border-t border-border-subtle" />}

              {/* design-system-ignore: Sidebar nav requires custom active state styling */}
              <button
                onClick={() => {
                  analytics.track('navigation', 'sidebar_switch', { tab: item.id });
                  onTabChange(item.id);
                }}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  relative flex items-center w-full py-2.5 text-sm font-medium text-left
                  transition-colors duration-150 select-none
                  ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}
                  ${isActive
                    ? 'text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.035]'
                  }
                `}
              >
                {/* Active background — CSS opacity transition, no layoutId */}
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'rgba(20,184,166,0.09)',
                    boxShadow: 'inset 0 0 32px rgba(20,184,166,0.1)',
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity 150ms ease',
                  }}
                />

                {/* Left accent bar — CSS opacity transition, no layoutId */}
                <span
                  className="absolute inset-y-0 left-0 w-[2.5px] rounded-r pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(20,184,166,0.3) 0%, #14b8a6 50%, rgba(20,184,166,0.3) 100%)',
                    boxShadow: '0 0 8px 2px rgba(20,184,166,0.35)',
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity 150ms ease',
                  }}
                />

                <Icon size={15} className="flex-shrink-0 relative z-10" />
                {!collapsed && (
                  <span className="leading-none relative z-10 whitespace-nowrap">{item.label}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Footer: collapse toggle ── */}
      <div className="border-t border-border-subtle flex-shrink-0">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`
            w-full flex items-center py-3 text-text-muted hover:text-accent transition-colors
            ${collapsed ? 'justify-center' : 'px-4 gap-2'}
          `}
        >
          {collapsed
            ? <ChevronRight size={13} />
            : (
              <>
                <ChevronLeft size={13} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                  XIVRaidPlanner
                </span>
              </>
            )
          }
        </button>
      </div>
    </motion.nav>
  );
}
