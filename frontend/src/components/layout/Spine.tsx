import { useRef } from 'react';
import type { FC, KeyboardEvent } from 'react';
import type { PageMode } from '../../types';
import { LayoutDashboard, Users, Shield, Calendar } from 'lucide-react';
import { analytics } from '../../services/analytics';

interface SpineProps {
  /**
   * The selected tab, or `null` when the shell is on a page outside the four
   * (the Recruiting route, R-RH-G): then no tab is selected, the first tab
   * keeps the tablist reachable (M14), and any arrow/Home/End activates it.
   */
  activeTab: PageMode | null;
  onTabChange: (tab: PageMode) => void;
}

const SPINE_TABS: { id: PageMode; label: string; Icon: FC<{ size?: number }> }[] = [
  { id: 'overview', label: 'Home', Icon: LayoutDashboard },
  { id: 'roster',   label: 'Roster', Icon: Users },
  { id: 'gear',     label: 'Loot', Icon: Shield },
  { id: 'schedule', label: 'Schedule', Icon: Calendar },
];

const NAV_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End']);

export function Spine({ activeTab, onTabChange }: SpineProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = activeTab === null ? -1 : SPINE_TABS.findIndex(t => t.id === activeTab);

  const activate = (id: PageMode) => {
    analytics.track('navigation', 'tab_switch', { tab: id, surface: 'spine' });
    onTabChange(id);
  };

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!NAV_KEYS.has(e.key)) return;
    let nextIndex: number;

    if (activeIndex === -1) {
      // No selected tab (off-page): every navigation key lands on the first tab.
      nextIndex = 0;
    } else {
      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (activeIndex + 1) % SPINE_TABS.length;
          break;
        case 'ArrowLeft':
          nextIndex = (activeIndex - 1 + SPINE_TABS.length) % SPINE_TABS.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        default: // 'End'
          nextIndex = SPINE_TABS.length - 1;
          break;
      }
    }

    e.preventDefault();
    const nextTab = SPINE_TABS[nextIndex];
    activate(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Main content sections"
      className="flex border-b border-border-default bg-surface-base"
      onKeyDown={handleKeyDown}
    >
      {SPINE_TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        // Roving tabindex: the selected tab is the one Tab stop; with nothing
        // selected the first tab takes it so the tablist stays reachable.
        const isTabStop = activeIndex === -1 ? index === 0 : isActive;
        return (
          /* design-system-ignore: spine tab requires toggle styling */
          <button
            key={tab.id}
            ref={el => { tabRefs.current[index] = el; }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isTabStop ? 0 : -1}
            onClick={() => activate(tab.id)}
            className={[
              'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              'after:content-[\'\'] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-colors',
              isActive
                ? 'text-accent after:bg-accent'
                : 'text-text-secondary hover:text-text-primary after:bg-transparent',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={`flex-shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-45'}`}
            >
              <tab.Icon size={18} />
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
