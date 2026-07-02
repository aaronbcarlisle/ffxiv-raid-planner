/* eslint-disable design-system/no-raw-button */
/**
 * Tips Carousel Component
 *
 * Shows cycling tips and tricks in a subtle, non-intrusive way.
 * Tips rotate every 15 seconds and are context-aware based on current page.
 * Click the tip text to cycle to the next tip.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, X } from 'lucide-react';
import { Tooltip } from '../primitives/Tooltip';

type MembershipRole = 'owner' | 'lead' | 'member' | 'viewer';

interface Tip {
  id: string;
  textKey: string;
  /** Context where this tip is most relevant (optional filter) */
  context?: 'roster' | 'loot' | 'log' | 'summary' | 'global';
  /** Minimum role required to see this tip (defaults to showing to all) */
  requiredRole?: MembershipRole;
}

const TIPS: Tip[] = [
  // Navigation tips (available to all)
  { id: 'shortcuts', textKey: 'tips.shortcuts', context: 'global' },
  { id: 'tabs', textKey: 'tips.tabs', context: 'global' },
  { id: 'statics', textKey: 'tips.statics', context: 'global' },
  { id: 'static-nav', textKey: 'tips.staticNav', context: 'global' },
  { id: 'tier-nav', textKey: 'tips.tierNav', context: 'global' },

  // Roster tips
  { id: 'add-player', textKey: 'tips.addPlayer', context: 'roster', requiredRole: 'lead' },
  { id: 'copy-link', textKey: 'tips.copyLink', context: 'roster' },
  { id: 'group-view', textKey: 'tips.groupView', context: 'roster' },
  { id: 'expand', textKey: 'tips.expand', context: 'roster' },

  // Loot tips (requires edit permission)
  { id: 'log-loot', textKey: 'tips.logLoot', context: 'loot', requiredRole: 'member' },
  { id: 'floor-cleared', textKey: 'tips.floorCleared', context: 'loot', requiredRole: 'member' },
  { id: 'loot-subtabs', textKey: 'tips.lootSubtabs', context: 'loot' },

  // Log tips
  { id: 'log-material', textKey: 'tips.logMaterial', context: 'log', requiredRole: 'member' },
  { id: 'copy-entry', textKey: 'tips.copyEntry', context: 'log' },
  { id: 'go-player', textKey: 'tips.goPlayer', context: 'log' },
  { id: 'grid-toggle', textKey: 'tips.gridToggle', context: 'log' },
  { id: 'week-nav', textKey: 'tips.weekNav', context: 'log' },
  { id: 'expand-all', textKey: 'tips.expandAll', context: 'log' },

  // Management tips (requires elevated permissions)
  { id: 'new-tier', textKey: 'tips.newTier', context: 'global', requiredRole: 'lead' },
  { id: 'settings', textKey: 'tips.settings', context: 'global', requiredRole: 'lead' },
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
  const { t } = useTranslation();
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
      <Tooltip content={t('tips.nextTip')}>
        <button
          onClick={handleCycleNext}
          className={`text-xs text-text-muted/60 hover:text-text-muted transition-all duration-200 cursor-pointer ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {t(currentTip.textKey)}
        </button>
      </Tooltip>
      <Tooltip content={t('tips.dismissTips')}>
        <button
          onClick={handleDismiss}
          className="p-0.5 text-text-muted/30 hover:text-text-muted/60 transition-colors flex-shrink-0"
          aria-label={t('tips.dismissTips')}
        >
          <X className="w-3 h-3" />
        </button>
      </Tooltip>
    </div>
  );
}
