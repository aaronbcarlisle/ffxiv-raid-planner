/**
 * MobileBottomNav - Bottom navigation bar for small screens
 *
 * Provides thumb-friendly navigation for the main GroupView tabs.
 * Only renders on small screens (< 640px).
 * Supports swipe left/right to change tabs.
 */

import { LayoutDashboard, Users, Trophy, Shield, MoreHorizontal, SlidersHorizontal, Calendar, type LucideProps } from 'lucide-react';
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

const PAGE_TO_SPRITE: Partial<Record<PageMode, keyof typeof TAB_ICONS>> = {};

const PAGE_TO_LUCIDE: Partial<Record<PageMode, LucideIcon>> = {
  overview: LayoutDashboard,
  roster: Users,
  schedule: Calendar,
  goals: Trophy,
  gear: Shield,
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
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-border-default touch-manipulation"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
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
          {TABS.map((tab) => (
            /* design-system-ignore: Bottom nav button requires specific styling */
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center flex-1 h-full min-w-[44px]
                transition-colors
                ${
                  activeTab === tab.id
                    ? 'text-accent'
                    : 'text-text-secondary active:text-text-primary'
                }
              `}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {(() => {
                const LucideIcon = PAGE_TO_LUCIDE[tab.id];
                if (LucideIcon) {
                  return <LucideIcon className={`w-5 h-5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`} />;
                }
                const spriteKey = PAGE_TO_SPRITE[tab.id];
                if (spriteKey) {
                  return (
                    <img
                      src={TAB_ICONS[spriteKey]}
                      alt=""
                      className={`w-5 h-5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}
                    />
                  );
                }
                return null;
              })()}
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
        </div>
      </nav>
  );
}
