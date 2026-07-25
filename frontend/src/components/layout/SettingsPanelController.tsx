/**
 * SettingsPanelController — bridges the legacy `HEADER_EVENTS.SETTINGS` /
 * `OPEN_SETTINGS_INVITATIONS` window events to `settingsPanelStore`, so the
 * existing dispatchers (header gear, keyboard shortcuts, Overview links) keep
 * working without each needing to import the store. Mounted once in Layout.
 *
 * Two semantics are preserved:
 *  - `{ toggle: true }` (the gear): a pure open/close toggle — close if open,
 *    else open (routing to the requested tab/section).
 *  - `{ tab }` without `toggle` (keyboard Alt+G/P/M/I, Overview links): open or
 *    switch to that tab; re-requesting the already-active tab closes it.
 */
import { useEffect } from 'react';
import { HEADER_EVENTS } from './Header';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import type { SettingsTab, RecruitmentSection } from '../settings';

export function SettingsPanelController() {
  useEffect(() => {
    const onSettings = (e: Event) => {
      const d = (e as CustomEvent<{ tab?: SettingsTab; section?: RecruitmentSection; toggle?: boolean }>).detail ?? {};
      const store = useSettingsPanelStore.getState();
      if (d.toggle) {
        if (store.isOpen) {
          store.close();
        } else {
          store.open({
            tab: d.tab,
            section: d.section,
            highlightCreateInvite: d.tab === 'recruitment' && !d.section,
          });
        }
      } else {
        store.toggle({ tab: d.tab, section: d.section });
      }
    };
    const onInvitations = () => {
      useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'invitations', highlightCreateInvite: true });
    };

    window.addEventListener(HEADER_EVENTS.SETTINGS, onSettings);
    window.addEventListener(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS, onInvitations);
    return () => {
      window.removeEventListener(HEADER_EVENTS.SETTINGS, onSettings);
      window.removeEventListener(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS, onInvitations);
    };
  }, []);

  return null;
}
