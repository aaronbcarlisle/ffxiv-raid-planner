/**
 * ProfileBottomNav — Mobile bottom navigation for Player Hub
 *
 * Mirrors the static page MobileBottomNav pattern: fixed bottom bar,
 * dark background, safe-area padding, icon + label for each section.
 * Only renders on small screens (< 640px via useDevice).
 */

import { MoreHorizontal, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDevice } from '../../hooks/useDevice';
import { TAB_ICONS } from '../../types';

type ProfileTab = 'overview' | 'sync' | 'jobs-gear' | 'collections' | 'availability' | 'preview';

interface ProfileBottomNavProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  primaryStaticPath?: string;
  primaryStaticName?: string;
}

const PRIMARY_TABS: { id: ProfileTab; labelKey: string; icon: keyof typeof TAB_ICONS }[] = [
  { id: 'overview', labelKey: 'profile.tabOverview', icon: 'playerOverview' },
  { id: 'sync', labelKey: 'profile.tabSync', icon: 'playerSync' },
  { id: 'jobs-gear', labelKey: 'profile.tabJobsGear', icon: 'playerGear' },
  { id: 'availability', labelKey: 'profile.tabAvail', icon: 'playerAvailability' },
];

const MORE_TABS: { id: ProfileTab; labelKey: string; icon: keyof typeof TAB_ICONS }[] = [
  { id: 'collections', labelKey: 'profile.tabCollections', icon: 'playerHunts' },
  { id: 'preview', labelKey: 'profile.tabShare', icon: 'playerShare' },
];

const ALL_MORE_IDS = new Set(MORE_TABS.map(t => t.id));

export function ProfileBottomNav({ activeTab, onTabChange, primaryStaticPath, primaryStaticName }: ProfileBottomNavProps) {
  const { t } = useTranslation();
  const { isSmallScreen } = useDevice();
  const [showMore, setShowMore] = useState(false);

  if (!isSmallScreen) return null;

  const isMoreActive = ALL_MORE_IDS.has(activeTab);
  const activeMoreTab = MORE_TABS.find(t => t.id === activeTab);

  return (
    <>
      {/* More popover — anchored above the bottom nav */}
      {showMore && (
        <>
          {/* Backdrop */}
          {/* design-system-ignore: Overlay backdrop for bottom sheet */}
          <div
            className="fixed inset-0 z-[45] bg-black/40"
            onClick={() => setShowMore(false)}
            role="presentation"
          />
          {/* Menu — above backdrop and nav bar */}
          <div
            className="fixed bottom-14 left-0 right-0 z-[55] bg-surface-card border-t border-border-default rounded-t-xl shadow-xl"
            style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
          >
            <div className="px-2 py-2 space-y-0.5">
              {primaryStaticPath && (
                /* design-system-ignore: Bottom sheet menu item */
                <Link
                  to={primaryStaticPath}
                  onClick={() => setShowMore(false)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors text-text-secondary hover:text-text-primary hover:bg-surface-interactive"
                >
                  <Users className="w-5 h-5 text-accent flex-shrink-0" />
                  <span className="flex-1 truncate">{primaryStaticName ?? t('profile.backToStatic')}</span>
                  <span className="text-xs text-text-tertiary flex-shrink-0">{t('common.back')}</span>
                </Link>
              )}
              {MORE_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  /* design-system-ignore: Bottom sheet menu item */
                  <button
                    key={tab.id}
                    onClick={() => { onTabChange(tab.id); setShowMore(false); }}
                    className={`
                      flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors
                      ${isActive ? 'text-accent bg-accent/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'}
                    `}
                  >
                    <img src={TAB_ICONS[tab.icon]} alt="" className="w-5 h-5" />
                    <span>{t(tab.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[50] bg-surface-card border-t border-border-default touch-manipulation"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
        aria-label="Player Hub navigation"
      >
        <div className="flex items-center justify-around h-14">
          {PRIMARY_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              /* design-system-ignore: Bottom nav button requires specific styling */
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); setShowMore(false); }}
                className={`
                  flex flex-col items-center justify-center flex-1 h-full min-w-[44px]
                  transition-colors
                  ${isActive ? 'text-accent' : 'text-text-secondary active:text-text-primary'}
                `}
                aria-label={t(tab.labelKey)}
                aria-current={isActive ? 'page' : undefined}
              >
                <img
                  src={TAB_ICONS[tab.icon]}
                  alt=""
                  className={`w-5 h-5 ${isActive ? 'opacity-100' : 'opacity-60'}`}
                />
                <span className="text-[10px] mt-0.5 font-medium">{t(tab.labelKey)}</span>
              </button>
            );
          })}

          {/* More button */}
          {/* design-system-ignore: Bottom nav button requires specific styling */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`
              flex flex-col items-center justify-center flex-1 h-full min-w-[44px]
              transition-colors
              ${isMoreActive || showMore ? 'text-accent' : 'text-text-secondary active:text-text-primary'}
            `}
            aria-label="More sections"
            aria-expanded={showMore}
          >
            {isMoreActive && activeMoreTab ? (
              <>
                <img src={TAB_ICONS[activeMoreTab.icon]} alt="" className="w-5 h-5 opacity-100" />
                <span className="text-[10px] mt-0.5 font-medium">{t(activeMoreTab.labelKey)}</span>
              </>
            ) : (
              <>
                <MoreHorizontal className={`w-5 h-5 ${showMore ? 'opacity-100' : 'opacity-60'}`} />
                <span className="text-[10px] mt-0.5 font-medium">{t('profile.tabMore')}</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
