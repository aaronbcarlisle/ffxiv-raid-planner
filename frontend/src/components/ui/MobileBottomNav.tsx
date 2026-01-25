/**
 * MobileBottomNav - Bottom navigation bar for small screens
 *
 * Provides thumb-friendly navigation for the main GroupView tabs.
 * Only renders on small screens (< 640px).
 */

import { SlidersHorizontal } from 'lucide-react';
import type { PageMode } from '../../types';
import { TAB_ICONS } from '../../types';
import { useDevice } from '../../hooks/useDevice';

interface MobileBottomNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  onControlsClick?: () => void;
}

// Map PageMode to TAB_ICONS keys
const PAGE_TO_ICON: Record<PageMode, keyof typeof TAB_ICONS> = {
  players: 'party',
  loot: 'loot',
  stats: 'stats',
  history: 'history',
};

const TABS: { id: PageMode; label: string }[] = [
  { id: 'players', label: 'Roster' },
  { id: 'loot', label: 'Loot' },
  { id: 'history', label: 'Log' },
  { id: 'stats', label: 'Summary' },
];

export function MobileBottomNav({ activeTab, onTabChange, onControlsClick }: MobileBottomNavProps) {
  const { isSmallScreen } = useDevice();

  // Only render on small screens
  if (!isSmallScreen) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-border-default pb-safe"
      aria-label="Main navigation"
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
              <img
                src={TAB_ICONS[PAGE_TO_ICON[tab.id]]}
                alt=""
                className={`w-5 h-5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}
              />
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
