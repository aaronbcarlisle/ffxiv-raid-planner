/**
 * Settings Panel
 *
 * Slide-out panel for static group settings.
 * Tabs: General, Priority, Goals & Farms, Recruitment, Members
 */

import { useState, useCallback, useEffect } from 'react';
import { Settings, ListOrdered, Users, Globe, Target } from 'lucide-react';
import { SlideOutPanel } from '../ui/SlideOutPanel';
import { useSwipe } from '../../hooks/useSwipe';
import { GeneralTab } from './GeneralTab';
import { PriorityTab } from './PriorityTab';
import { RecruitmentTab } from './RecruitmentTab';
import { MembersPanel } from '../static-group/MembersPanel';
import { ObjectiveGoalsPanel } from '../static-group/ObjectiveGoalsPanel';
import { ContentSuggestionsPanel } from '../static-group/ContentSuggestionsPanel';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import type { JoinRequest, StaticGroup, SnapshotPlayer } from '../../types';

export type SettingsTab = 'general' | 'priority' | 'goals' | 'recruitment' | 'members';

const TAB_ORDER: SettingsTab[] = ['general', 'priority', 'goals', 'recruitment', 'members'];

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: typeof Settings;
}

const TAB_ITEMS: TabItem[] = [
  { id: 'general',     label: 'General',        icon: Settings },
  { id: 'priority',    label: 'Priority',        icon: ListOrdered },
  { id: 'goals',       label: 'Goals & Farms',   icon: Target },
  { id: 'recruitment', label: 'Recruitment',     icon: Globe },
  { id: 'members',     label: 'Members',         icon: Users },
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
  /** Start the roster add flow from an accepted join request */
  onAddToRoster?: (request: JoinRequest) => void;
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
  onAddToRoster,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Sync activeTab with initialTab when it changes (e.g., from keyboard shortcuts)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const canManage = group.userRole === 'owner' || group.userRole === 'lead';
  const pendingCount = useJoinRequestStore((s) => s.pendingCount);

  useEffect(() => {
    if (isOpen && canManage) {
      useJoinRequestStore.getState().fetchGroupRequests(group.id);
    }
  }, [isOpen, canManage, group.id]);

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
        {/* Tabs */}
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
                {tab.id === 'recruitment' && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-accent text-accent-contrast">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
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

          {activeTab === 'goals' && (
            <div className="space-y-6">
              <ObjectiveGoalsPanel groupId={group.id} canManage={canManage} />
              <div className="border-t border-border-default pt-5">
                <ContentSuggestionsPanel groupId={group.id} canManage={canManage} />
              </div>
            </div>
          )}

          {activeTab === 'recruitment' && (
            <RecruitmentTab
              group={group}
              canManage={canManage}
              highlightCreateInvite={highlightCreateInvite}
              onAddToRoster={onAddToRoster}
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
        </div>
      </div>
    </SlideOutPanel>
  );
}
