/**
 * useGroupViewKeyboardShortcuts Hook
 *
 * Configures and applies keyboard shortcuts for GroupView.
 * Extracts the large shortcut configuration that was previously inline.
 */

import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { HEADER_EVENTS } from '../components/layout/Header';
import type { PageMode, ViewMode } from '../types';
import type { TierSnapshot, StaticGroup } from '../types';

export interface GroupViewShortcutParams {
  // Tab/view state
  pageMode: PageMode;
  setPageMode: (mode: PageMode) => void;
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
    setLootSubTab,
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
      // ===== Main tab navigation (1-4) =====
      { key: '1', description: 'Players tab', action: () => setPageMode('players') },
      { key: '2', description: 'Loot tab', action: () => setPageMode('loot') },
      { key: '3', description: 'Log tab', action: () => setPageMode('history') },
      { key: '4', description: 'Summary tab', action: () => setPageMode('stats') },

      // ===== Sub tabs (Alt+1-3) =====
      // Loot: Matrix (Who Needs It), Gear Priority, Weapon Priority
      { key: '1', description: 'Sub tab 1', action: () => {
        if (pageMode === 'loot') setLootSubTab('matrix');
        if (pageMode === 'history') window.dispatchEvent(new CustomEvent('log:set-view', { detail: 'byFloor' }));
      }, requireAlt: true },
      { key: '2', description: 'Sub tab 2', action: () => {
        if (pageMode === 'loot') setLootSubTab('gear');
        if (pageMode === 'history') window.dispatchEvent(new CustomEvent('log:set-view', { detail: 'chronological' }));
      }, requireAlt: true },
      { key: '3', description: 'Sub tab 3', action: () => {
        if (pageMode === 'loot') setLootSubTab('weapon');
      }, requireAlt: true },

      // ===== View controls =====
      { key: 'v', description: 'Toggle expand/collapse', action: () => {
        if (pageMode === 'players') {
          setViewMode(viewMode === 'compact' ? 'expanded' : 'compact');
        }
        // Expand/collapse all on Log tab
        if (pageMode === 'history') {
          window.dispatchEvent(new CustomEvent('log:toggle-expand-all'));
        }
        // Expand/collapse on Loot tab (weapon priorities)
        if (pageMode === 'loot') {
          window.dispatchEvent(new CustomEvent('loot:toggle-expand-all'));
        }
      }},
      { key: 'g', description: 'Toggle group/grid view', action: () => {
        if (pageMode === 'players') {
          setGroupView(!groupView, currentGroup?.id);
        }
        // Toggle grid/list on Log tab
        if (pageMode === 'history') {
          window.dispatchEvent(new CustomEvent('log:toggle-layout'));
        }
      }},
      { key: 's', description: 'Toggle substitutes', action: () => {
        if (pageMode === 'players' && hasSubstitutes) {
          setSubsView(!subsView);
        }
      }},

      // ===== Week navigation (Alt+Arrow) =====
      { key: 'ArrowLeft', description: 'Previous week', action: () => {
        if (pageMode === 'history') {
          window.dispatchEvent(new CustomEvent('log:prev-week'));
        }
      }, requireAlt: true },
      { key: 'ArrowRight', description: 'Next week', action: () => {
        if (pageMode === 'history') {
          window.dispatchEvent(new CustomEvent('log:next-week'));
        }
      }, requireAlt: true },

      // ===== Quick actions (Alt+letter) =====
      { key: 'l', description: 'Log Loot', action: () => {
        if (canEdit) {
          setPageMode('history');
          setShowLogLootModal(true);
        }
      }, requireAlt: true },
      { key: 'm', description: 'Log Material', action: () => {
        if (canEdit) {
          setPageMode('history');
          setShowLogMaterialModal(true);
        }
      }, requireAlt: true },
      { key: 'b', description: 'Mark Floor Cleared', action: () => {
        if (canEdit) {
          setPageMode('history');
          setShowMarkFloorClearedModal(true);
        }
      }, requireAlt: true },

      // ===== Navigation (Shift modifiers) =====
      { key: 's', description: 'My Statics', action: () => navigate('/dashboard'), requireShift: true },
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
        if (canEdit && pageMode === 'players' && currentTier) {
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
      { key: 's', description: 'Static Settings', action: () => {
        if (canEdit) {
          window.dispatchEvent(new CustomEvent(HEADER_EVENTS.SETTINGS));
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
