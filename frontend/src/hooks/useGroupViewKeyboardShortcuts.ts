/**
 * useGroupViewKeyboardShortcuts Hook
 *
 * Configures and applies keyboard shortcuts for GroupView.
 * Extracts the large shortcut configuration that was previously inline.
 */

import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { HEADER_EVENTS } from '../components/layout/Header';
import { useGroupActions } from '../pages/groupActionsContext';
import type { PageMode, GearSubTab, ViewMode } from '../types';
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

  /** Legacy gear-tab surface — pass ONLY when the legacy gear body can render
   *  (`!slots?.gear` in GroupViewContent). Presence gates the legacy sub-tab /
   *  quick-action bindings: in v2 those modals and sub-tabs have no renderer,
   *  so registering them would re-introduce the flip-P3 dead-flag latch
   *  (isAnyModalOpen stuck true with no way to clear it).
   *
   *  Deliberately NOT restored here (see f45a241 for the removed shape):
   *  `lootSubTab`/`setLootSubTab` — unused (`_`-prefixed) even at f45a241,
   *  so there's nothing behind them worth wiring back up. */
  legacyLootSurface?: {
    gearSubTab: GearSubTab;
    setGearSubTab: (tab: GearSubTab) => void;
    setShowLogLootModal: (show: boolean) => void;
    setShowLogMaterialModal: (show: boolean) => void;
    setShowMarkFloorClearedModal: (show: boolean) => void;
  };
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
    legacyLootSurface,
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
        if (pageMode === 'gear') {
          if (legacyLootSurface && legacyLootSurface.gearSubTab === 'history') {
            // Legacy History body owns this listener (Loot Log sub-tab).
            window.dispatchEvent(new CustomEvent('log:toggle-expand-all'));
          } else if (!legacyLootSurface || legacyLootSurface.gearSubTab === 'priority') {
            // No legacy surface → v2 Loot owns the listener
            // (WeaponPriorityList); when the v2 user is on Loot's History
            // view the listener is unmounted, so this dispatch is a harmless
            // no-op there. With the legacy surface present, this fires only
            // on the Priority sub-tab (f45a241 behavior).
            window.dispatchEvent(new CustomEvent('loot:toggle-expand-all'));
          }
        }
      }},
      { key: 'g', description: 'Toggle group/grid view', action: () => {
        if (pageMode === 'roster') {
          setGroupView(!groupView, currentGroup?.id);
        }
        if (pageMode === 'gear' && legacyLootSurface?.gearSubTab === 'history') {
          // Toggle grid/list on the legacy Loot Log sub-tab.
          window.dispatchEvent(new CustomEvent('log:toggle-layout'));
        }
      }},
      { key: 's', description: 'Toggle substitutes', action: () => {
        if (pageMode === 'roster' && hasSubstitutes) {
          setSubsView(!subsView);
        }
      }},

      // ===== Legacy gear surface (Phase R dual-shell restore) =====
      // Only registered when `legacyLootSurface` is passed, i.e. the legacy
      // gear body can actually render (GroupViewContent gates this on
      // `!slots?.gear`). f45a241 binding bodies, unchanged, reading
      // gearSubTab / the modal setters off `legacyLootSurface` instead of
      // top-level params.
      ...(legacyLootSurface ? [
        // ----- Sub tabs (Alt+1-3) -----
        // Gear sub-tabs: Priority, Loot Log, Summary, Weapon
        // History/List: By Floor, Timeline
        // History/All Weeks: All, Gear, Materials
        { key: '1', description: 'Sub tab 1', action: () => {
          if (pageMode === 'gear') legacyLootSurface.setGearSubTab('priority');
          if (pageMode === 'gear' && legacyLootSurface.gearSubTab === 'history') {
            window.dispatchEvent(new CustomEvent('log:set-view', { detail: 'byFloor' }));
            window.dispatchEvent(new CustomEvent('log:set-entry-type', { detail: 'all' }));
          }
        }, requireAlt: true },
        { key: '2', description: 'Sub tab 2', action: () => {
          if (pageMode === 'gear') legacyLootSurface.setGearSubTab('history');
          if (pageMode === 'gear' && legacyLootSurface.gearSubTab === 'history') {
            window.dispatchEvent(new CustomEvent('log:set-view', { detail: 'chronological' }));
            window.dispatchEvent(new CustomEvent('log:set-entry-type', { detail: 'loot' }));
          }
        }, requireAlt: true },
        { key: '3', description: 'Sub tab 3', action: () => {
          if (pageMode === 'gear') legacyLootSurface.setGearSubTab('stats');
          if (pageMode === 'gear' && legacyLootSurface.gearSubTab === 'history') {
            window.dispatchEvent(new CustomEvent('log:set-entry-type', { detail: 'materials' }));
          }
        }, requireAlt: true },

        // ----- Week navigation (Alt+Arrow) -----
        { key: 'ArrowLeft', description: 'Previous week', action: () => {
          if (pageMode === 'gear' && legacyLootSurface.gearSubTab === 'history') {
            window.dispatchEvent(new CustomEvent('log:prev-week'));
          }
        }, requireAlt: true },
        { key: 'ArrowRight', description: 'Next week', action: () => {
          if (pageMode === 'gear' && legacyLootSurface.gearSubTab === 'history') {
            window.dispatchEvent(new CustomEvent('log:next-week'));
          }
        }, requireAlt: true },

        // ----- Quick actions (Alt+letter) -----
        { key: 'l', description: 'Log Loot', action: () => {
          if (canEdit) {
            setPageMode('gear');
            legacyLootSurface.setGearSubTab('history');
            legacyLootSurface.setShowLogLootModal(true);
          }
        }, requireAlt: true },
        { key: 'u', description: 'Log Material', action: () => {
          if (canEdit) {
            setPageMode('gear');
            legacyLootSurface.setGearSubTab('history');
            legacyLootSurface.setShowLogMaterialModal(true);
          }
        }, requireAlt: true },
        { key: 'b', description: 'Mark Floor Cleared', action: () => {
          if (canEdit) {
            setPageMode('gear');
            legacyLootSurface.setGearSubTab('history');
            legacyLootSurface.setShowMarkFloorClearedModal(true);
          }
        }, requireAlt: true },
      ] : []),

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
      // Deliberately NOT restored (Phase R): Shift+? / `setShowKeyboardHelp`
      // (show keyboard shortcuts) — a dead flag with no renderer even at
      // f45a241, since Shift+? is handled globally by
      // useGlobalKeyboardShortcuts (Layout.tsx owns the actual modal); no
      // binding or setter needed here.
      { key: 's', description: 'My Statics', action: () => navigate('/profile?tab=statics'), requireShift: true },

      // ===== Static/Tier navigation (brackets) =====
      // Deliberately NOT restored (Phase R): f45a241's `shellParam` (it
      // preserved `?shell=` across Mod+[/] static-switch navigation). The
      // dual-shell world resolves shell via a stored preference, not a URL
      // param carried shortcut-to-shortcut, so these navigate to a bare
      // `/group/<code>` path exactly as at HEAD.
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
