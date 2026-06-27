import { create } from 'zustand';

/**
 * Shared open-state for the static Settings panel, so the Header gear and the
 * dock owner (GroupView) never disagree about whether it's open. Width is a
 * module constant used by BOTH the dock width and the header right-padding, so
 * they can't drift. `'48rem'` matches the SettingsPanel's `SlideOutPanel`
 * `width="3xl"` (max-w-3xl) — keep them in sync.
 */
export const SETTINGS_PANEL_WIDTH = '48rem';

interface SettingsPanelState {
  isOpen: boolean;
  initialTab?: string;
  open: (tab?: string) => void;
  close: () => void;
  toggle: (tab?: string) => void;
}

export const useSettingsPanel = create<SettingsPanelState>((set, get) => ({
  isOpen: false,
  initialTab: undefined,
  open: (tab) => set({ isOpen: true, initialTab: tab }),
  close: () => set({ isOpen: false }),
  toggle: (tab) => (get().isOpen ? set({ isOpen: false }) : set({ isOpen: true, initialTab: tab })),
}));
