/**
 * SidebarRail — legacy Static-layer collapsible rail (56↔208px).
 *
 * This is the original AppRail implementation, preserved verbatim so that
 * SidebarNav (and the legacy /group/:shareCode route) continues to render
 * byte-for-byte identically after AppRail was rebuilt as the 72px Person-layer
 * rail in Task 7 (F6a). Do NOT add new consumers; use AppRail for new code.
 */

/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import type React from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '../primitives';
import type { RailNavItem } from './railTypes';

interface SidebarRailProps {
  context: string;
  identity: { icon: React.FC<{ size?: number; className?: string }>; label: string };
  items: RailNavItem[];
  collapseKey: string;
  footer?: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
}

export function SidebarRail({ context, identity, items, collapseKey, footer }: SidebarRailProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(collapseKey) === 'true'; } catch { return false; }
  });

  const toggle = () => setCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem(collapseKey, String(next)); } catch { /* ignore */ }
    return next;
  });

  const IdentityIcon = identity.icon;

  return (
    <motion.nav
      aria-label="Application navigation"
      className="hidden sm:flex flex-col flex-shrink-0 border-r border-border-subtle overflow-x-hidden overflow-y-auto"
      style={{
        background: 'var(--gradient-rail)',
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
            aria-label="Expand sidebar"
            className="w-full h-full flex items-center justify-center text-text-muted hover:text-accent transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          /* The whole identity row toggles collapse; the chevron stays as the
             visible affordance (no nested button, so clicks never conflict). */
          <button
            type="button"
            onClick={toggle}
            aria-label="Collapse sidebar"
            className="group/header w-full h-full flex items-center text-left"
          >
            <div className="flex items-center flex-1 min-w-0 px-3 gap-2.5">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(20,184,166,0.18)', boxShadow: '0 0 0 1px rgba(20,184,166,0.2)' }}
              >
                <IdentityIcon size={12} className="text-accent" />
              </div>
              <span
                className="text-xs font-semibold text-accent truncate font-display tracking-wide leading-none"
                title={identity.label}
              >
                {identity.label}
              </span>
            </div>
            <span className="flex-shrink-0 px-2.5 h-full flex items-center text-text-muted group-hover/header:text-accent transition-colors border-l border-border-subtle">
              <ChevronLeft size={13} />
            </span>
          </button>
        )}
      </div>

      {/* ── Nav items ── */}
      <LayoutGroup id={`sidebar-${context}-nav`}>
        <div className="flex flex-col py-2 flex-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id}>
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
                    onClick={item.onSelect}
                    aria-current={item.isActive ? 'page' : undefined}
                    className={`relative flex items-center w-full py-2.5 text-sm font-medium text-left transition-colors duration-150 select-none ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${item.isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.035]'}`}
                  >
                    {item.isActive && (
                      <motion.span
                        layoutId={`sidebar-${context}-active-bg`}
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'rgba(20,184,166,0.09)',
                          boxShadow: 'inset 0 0 32px rgba(20,184,166,0.1)',
                        }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    {item.isActive && (
                      <motion.span
                        layoutId={`sidebar-${context}-active-bar`}
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

      {/* ── Footer (user menu) ── */}
      {footer && (
        <div className="border-t border-border-subtle flex-shrink-0">
          {typeof footer === 'function' ? footer(collapsed) : footer}
        </div>
      )}
    </motion.nav>
  );
}
