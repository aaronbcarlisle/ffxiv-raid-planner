/**
 * useGroupViewKeyboardShortcuts Hook
 *
 * Configures and applies keyboard shortcuts for GroupView.
 * Extracts the large shortcut configuration that was previously inline.
 */

import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { HEADER_EVENTS } from '../components/layout/Header';
import type { PageMode, GearSubTab, ViewMode } from '../types';
import type { TierSnapshot, StaticGroup } from '../types';

export interface GroupViewShortcutParams {
  // Tab/view state
  pageMode: PageMode;
  setPageMode: (mode: PageMode) => void;
  gearSubTab: GearSubTab;
  setGearSubTab: (tab: GearSubTab) => void;
  lootSubTab: 'matrix' | 'gear' | 'weapon';
  setLootSubTab: (tab: 'matrix' | 'gear' | 'weapon') => void;
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
  setShowKeyboardHelp: (show: boolean) => void;
  setEditingPlayerId: (id: string | null) => void;
  setHighlightedPlayerId: (id: string | null) => void;
  setShowLogLootModal: (show: boolean) => void;
  setShowLogMaterialModal: (show: boolean) => void;
  setShowMarkFloorClearedModal: (show: boolean) => void;
}

export function useGroupViewKeyboardShortcuts(
  params: GroupViewShortcutParams,
  isAnyModalOpen: boolean
): void {
  const {
    pageMode,
    setPageMode,
    gearSubTab: _gearSubTab,
    setGearSubTab,
    setLootSubTab: _setLootSubTab,
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
    setShowKeyboardHelp,
    setEditingPlayerId,
    setHighlightedPlayerId,
    setShowLogLootModal,
    setShowLogMaterialModal,
    setShowMarkFloorClearedModal,
  } = params;

  useKeyboardShortcuts({
    disabled: isAnyModalOpen,
    shortcuts: [
      // ===== Main tab navigation =====
      { key: '`', description: 'Overview tab',      action: () => setPageMode('overview') },
      { key: '1', description: 'Schedule tab',      action: () => setPageMode('schedule') },
      { key: '2', description: 'Roster tab',        action: () => setPageMode('roster') },
      { key: '3', description: 'Tracking tab',      action: () => setPageMode('goals') },
      { key: '4', description: 'Loot Log tab',      action: () => setPageMode('gear') },

      // ===== Sub tabs (Alt+1-3) =====
      // Gear sub-tabs: Priority, Loot Log, Summary, Weapon
      // History/List: By Floor, Timeline
      // History/All Weeks: All, Gear, Materials
      { key: '1', description: 'Sub tab 1', action: () => {
        if (pageMode === 'gear') setGearSubTab('priority');
        if (pageMode === 'gear' && _gearSubTab === 'history') {
          window.dispatchEvent(new CustomEvent('log:set-view', { detail: 'byFloor' }));
          window.dispatchEvent(new CustomEvent('log:set-entry-type', { detail: 'all' }));
        }
      }, requireAlt: true },
      { key: '2', description: 'Sub tab 2', action: () => {
        if (pageMode === 'gear') setGearSubTab('history');
        if (pageMode === 'gear' && _gearSubTab === 'history') {
          window.dispatchEvent(new CustomEvent('log:set-view', { detail: 'chronological' }));
          window.dispatchEvent(new CustomEvent('log:set-entry-type', { detail: 'loot' }));
        }
      }, requireAlt: true },
      { key: '3', description: 'Sub tab 3', action: () => {
        if (pageMode === 'gear') setGearSubTab('stats');
        if (pageMode === 'gear' && _gearSubTab === 'history') {
          window.dispatchEvent(new CustomEvent('log:set-entry-type', { detail: 'materials' }));
        }
      }, requireAlt: true },

      // ===== View controls =====
      { key: 'v', description: 'Toggle expand/collapse', action: () => {
        if (pageMode === 'roster') {
          setViewMode(viewMode === 'compact' ? 'expanded' : 'compact');
        }
        // Expand/collapse all on Loot Log sub-tab
        if (pageMode === 'gear' && _gearSubTab === 'history') {
          window.dispatchEvent(new CustomEvent('log:toggle-expand-all'));
        }
        // Expand/collapse on Gear Priority sub-tab (weapon priorities)
        if (pageMode === 'gear' && _gearSubTab === 'priority') {
          window.dispatchEvent(new CustomEvent('loot:toggle-expand-all'));
        }
      }},
      { key: 'g', description: 'Toggle group/grid view', action: () => {
        if (pageMode === 'roster') {
          setGroupView(!groupView, currentGroup?.id);
        }
        // Toggle grid/list on Loot Log sub-tab
        if (pageMode === 'gear' && _gearSubTab === 'history') {
          window.dispatchEvent(new CustomEvent('log:toggle-layout'));
        }
      }},
      { key: 's', description: 'Toggle substitutes', action: () => {
        if (pageMode === 'roster' && hasSubstitutes) {
          setSubsView(!subsView);
        }
      }},

      // ===== Week navigation (Alt+Arrow) =====
      { key: 'ArrowLeft', description: 'Previous week', action: () => {
        if (pageMode === 'gear' && _gearSubTab === 'history') {
          window.dispatchEvent(new CustomEvent('log:prev-week'));
        }
      }, requireAlt: true },
      { key: 'ArrowRight', description: 'Next week', action: () => {
        if (pageMode === 'gear' && _gearSubTab === 'history') {
          window.dispatchEvent(new CustomEvent('log:next-week'));
        }
      }, requireAlt: true },

      // ===== Quick actions (Alt+letter) =====
      { key: 'l', description: 'Log Loot', action: () => {
        if (canEdit) {
          setPageMode('gear');
          setGearSubTab('history');
          setShowLogLootModal(true);
        }
      }, requireAlt: true },
      { key: 'u', description: 'Log Material', action: () => {
        if (canEdit) {
          setPageMode('gear');
          setGearSubTab('history');
          setShowLogMaterialModal(true);
        }
      }, requireAlt: true },
      { key: 'b', description: 'Mark Floor Cleared', action: () => {
        if (canEdit) {
          setPageMode('gear');
          setGearSubTab('history');
          setShowMarkFloorClearedModal(true);
        }
      }, requireAlt: true },

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
      { key: 's', description: 'My Statics', action: () => navigate('/profile?tab=statics'), requireShift: true },
      { key: '?', description: 'Show keyboard shortcuts', action: () => setShowKeyboardHelp(true), requireShift: true },

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
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.TIER_CHANGE, { detail: { tierId: tiers[currentIndex - 1].tierId } }));
        }
      }, requireAlt: true },
      { key: ']', description: 'Next tier', action: () => {
        const currentIndex = tiers.findIndex(t => t.tierId === currentTier?.tierId);
        if (currentIndex >= 0 && currentIndex < tiers.length - 1) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.TIER_CHANGE, { detail: { tierId: tiers[currentIndex + 1].tierId } }));
        }
      }, requireAlt: true },

      // ===== Management actions (Alt+Shift) =====
      { key: 'p', description: 'Add Player', action: () => {
        if (canEdit && pageMode === 'roster' && currentTier) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.ADD_PLAYER));
        }
      }, requireAlt: true, requireShift: true },
      { key: 'n', description: 'New Tier', action: () => {
        if (canEdit) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.NEW_TIER));
        }
      }, requireAlt: true, requireShift: true },
      { key: 'r', description: 'Copy to New Tier', action: () => {
        if (canEdit && currentTier) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.ROLLOVER));
        }
      }, requireAlt: true, requireShift: true },

      // ===== Escape =====
      { key: 'Escape', description: 'Close/clear', action: () => {
        setShowKeyboardHelp(false);
        setEditingPlayerId(null);
        setHighlightedPlayerId(null);
      }},
    ],
  });
}
