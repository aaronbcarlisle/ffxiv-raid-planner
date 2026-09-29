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
 *
 * R-RH-I (the Recruiting seam): the V2 shell registers `recruitRedirect` while
 * it is mounted. `open` for the Recruitment tab always consults it first and,
 * when it returns true, does nothing else — the dock never opens, `isOpen`
 * never flips, so no `showSettings` write and no history entry. `toggle`
 * consults it too, EXCEPT when the dock is already open and showing
 * Recruitment: there, Alt+I keeps closing the dock rather than navigating
 * (see the inline comment in `toggle` — RH1d fix wave: an open dock on
 * ANOTHER tab now closes first, then hands off to the redirect, so toggling
 * to Recruitment while it's hidden from the dock's own tab list is no longer
 * a silent no-op). V1 never registers, so every opener keeps today's
 * behaviour there.
 */
import { create } from 'zustand';
import type { SettingsTab, RecruitmentSection } from '../components/settings';

export interface OpenOptions {
  tab?: SettingsTab;
  section?: RecruitmentSection;
  highlightCreateInvite?: boolean;
}

/** Returns true when it handled the open (the dock must then stay closed). */
type RecruitRedirect = (opts: OpenOptions) => boolean;

interface SettingsPanelState {
  isOpen: boolean;
  tab: SettingsTab;
  recruitmentSection?: RecruitmentSection;
  highlightCreateInvite: boolean;
  /** R-RH-I: the V2 shell's route redirect for `tab: 'recruitment'` opens; null in V1. */
  recruitRedirect: RecruitRedirect | null;
  setRecruitRedirect: (fn: RecruitRedirect | null) => void;
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
  recruitRedirect: null,
  setRecruitRedirect: (fn) => set({ recruitRedirect: fn }),
  open: (opts = {}) => {
    if (opts.tab === 'recruitment' && get().recruitRedirect?.(opts)) return;
    set((s) => ({
      isOpen: true,
      tab: opts.tab ?? s.tab,
      recruitmentSection: opts.section,
      highlightCreateInvite: opts.highlightCreateInvite ?? false,
    }));
  },
  close: () => set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false }),
  toggle: (opts = {}) => {
    const s = get();
    // A closed dock redirects, and so does an open one showing ANOTHER tab —
    // close it first so the panel never falls back to General for a tab the
    // host just hid (R-RH-J), then hand off to the route (RH1d fix wave: this
    // used to only fire while closed, so Alt+I on a dock open elsewhere just
    // switched to the now-hidden Recruitment tab, a silent no-op). An open
    // dock already ON Recruitment skips this and falls through to the plain
    // toggle below, so Alt+I there keeps just closing it rather than
    // navigating.
    if (opts.tab === 'recruitment' && s.tab !== 'recruitment' && s.recruitRedirect) {
      if (s.isOpen) set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false });
      if (s.recruitRedirect(opts)) return;
    }
    const current = get();
    const sameTab = opts.tab === undefined || opts.tab === current.tab;
    if (current.isOpen && sameTab && !opts.section) {
      set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false });
    } else {
      set({
        isOpen: true,
        tab: opts.tab ?? current.tab,
        recruitmentSection: opts.section,
        highlightCreateInvite: opts.highlightCreateInvite ?? (opts.tab === 'recruitment' && !opts.section),
      });
    }
  },
  setTab: (tab) => set({ tab }),
}));
