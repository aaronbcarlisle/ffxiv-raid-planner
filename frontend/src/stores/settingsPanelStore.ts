/**
 * settingsPanelStore — open/close + active-tab state for the Settings panel.
 *
 * This deliberately lives OUTSIDE the URL (and outside useGroupViewState). The
 * settings panel sits near the app root, but on the Roster page the whole player
 * grid sits under the same Layout subtree. When the open-state lived in the URL,
 * toggling the drawer changed search params → useSearchParams re-rendered
 * GroupView → the entire (unmemoized, multi-variant) roster reconciled, costing
 * ~450-575ms per toggle. With the state here, only the components that actually
 * subscribe (the gear, the dock toggle, and the panel host) re-render — the
 * roster never sees the toggle.
 */
import { create } from 'zustand';
import type { SettingsTab, RecruitmentSection } from '../components/settings';

interface OpenOptions {
  tab?: SettingsTab;
  section?: RecruitmentSection;
  highlightCreateInvite?: boolean;
}

interface SettingsPanelState {
  isOpen: boolean;
  tab: SettingsTab;
  recruitmentSection?: RecruitmentSection;
  highlightCreateInvite: boolean;
  /** Open (or re-route) the panel to a tab/section. */
  open: (opts?: OpenOptions) => void;
  close: () => void;
  /**
   * Toggle from the gear / dock control. Re-requesting the same tab while open
   * closes; requesting a different tab (or an explicit section) switches to it.
   */
  toggle: (opts?: OpenOptions) => void;
  setTab: (tab: SettingsTab) => void;
}

export const useSettingsPanelStore = create<SettingsPanelState>((set, get) => ({
  isOpen: false,
  tab: 'general',
  recruitmentSection: undefined,
  highlightCreateInvite: false,
  open: (opts = {}) =>
    set((s) => ({
      isOpen: true,
      tab: opts.tab ?? s.tab,
      recruitmentSection: opts.section,
      highlightCreateInvite: opts.highlightCreateInvite ?? false,
    })),
  close: () => set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false }),
  toggle: (opts = {}) => {
    const s = get();
    const sameTab = opts.tab === undefined || opts.tab === s.tab;
    if (s.isOpen && sameTab && !opts.section) {
      set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false });
    } else {
      set({
        isOpen: true,
        tab: opts.tab ?? s.tab,
        recruitmentSection: opts.section,
        highlightCreateInvite: opts.highlightCreateInvite ?? (opts.tab === 'recruitment' && !opts.section),
      });
    }
  },
  setTab: (tab) => set({ tab }),
}));
