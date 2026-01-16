/**
 * Tips Carousel Component
 *
 * Shows cycling tips and tricks in a subtle, non-intrusive way.
 * Tips rotate every 15 seconds and are context-aware based on current page.
 * Click the tip text to cycle to the next tip.
 */

import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { Tooltip } from '../primitives/Tooltip';

type MembershipRole = 'owner' | 'lead' | 'member' | 'viewer';

interface Tip {
  id: string;
  text: string;
  /** Context where this tip is most relevant (optional filter) */
  context?: 'roster' | 'loot' | 'log' | 'summary' | 'global';
  /** Minimum role required to see this tip (defaults to showing to all) */
  requiredRole?: MembershipRole;
}

const TIPS: Tip[] = [
  // Navigation tips (available to all)
  { id: 'shortcuts', text: 'Press Shift+? to see all keyboard shortcuts', context: 'global' },
  { id: 'tabs', text: 'Press 1-4 to switch tabs', context: 'global' },
  { id: 'statics', text: 'Press Shift+S to return to My Statics', context: 'global' },
  { id: 'static-nav', text: 'Press Ctrl+[ or Ctrl+] to switch statics', context: 'global' },
  { id: 'tier-nav', text: 'Press Alt+[ or Alt+] to switch tiers', context: 'global' },

  // Roster tips
  { id: 'add-player', text: 'Press Alt+Shift+P to add a new player', context: 'roster', requiredRole: 'lead' },
  { id: 'copy-link', text: 'Shift+Click a player card to copy link', context: 'roster' },
  { id: 'group-view', text: 'Press G to toggle G1/G2 view', context: 'roster' },
  { id: 'expand', text: 'Press V to toggle compact/expanded', context: 'roster' },

  // Loot tips (requires edit permission)
  { id: 'log-loot', text: 'Press Alt+L to log a loot drop', context: 'loot', requiredRole: 'member' },
  { id: 'floor-cleared', text: 'Press Alt+B to mark floor cleared', context: 'loot', requiredRole: 'member' },
  { id: 'loot-subtabs', text: 'Press Alt+1-3 to switch sub tabs', context: 'loot' },

  // Log tips
  { id: 'log-material', text: 'Press Alt+M to log material', context: 'log', requiredRole: 'member' },
  { id: 'copy-entry', text: 'Shift+Click entry to copy link', context: 'log' },
  { id: 'go-player', text: 'Alt+Click entry to jump to player', context: 'log' },
  { id: 'grid-toggle', text: 'Press G to toggle grid/list view', context: 'log' },
  { id: 'week-nav', text: 'Press Alt+← or Alt+→ to change week', context: 'log' },
  { id: 'expand-all', text: 'Press V to expand/collapse all', context: 'log' },

  // Management tips (requires elevated permissions)
  { id: 'new-tier', text: 'Press Alt+Shift+N to create a new tier', context: 'global', requiredRole: 'lead' },
  { id: 'settings', text: 'Press Alt+Shift+S for static settings', context: 'global', requiredRole: 'lead' },
];

const STORAGE_KEY = 'tips-dismissed';
const CYCLE_INTERVAL = 15000; // 15 seconds

interface TipsCarouselProps {
  /** Current page context for filtering tips */
  context?: 'roster' | 'loot' | 'log' | 'summary';
  /** User's current role for permission-aware filtering */
  userRole?: MembershipRole;
  /** Custom class name */
  className?: string;
}

// Role hierarchy for permission comparison
const ROLE_HIERARCHY: MembershipRole[] = ['viewer', 'member', 'lead', 'owner'];

export function TipsCarousel({ context, userRole, className = '' }: TipsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isVisible, setIsVisible] = useState(true);

  // Filter tips based on context and user role
  const relevantTips = TIPS.filter(tip => {
    // Context filter: show context-specific tips + global tips
    const contextMatch = !tip.context || tip.context === 'global' || tip.context === context;
    if (!contextMatch) return false;

    // Permission filter: check if user has required role
    if (tip.requiredRole) {
      const requiredLevel = ROLE_HIERARCHY.indexOf(tip.requiredRole);
      const userLevel = userRole ? ROLE_HIERARCHY.indexOf(userRole) : -1;
      if (userLevel < requiredLevel) return false;
    }

    return true;
  });

  // Cycle through tips
  useEffect(() => {
    if (isDismissed || relevantTips.length === 0) return;

    const interval = setInterval(() => {
      setIsVisible(false);
      // Fade out, change tip, fade in
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % relevantTips.length);
        setIsVisible(true);
      }, 300);
    }, CYCLE_INTERVAL);

    return () => clearInterval(interval);
  }, [isDismissed, relevantTips.length]);

  // Reset index when context changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset derived state when context prop changes
    setCurrentIndex(0);
  }, [context]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Click to cycle to next tip
  const handleCycleNext = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % relevantTips.length);
      setIsVisible(true);
    }, 150);
  }, [relevantTips.length]);

  if (isDismissed || relevantTips.length === 0) {
    return null;
  }

  const currentTip = relevantTips[currentIndex % relevantTips.length];

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Lightbulb className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
      <Tooltip content="Click for next tip">
        <button
          onClick={handleCycleNext}
          className={`text-xs text-text-muted/60 hover:text-text-muted transition-all duration-200 cursor-pointer ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {currentTip.text}
        </button>
      </Tooltip>
      <Tooltip content="Dismiss tips">
        <button
          onClick={handleDismiss}
          className="p-0.5 text-text-muted/30 hover:text-text-muted/60 transition-colors flex-shrink-0"
          aria-label="Dismiss tips"
        >
          <X className="w-3 h-3" />
        </button>
      </Tooltip>
    </div>
  );
}
