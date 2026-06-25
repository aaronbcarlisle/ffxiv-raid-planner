/**
 * MobileBottomNav - Bottom navigation bar for small screens
 *
 * Provides thumb-friendly navigation for the main GroupView tabs.
 * Only renders on small screens (< 640px).
 * Supports swipe left/right to change tabs.
 */

import { LayoutDashboard, MoreHorizontal, SlidersHorizontal, type LucideProps } from 'lucide-react';
import type { PageMode } from '../../types';
import { TAB_ICONS } from '../../types';
import { useDevice } from '../../hooks/useDevice';
import { useSwipe } from '../../hooks/useSwipe';

interface MobileBottomNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  onControlsClick?: () => void;
}

type LucideIcon = React.FC<LucideProps>;

const PAGE_TO_SPRITE: Partial<Record<PageMode, keyof typeof TAB_ICONS>> = {
  roster:   'party',
  schedule: 'schedule',
  goals:    'mountFarms',
  gear:     'loot',
};

const PAGE_TO_LUCIDE: Partial<Record<PageMode, LucideIcon>> = {
  overview: LayoutDashboard,
  more: MoreHorizontal,
};

const BASE_TABS: { id: PageMode; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'roster', label: 'Roster' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'goals', label: 'Goals' },
  { id: 'gear', label: 'Gear' },
  { id: 'more', label: 'More' },
];

export function MobileBottomNav({ activeTab, onTabChange, onControlsClick }: MobileBottomNavProps) {
  const { isSmallScreen } = useDevice();
  const TABS = BASE_TABS;

  // Swipe handlers for tab navigation
  const tabIds = TABS.map(t => t.id);
  const currentTabIndex = tabIds.indexOf(activeTab);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      // Swipe left = go to next tab
      if (currentTabIndex < tabIds.length - 1) {
        onTabChange(tabIds[currentTabIndex + 1]);
      }
    },
    onSwipeRight: () => {
      // Swipe right = go to previous tab
      if (currentTabIndex > 0) {
        onTabChange(tabIds[currentTabIndex - 1]);
      }
    },
    minSwipeDistance: 50,
  });

  // Only render on small screens
  if (!isSmallScreen) return null;

  return (
    <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface-raised border-t border-border-default touch-manipulation"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)', boxShadow: '0 -1px 0 rgba(20,184,166,0.06), 0 -8px 24px rgba(0,0,0,0.4)' }}
        aria-label="Main navigation"
        {...swipeHandlers}
      >
        <div className="flex items-center h-14">
        {/* Controls button - left side */}
        {onControlsClick && (
          /* design-system-ignore: Bottom nav button requires specific styling */
          <button
            onClick={onControlsClick}
            className="flex flex-col items-center justify-center h-full w-16 border-r border-border-default text-text-secondary active:text-accent transition-colors"
            aria-label="Controls"
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Controls</span>
          </button>
        )}

        {/* Tab navigation - fills remaining space */}
        <div className="flex justify-around items-center flex-1 h-full">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              /* design-system-ignore: Bottom nav button requires specific styling */
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex flex-col items-center justify-center flex-1 h-full min-w-[44px]
                  transition-colors
                  ${isActive ? 'text-accent' : 'text-text-secondary active:text-text-primary'}
                `}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active top indicator */}
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.9), transparent)' }}
                  />
                )}
                {(() => {
                  const LucideIcon = PAGE_TO_LUCIDE[tab.id];
                  if (LucideIcon) {
                    return <LucideIcon className={`w-5 h-5 ${isActive ? 'opacity-100' : 'opacity-55'}`} />;
                  }
                  const spriteKey = PAGE_TO_SPRITE[tab.id];
                  if (spriteKey) {
                    return (
                      <img
                        src={TAB_ICONS[spriteKey]}
                        alt=""
                        className={`w-5 h-5 ${isActive ? 'opacity-100' : 'opacity-55'}`}
                      />
                    );
                  }
                  return null;
                })()}
                <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'font-semibold' : ''}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
        </div>
      </nav>
  );
}
