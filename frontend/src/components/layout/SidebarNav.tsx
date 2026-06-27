/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Users, Trophy, Shield,
  MoreHorizontal, ChevronLeft, ChevronRight, PlugZap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PageMode } from '../../types';
import { analytics } from '../../services/analytics';
import { Tooltip } from '../primitives';

interface SidebarNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  staticName?: string;
}

const COLLAPSED_KEY = 'sidebar-collapsed';

export function SidebarNav({ activeTab, onTabChange, staticName }: SidebarNavProps) {
  const { t } = useTranslation();
  const NAV_ITEMS: Array<{
    id: PageMode;
    label: string;
    description: string;
    shortcut?: string;
    icon: React.FC<{ size?: number; className?: string }>;
  }> = [
    { id: 'overview',  label: t('nav.overview'),      description: t('nav.overviewDesc'),      shortcut: '`',  icon: LayoutDashboard },
    { id: 'schedule',  label: t('nav.schedule'),      description: t('nav.scheduleDesc'),      shortcut: '1',  icon: Calendar },
    { id: 'roster',    label: t('nav.roster'),        description: t('nav.rosterDesc'),        shortcut: '2',  icon: Users },
    { id: 'goals',     label: t('nav.goalsAndFarms'), description: t('nav.goalsAndFarmsDesc'), shortcut: '3',  icon: Trophy },
    { id: 'gear',      label: t('nav.gearAndSync'),   description: t('nav.gearAndSyncDesc'),   shortcut: '4',  icon: Shield },
    { id: 'more',      label: t('nav.more'),          description: t('nav.moreDesc'),                          icon: MoreHorizontal },
  ];

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
      aria-label={t('nav.staticNavigation')}
      className="hidden sm:flex flex-col flex-shrink-0 border-r border-border-subtle overflow-x-hidden overflow-y-auto"
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
      {/* ── Identity header + collapse toggle ── */}
      <div
        className="flex items-center h-12 border-b border-border-subtle flex-shrink-0"
        style={{ background: 'rgba(20,184,166,0.045)' }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={t('nav.expandSidebar')}
            className="w-full h-full flex items-center justify-center text-text-muted hover:text-accent transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <>
            <div className="flex items-center flex-1 min-w-0 px-3 gap-2.5">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(20,184,166,0.18)', boxShadow: '0 0 0 1px rgba(20,184,166,0.2)' }}
              >
                <Shield size={12} className="text-accent" />
              </div>
              <span
                className="text-xs font-semibold text-accent truncate font-display tracking-wide leading-none"
                title={staticName}
              >
                {staticName ?? 'Static'}
              </span>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={t('nav.collapseSidebar')}
              className="flex-shrink-0 px-2.5 h-full flex items-center text-text-muted hover:text-accent transition-colors border-l border-border-subtle"
            >
              <ChevronLeft size={13} />
            </button>
          </>
        )}
      </div>

      {/* ── Nav items ── */}
      <LayoutGroup id="sidebar-static-nav">
        <div className="flex flex-col py-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const showDivider = item.id === 'more';
            return (
              <div key={item.id}>
                {showDivider && <div className="mx-3 my-1.5 border-t border-border-subtle" />}

                <Tooltip
                  content={
                    <div className="max-w-[200px]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-text-primary text-sm">{item.label}</span>
                        {item.shortcut && (
                          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border-subtle bg-surface-base text-text-muted font-mono leading-none flex-shrink-0">
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                    </div>
                  }
                  side="right"
                  sideOffset={collapsed ? 12 : 16}
                  delayDuration={collapsed ? 200 : 700}
                >
                  {/* design-system-ignore: Sidebar nav requires custom active state styling */}
                  <button
                    onClick={() => {
                      analytics.track('navigation', 'sidebar_switch', { tab: item.id });
                      onTabChange(item.id);
                    }}
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
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-static-active-bg"
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'rgba(20,184,166,0.09)',
                          boxShadow: 'inset 0 0 32px rgba(20,184,166,0.1)',
                        }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-static-active-bar"
                        className="absolute inset-y-0 left-0 w-[2.5px] rounded-r pointer-events-none"
                        style={{
                          background: 'linear-gradient(180deg, rgba(20,184,166,0.3) 0%, var(--color-accent) 50%, rgba(20,184,166,0.3) 100%)',
                          boxShadow: '0 0 8px 2px rgba(20,184,166,0.35)',
                        }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    <Icon size={15} className="flex-shrink-0 relative z-10" />
                    {!collapsed && (
                      <span className="leading-none relative z-10 whitespace-nowrap">{item.label}</span>
                    )}
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      {/* ── Plugin footer ── */}
      <div className="border-t border-border-subtle flex-shrink-0">
        <Tooltip
          content={
            <div className="max-w-[200px]">
              <p className="font-semibold text-text-primary text-sm mb-0.5">{t('nav.dalamudPlugin')}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{t('nav.dalamudPluginDesc')}</p>
            </div>
          }
          side="right"
          sideOffset={collapsed ? 12 : 16}
          delayDuration={collapsed ? 200 : 700}
        >
          <button
            type="button"
            onClick={() => {
              analytics.track('navigation', 'sidebar_plugin');
              onTabChange('more');
            }}
            className={`
              w-full flex items-center py-2.5 text-text-muted hover:text-accent transition-colors
              ${collapsed ? 'justify-center' : 'gap-2.5 px-4'}
            `}
          >
            <PlugZap size={13} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] leading-none">
                Plugin
              </span>
            )}
          </button>
        </Tooltip>
      </div>
    </motion.nav>
  );
}
