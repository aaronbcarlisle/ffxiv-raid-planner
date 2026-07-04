/**
 * useGroupViewKeyboardShortcuts Hook
 *
 * Configures and applies keyboard shortcuts for GroupView.
 * Extracts the large shortcut configuration that was previously inline.
 */

import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { HEADER_EVENTS } from '../components/layout/Header';
import { useGroupActions } from '../pages/groupActionsContext';
import type { PageMode, ViewMode } from '../types';
import type { TierSnapshot, StaticGroup } from '../types';

export interface GroupViewShortcutParams {
  // Tab/view state
  pageMode: PageMode;
  setPageMode: (mode: PageMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  groupView: boolean;
  setGroupView: (enabled: boolean, groupId?: string) => void;
  subsView: boolean;
  setSubsView: (enabled: boolean) => void;

  // Context data
  hasSubstitutes: boolean;
  canEdit: boolean;
  currentTier: TierSnapshot | null;
  groups: StaticGroup[];
  currentGroup: StaticGroup | null;
  tiers: TierSnapshot[];

  // Navigation
  navigate: (path: string) => void;

  // Modal toggles
  setEditingPlayerId: (id: string | null) => void;
  setHighlightedPlayerId: (id: string | null) => void;
}

export function useGroupViewKeyboardShortcuts(
  params: GroupViewShortcutParams,
  isAnyModalOpen: boolean
): void {
  const {
    pageMode,
    setPageMode,
    viewMode,
    setViewMode,
    groupView,
    setGroupView,
    subsView,
    setSubsView,
    hasSubstitutes,
    canEdit,
    currentTier,
    groups,
    currentGroup,
    tiers,
    navigate,
    setEditingPlayerId,
    setHighlightedPlayerId,
  } = params;

  // Tier-change / add-player / new-tier / rollover now go through the shared
  // GroupActions context instead of dispatching HEADER_EVENTS. (The legacy
  // Header still dispatches those events; this hook no longer does.) Settings
  // shortcuts (Alt+G/P/M/I) keep dispatching HEADER_EVENTS.SETTINGS.
  const actions = useGroupActions();

  useKeyboardShortcuts({
    disabled: isAnyModalOpen,
    shortcuts: [
      // ===== Main tab navigation =====
      { key: '`', description: 'Overview tab',      action: () => setPageMode('overview') },
      { key: '1', description: 'Schedule tab',      action: () => setPageMode('schedule') },
      { key: '2', description: 'Roster tab',        action: () => setPageMode('roster') },
      { key: '3', description: 'Tracking tab',      action: () => setPageMode('goals') },
      { key: '4', description: 'Loot Log tab',      action: () => setPageMode('gear') },

      // ===== View controls =====
      { key: 'v', description: 'Toggle expand/collapse', action: () => {
        if (pageMode === 'roster') {
          setViewMode(viewMode === 'compact' ? 'expanded' : 'compact');
        }
        // Expand/collapse all weapon-priority sections on the Loot tab (v2's
        // WeaponPriorityList owns the listener; it's simply unmounted while
        // the user is on the History view, so this is a harmless no-op there).
        if (pageMode === 'gear') {
          window.dispatchEvent(new CustomEvent('loot:toggle-expand-all'));
        }
      }},
      { key: 'g', description: 'Toggle group/grid view', action: () => {
        if (pageMode === 'roster') {
          setGroupView(!groupView, currentGroup?.id);
        }
      }},
      { key: 's', description: 'Toggle substitutes', action: () => {
        if (pageMode === 'roster' && hasSubstitutes) {
          setSubsView(!subsView);
        }
      }},

      // ===== Static Settings (Alt+letter) =====
      // These are alwaysEnabled so you can switch tabs or close panel while it's open
      { key: 'g', description: 'Settings: General', action: () => {
        if (canEdit) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.SETTINGS, { detail: { tab: 'general' } }));
        }
      }, requireAlt: true, alwaysEnabled: true },
      { key: 'p', description: 'Settings: Priority', action: () => {
        if (canEdit) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.SETTINGS, { detail: { tab: 'priority' } }));
        }
      }, requireAlt: true, alwaysEnabled: true },
      { key: 'm', description: 'Settings: Members', action: () => {
        if (canEdit) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.SETTINGS, { detail: { tab: 'members' } }));
        }
      }, requireAlt: true, alwaysEnabled: true },
      { key: 'i', description: 'Settings: Recruitment', action: () => {
        if (canEdit) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.SETTINGS, { detail: { tab: 'recruitment' } }));
        }
      }, requireAlt: true, alwaysEnabled: true },

      // ===== Navigation (Shift modifiers) =====
      // Shift+? (show keyboard shortcuts) is handled globally by
      // useGlobalKeyboardShortcuts (Layout.tsx owns the actual modal); no
      // binding needed here.
      { key: 's', description: 'My Statics', action: () => navigate('/profile?tab=statics'), requireShift: true },

      // ===== Static/Tier navigation (brackets) =====
      { key: '[', description: 'Previous static', action: () => {
        const currentIndex = groups.findIndex(g => g.id === currentGroup?.id);
        if (currentIndex > 0) {
          navigate(`/group/${groups[currentIndex - 1].shareCode}`);
        }
      }, requireMod: true },
      { key: ']', description: 'Next static', action: () => {
        const currentIndex = groups.findIndex(g => g.id === currentGroup?.id);
        if (currentIndex >= 0 && currentIndex < groups.length - 1) {
          navigate(`/group/${groups[currentIndex + 1].shareCode}`);
        }
      }, requireMod: true },
      { key: '[', description: 'Previous tier', action: () => {
        const currentIndex = tiers.findIndex(t => t.tierId === currentTier?.tierId);
        if (currentIndex > 0) {
          actions.onTierChange(tiers[currentIndex - 1].tierId);
        }
      }, requireAlt: true },
      { key: ']', description: 'Next tier', action: () => {
        const currentIndex = tiers.findIndex(t => t.tierId === currentTier?.tierId);
        if (currentIndex >= 0 && currentIndex < tiers.length - 1) {
          actions.onTierChange(tiers[currentIndex + 1].tierId);
        }
      }, requireAlt: true },

      // ===== Management actions (Alt+Shift) =====
      { key: 'p', description: 'Add Player', action: () => {
        if (canEdit && pageMode === 'roster' && currentTier) {
          actions.onAddPlayer();
        }
      }, requireAlt: true, requireShift: true },
      { key: 'n', description: 'New Tier', action: () => {
        if (canEdit) {
          actions.onNewTier();
        }
      }, requireAlt: true, requireShift: true },
      { key: 'r', description: 'Copy to New Tier', action: () => {
        if (canEdit && currentTier) {
          actions.onRollover();
        }
      }, requireAlt: true, requireShift: true },

      // ===== Escape =====
      { key: 'Escape', description: 'Close/clear', action: () => {
        setEditingPlayerId(null);
        setHighlightedPlayerId(null);
      }},
    ],
  });
}
