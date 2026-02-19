/**
 * Settings Panel
 *
 * Slide-out panel for static group settings.
 * Tabs: General, Priority, Members, Invitations
 */

import { useState, useCallback, useEffect } from 'react';
import { Settings, ListOrdered, Users, Mail } from 'lucide-react';
import { SlideOutPanel } from '../ui/SlideOutPanel';
import { useSwipe } from '../../hooks/useSwipe';
import { GeneralTab } from './GeneralTab';
import { PriorityTab } from './PriorityTab';
import { MembersPanel } from '../static-group/MembersPanel';
import { InvitationsPanel } from '../static-group/InvitationsPanel';
import type { StaticGroup, SnapshotPlayer } from '../../types';

export type SettingsTab = 'general' | 'priority' | 'members' | 'invitations';

const TAB_ORDER: SettingsTab[] = ['general', 'priority', 'members', 'invitations'];

const TAB_ITEMS = [
  { id: 'general' as const, label: 'General', icon: Settings },
  { id: 'priority' as const, label: 'Priority', icon: ListOrdered },
  { id: 'members' as const, label: 'Members', icon: Users },
  { id: 'invitations' as const, label: 'Invitations', icon: Mail },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  group: StaticGroup;
  players: SnapshotPlayer[];
  tierId?: string;
  isAdmin?: boolean;
  /** Initial tab to show when panel opens */
  initialTab?: SettingsTab;
  /** Whether to highlight the create invitation button */
  highlightCreateInvite?: boolean;
}

export function SettingsPanel({
  isOpen,
  onClose,
  group,
  players,
  tierId,
  isAdmin,
  initialTab = 'general',
  highlightCreateInvite = false,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Sync activeTab with initialTab when it changes (e.g., from keyboard shortcuts)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const canManageInvitations = group.userRole === 'owner' || group.userRole === 'lead';

  // Navigate to next/previous tab
  const navigateTab = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (direction === 'next' && currentIndex < TAB_ORDER.length - 1) {
      setActiveTab(TAB_ORDER[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setActiveTab(TAB_ORDER[currentIndex - 1]);
    }
  }, [activeTab]);

  // Swipe handlers for tab navigation
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => navigateTab('next'),
    onSwipeRight: () => navigateTab('prev'),
    minSwipeDistance: 50,
  });

  return (
    <SlideOutPanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Static Settings
        </span>
      }
      width="3xl"
    >
      <div className="flex flex-col h-[calc(100%+2rem)] -m-4">
        {/* Tabs - scrollable on mobile */}
        <div className="flex border-b border-border-default px-4 overflow-x-auto overflow-y-hidden scrollbar-none flex-shrink-0">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            return (
              /* design-system-ignore: Tab selector with border-bottom active indicator */
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-accent border-b-2 border-accent -mb-[1px]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content - swipeable on mobile */}
        <div className="flex-1 min-h-0 px-4 pt-4 flex flex-col overflow-x-hidden" {...swipeHandlers}>
          {activeTab === 'general' && (
            <GeneralTab
              group={group}
              onClose={onClose}
            />
          )}

          {activeTab === 'priority' && (
            <PriorityTab
              group={group}
              players={players}
              tierId={tierId}
              onClose={onClose}
            />
          )}

          {activeTab === 'members' && (
            <MembersPanel
              groupId={group.id}
              currentUserRole={group.userRole}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'invitations' && (
            <InvitationsPanel
              groupId={group.id}
              canManage={canManageInvitations}
              highlightCreateButton={highlightCreateInvite}
            />
          )}
        </div>
      </div>
    </SlideOutPanel>
  );
}
