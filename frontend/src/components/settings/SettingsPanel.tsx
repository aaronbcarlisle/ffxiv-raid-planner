/**
 * Settings Panel
 *
 * Slide-out panel for static group settings.
 * Tabs: General, Priority, Goals & Farms, Recruitment, Members
 *
 * Goals & Farms and Recruitment each have their own sub-navigation.
 */

/* eslint-disable design-system/no-raw-button */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, ListOrdered, Users, Globe, Target, Shield, Plus, Trash2 } from 'lucide-react';
import { SettingsSubNav } from './SettingsSubNav';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { SlideOutPanel } from '../ui/SlideOutPanel';
import { useSwipe } from '../../hooks/useSwipe';
import { StaticTab } from './StaticTab';
import { GeneralTab } from './GeneralTab';
import { PriorityTab } from './PriorityTab';
import { RecruitmentTab, type RecruitmentSection } from './RecruitmentTab';
import { MembersPanel } from '../static-group/MembersPanel';
import { ObjectiveGoalsPanel } from '../static-group/ObjectiveGoalsPanel';
import { ContentSuggestionsPanel } from '../static-group/ContentSuggestionsPanel';
import { CreateCollectionGoalModal } from '../static-group/CreateCollectionGoalModal';
import { Button, IconButton } from '../primitives';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useContentSuggestionStore } from '../../stores/contentSuggestionStore';
import { useModal } from '../../hooks/useModal';
import type { JoinRequest, StaticGroup, SnapshotPlayer } from '../../types';

export type SettingsTab = 'general' | 'static' | 'priority' | 'goals' | 'recruitment' | 'members';
const GOALS_SECTION_VALUES = ['overview', 'objectives', 'farms', 'suggestions'] as const;
type GoalsSection = (typeof GOALS_SECTION_VALUES)[number];

export type { RecruitmentSection };

type Role = StaticGroup['userRole'];
const isManager = (r: Role, isAdmin?: boolean) => r === 'owner' || r === 'lead' || !!isAdmin;
const isMemberRole = (r: Role) => r === 'member';

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: typeof Settings;
  /** Whether the tab is visible for this role. */
  visible: (r: Role, isAdmin?: boolean) => boolean;
}

// Role → tab visibility. General/Goals/Members show for everyone (Members is
// read-only below manager); Static/Recruitment are managers-only; Priority is
// manager-edit or member-read-only (hidden from viewers).
const ALL_TABS: TabItem[] = [
  { id: 'general',     label: 'General',       icon: Settings,    visible: () => true },
  { id: 'static',      label: 'Static',        icon: Shield,      visible: (r, a) => isManager(r, a) },
  { id: 'priority',    label: 'Priority',      icon: ListOrdered, visible: (r, a) => isManager(r, a) || isMemberRole(r) },
  { id: 'goals',       label: 'Goals & Farms', icon: Target,      visible: () => true },
  { id: 'recruitment', label: 'Recruitment',   icon: Globe,       visible: (r, a) => isManager(r, a) },
  { id: 'members',     label: 'Members',       icon: Users,       visible: () => true },
];

const ALL_TAB_IDS: SettingsTab[] = ALL_TABS.map((t) => t.id);

// ─── Goals & Farms sub-nav ───────────────────────────────────────────────────

const GOALS_SECTIONS: { id: GoalsSection; label: string }[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'objectives',  label: 'Objectives' },
  { id: 'farms',       label: 'Farms' },
  { id: 'suggestions', label: 'Suggestions' },
];

// ─── Goals Overview section ──────────────────────────────────────────────────

