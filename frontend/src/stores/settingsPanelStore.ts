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
 * it is mounted. `open` and `toggle` for the Recruitment tab both always
 * consult it first — closing the dock first if it happens to be open — and,
 * when it returns true, do nothing else: the dock never (stays) open,
 * `isOpen` ends false, so no `showSettings` write and no history entry. There
 * is no "already showing Recruitment" exemption: `SettingsPanel` can never
 * actually DISPLAY that tab in V2 (its `hiddenTabs` fallback renders General
 * while the store's `tab` field still reads `'recruitment'`, R-RH-J), so a
 * check against `tab` was really a check against left-over V1 state — closing
 * Recruitment in V1 keeps `tab: 'recruitment'` in the store, and switching
 * shells in place (no reload) carries that stale value into V2, where it used
 * to make Alt+I fall through to the plain toggle below instead of redirecting
 * (review wave: the route became unreachable via Alt+I until some other dock
 * tab was clicked first). V1 never registers a redirect, so every opener
 * keeps today's behaviour there regardless.
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
    const s = get();
    // Close first when a redirect fires on an already-open dock (review wave,
    // batched item 3): `toggle` already did this; `open` used to redirect
    // without closing, so e.g. TopBar's Invite button with the dock open on
    // General navigated to the route while leaving the dock open behind it.
    if (opts.tab === 'recruitment' && s.recruitRedirect) {
      if (s.isOpen) set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false });
      if (s.recruitRedirect(opts)) return;
    }
    set((current) => ({
      isOpen: true,
      tab: opts.tab ?? current.tab,
      recruitmentSection: opts.section,
      highlightCreateInvite: opts.highlightCreateInvite ?? false,
    }));
  },
  close: () => set({ isOpen: false, recruitmentSection: undefined, highlightCreateInvite: false }),
  toggle: (opts = {}) => {
    const s = get();
    // Whenever a redirect is registered (V2), a Recruitment request always
    // closes the dock first (if open) and hands off to the route — see the
    // header comment for why there is no "already showing Recruitment"
    // exemption here.
    if (opts.tab === 'recruitment' && s.recruitRedirect) {
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
