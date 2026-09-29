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
 * it is mounted. `open`/`toggle` for the Recruitment tab consult it first and,
 * when it returns true, do nothing else — the dock never opens, `isOpen` never
 * flips, so no `showSettings` write and no history entry. V1 never registers,
 * so every opener keeps today's behaviour there. `openDock` is `open` without
 * the hook, for the route's interim Listing/Invites placeholders (R-RH-J).
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
  /** Open the dock itself, bypassing `recruitRedirect` (R-RH-J placeholders only). */
  openDock: (opts?: OpenOptions) => void;
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
    get().openDock(opts);
  },
  openDock: (opts = {}) =>
    set((s) => ({
      isOpen: true,
      tab: opts.tab ?? s.tab,
      recruitmentSection: opts.section,
      highlightCreateInvite: opts.highlightCreateInvite ?? false,
    })),
  close: () => set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false }),
  toggle: (opts = {}) => {
    const s = get();
    // Only a CLOSED dock redirects (R-RH-I); an open one keeps today's toggle
    // semantics below (same tab closes, another tab switches), so Alt+I on an
    // open Recruitment dock closes it rather than navigating.
    if (!s.isOpen && opts.tab === 'recruitment' && s.recruitRedirect?.(opts)) return;
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