function GoalsOverview({
  onNavigate,
}: {
  onNavigate: (s: GoalsSection) => void;
}) {
  const { objectives } = useObjectiveGoalStore();
  const { goals } = useCollectionGoalStore();
  const { suggestions } = useContentSuggestionStore();

  const openSuggestions = suggestions.filter((s) => s.status === 'open').length;
  const activeFarms = goals.filter((g) => g.status === 'farming' || g.status === 'scheduled').length;

  const cards = [
    {
      label: 'Objectives',
      value: objectives.length,
      sub: objectives.length > 0 ? `${objectives.length} goal${objectives.length !== 1 ? 's' : ''} set` : 'None set',
      section: 'objectives' as GoalsSection,
      cta: 'Manage objectives →',
    },
    {
      label: 'Active Farms',
      value: activeFarms,
      sub: goals.length > 0 ? `${goals.length} total tracked` : 'None tracked',
      section: 'farms' as GoalsSection,
      cta: 'Manage farms →',
    },
    {
      label: 'Open Suggestions',
      value: openSuggestions,
      sub: suggestions.length > 0 ? `${suggestions.length} total` : 'None submitted',
      section: 'suggestions' as GoalsSection,
      cta: 'View suggestions →',
    },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3" style={{ scrollbarGutter: 'stable' }}>
      {cards.map((card) => (
        <div
          key={card.section}
          className="rounded-xl border border-border-default bg-surface-elevated p-4 flex items-center gap-4"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{card.label}</p>
            <p className="text-2xl font-bold text-text-primary mt-0.5">{card.value}</p>
            <p className="text-xs text-text-muted">{card.sub}</p>
          </div>
          <button
            type="button"
            className="text-xs text-accent hover:underline flex-shrink-0"
            onClick={() => onNavigate(card.section)}
          >
            {card.cta}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Collection Goals (Farms) section ───────────────────────────────────────

function CollectionGoalsSection({
  groupId,
  canManage,
}: {
  groupId: string;
  canManage: boolean;
}) {
  const { goals, isLoading, fetchGoals, deleteGoal } = useCollectionGoalStore();
  const createModal = useModal();

  useEffect(() => {
    fetchGoals(groupId);
  }, [groupId, fetchGoals]);

  const STATUS_LABEL: Record<string, string> = {
    wanted: 'Wanted',
    farming: 'Farming',
    scheduled: 'Scheduled',
    complete: 'Complete',
  };

  const STATUS_COLOR: Record<string, string> = {
    wanted: 'text-text-secondary',
    farming: 'text-status-info',
    scheduled: 'text-accent',
    complete: 'text-status-success',
  };

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Collection Goals</p>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="w-3 h-3" />}
              onClick={createModal.open}
            >
              New Farm
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-10 text-center"
            data-testid="collection-goals-empty-heading"
          >
            <Target className="w-8 h-8 text-text-muted opacity-30" />
            <p className="text-sm font-medium text-text-secondary">No active farms</p>
            <p className="text-xs text-text-muted">Track mount farms, tokens, and other group goals.</p>
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={createModal.open}
                data-testid="create-collection-goal-btn"
              >
                Start Tracking
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="group flex items-center gap-3 rounded-lg border border-border-default bg-surface-elevated px-3 py-2.5"
                data-testid="collection-goal-row"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{goal.title}</p>
                  <p className={`text-xs ${STATUS_COLOR[goal.status] ?? 'text-text-muted'}`}>
                    {STATUS_LABEL[goal.status] ?? goal.status}
                    {goal.currentCount !== null && goal.targetCount !== null
                      ? ` · ${goal.currentCount}/${goal.targetCount}`
                      : null}
                  </p>
                </div>
                {canManage && (
                  <IconButton
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    aria-label="Delete"
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-status-error"
                    onClick={() => deleteGoal(groupId, goal.id)}
                  />
                )}
              </div>
            ))}
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={createModal.open}
                className="w-full justify-center mt-1"
                data-testid="create-collection-goal-btn"
              >
                Add Farm
              </Button>
            )}
          </div>
        )}
      </div>

      <CreateCollectionGoalModal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        groupId={groupId}
      />
    </>
  );
}

// ─── Goals & Farms tab content ────────────────────────────────────────────────

function GoalsFarmsTabContent({
  groupId,
  canManage,
}: {
  groupId: string;
  canManage: boolean;
}) {
  // Section in the URL (?gsub=overview|objectives|farms|suggestions). Each
  // settings tab uses its own sub-tab param (gsub/psub/rcsub) so switching main
  // tabs can't carry a stale section across. Pushes; closing the panel collapses
  // its sub-history.
  const [section, setSection] = useUrlTabState('gsub', GOALS_SECTION_VALUES, 'overview');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <SettingsSubNav active={section} onChange={setSection} items={GOALS_SECTIONS} />

      <div className="flex flex-col flex-1 min-h-0">
        {section === 'overview' && (
          <GoalsOverview onNavigate={setSection} />
        )}

        {section === 'objectives' && (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
            <ObjectiveGoalsPanel groupId={groupId} canManage={canManage} />
          </div>
        )}

        {section === 'farms' && (
          <CollectionGoalsSection groupId={groupId} canManage={canManage} />
        )}

        {section === 'suggestions' && (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
            <ContentSuggestionsPanel groupId={groupId} canManage={canManage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  group: StaticGroup;
  players: SnapshotPlayer[];
  tierId?: string;
  isAdmin?: boolean;
  /** Initial tab to show when panel opens */
  initialTab?: SettingsTab;
  /** Override the initial Recruitment sub-section (e.g. from badge routing). */
  initialRecruitmentSection?: RecruitmentSection;
  /** Whether to highlight the create invitation button */
  highlightCreateInvite?: boolean;
  /** Start the roster add flow from an accepted join request */
  onAddToRoster?: (request: JoinRequest) => void;
  /**
   * Where the panel is rendered. `'slideout'` (default) wraps the body in the
   * full-overlay `SlideOutPanel` (mobile); `'dock'` renders the body bare so a
   * `RightDockPanel` can supply the chrome (desktop).
   */
  container?: 'slideout' | 'dock';
}

export function SettingsPanel({
  isOpen,
  onClose,
  group,
  players,
  tierId,
  isAdmin,
  initialTab = 'general',
  initialRecruitmentSection,
  highlightCreateInvite = false,
  onAddToRoster,
  container = 'slideout',
}: SettingsPanelProps) {
  // Active tab lives in the URL (?settings=<tab>) via the shared hook, so the
  // panel is deep-linkable and follows browser back/forward. The `settings`
  // param is cleared on close in GroupView (useGroupViewState).
  const [activeTab, setActiveTab] = useUrlTabState('settings', ALL_TAB_IDS, 'general');

  // Event-driven open-to-tab (header buttons / badge routing) arrives via the
  // initialTab prop. Reflect it into the URL when the panel opens, or when a
  // changed initialTab is routed in while already open — via REPLACE so opening
  // directly to a tab doesn't leave a phantom history entry (user-driven tab
  // clicks still push, so back steps through them). On open we don't clobber a
  // ?settings already pinned by a deep-link / back entry.
  const [, setSearchParams] = useSearchParams();
  const prevInitialTab = useRef(initialTab);
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const tabChanged = isOpen && initialTab !== prevInitialTab.current;
    if (justOpened || tabChanged) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        // A deep-link / back entry that already pins ?settings wins over the
        // prop default when the panel is merely (re)opening.
        if (justOpened && !tabChanged && params.get('settings')) return prev;
        params.set('settings', initialTab);
        return params;
      }, { replace: true });
    }
    prevInitialTab.current = initialTab;
    wasOpenRef.current = isOpen;
  }, [isOpen, initialTab, setSearchParams]);

  const role = group.userRole;
  const canManage = isManager(role, isAdmin);
  // Tabs filtered by role; clamp the active tab into the visible set (a deep
  // link to a tab the role can't see falls back to General). Memoized so the
  // arrays are stable across renders (keeps navigateTab's memoization intact).
  const visibleTabs = useMemo(() => ALL_TABS.filter((t) => t.visible(role, isAdmin)), [role, isAdmin]);
  const tabOrder = useMemo(() => visibleTabs.map((t) => t.id), [visibleTabs]);
  const effectiveTab: SettingsTab = tabOrder.includes(activeTab) ? activeTab : 'general';
  const pendingCount = useJoinRequestStore((s) => s.pendingCount);

  useEffect(() => {
    if (isOpen && canManage) {
      useJoinRequestStore.getState().fetchGroupRequests(group.id);
    }
  }, [isOpen, canManage, group.id]);

  // Navigate to next/previous visible tab
  const navigateTab = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = tabOrder.indexOf(effectiveTab);
    if (direction === 'next' && currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  }, [tabOrder, effectiveTab, setActiveTab]);

  // Swipe handlers for tab navigation
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => navigateTab('next'),
    onSwipeRight: () => navigateTab('prev'),
    minSwipeDistance: 50,
  });

  const body = (
      <div className={`flex flex-col ${container === 'dock' ? 'h-full' : 'h-[calc(100%+2rem)] -m-4'}`}>
        {/* Tabs (filtered by role) */}
        <div className="flex border-b border-border-default px-4 overflow-x-auto overflow-y-hidden scrollbar-none flex-shrink-0">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              /* design-system-ignore: Tab selector with border-bottom active indicator */
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  effectiveTab === tab.id
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
          {effectiveTab === 'general' && <GeneralTab />}

          {effectiveTab === 'static' && (
            <StaticTab
              group={group}
              onClose={onClose}
            />
          )}

          {effectiveTab === 'priority' && (
            <PriorityTab
              group={group}
              players={players}
              tierId={tierId}
              onClose={onClose}
              readOnly={!canManage}
            />
          )}

          {effectiveTab === 'goals' && (
            <GoalsFarmsTabContent groupId={group.id} canManage={canManage} />
          )}

          {effectiveTab === 'recruitment' && (
            <RecruitmentTab
              key={initialRecruitmentSection ?? 'default'}
              group={group}
              canManage={canManage}
              highlightCreateInvite={highlightCreateInvite}
              onAddToRoster={onAddToRoster}
              onClose={onClose}
              initialSection={initialRecruitmentSection}
            />
          )}

          {effectiveTab === 'members' && (
            <MembersPanel
              groupId={group.id}
              currentUserRole={group.userRole}
              isAdmin={isAdmin}
              readOnly={!canManage}
            />
          )}
        </div>
      </div>
  );

  if (container === 'dock') return body;

  return (
    <SlideOutPanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Settings
        </span>
      }
      width="3xl"
    >
      {body}
    </SlideOutPanel>
  );
}
