/**
 * GlobalSettingsPanel — the account-level Settings surface available on every
 * non-static route (Player Hub, Static Finder, dashboard, etc.).
 *
 * Inside a static (`/group/*`) GroupView renders the full role-aware panel
 * instead; here we only ever show the General (account preferences) tab. Open
 * state lives in `settingsPanelStore`, so toggling never touches the URL or
 * re-renders anything but the subscribers.
 */
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useDevice } from '../../hooks/useDevice';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { SettingsPanel, SETTINGS_PANEL_WIDTH } from '../settings';
import { RightDockPanel } from '../ui/RightDockPanel';
import { Settings } from 'lucide-react';

export function GlobalSettingsPanel() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const { isSmallScreen } = useDevice();
  const isOpen = useSettingsPanelStore((s) => s.isOpen);
  const close = useSettingsPanelStore((s) => s.close);

  const onGroupRoute = location.pathname.startsWith('/group/');

  // On `/group/*` GroupView renders the full panel; off-route we render the
  // account-only panel. Both read the same store, so only one is mounted.
  if (onGroupRoute || !user) return null;

  const panel = (
    <SettingsPanel
      container={isSmallScreen ? 'slideout' : 'dock'}
      isOpen={isOpen}
      onClose={close}
      isAdmin={user.isAdmin}
    />
  );

  // Mobile keeps the full overlay (SettingsPanel owns its chrome).
  if (isSmallScreen) return panel;

  // Desktop docks it to the right edge, below the header band.
  return (
    <RightDockPanel
      isOpen={isOpen}
      onClose={close}
      width={SETTINGS_PANEL_WIDTH}
      title={<span className="flex items-center gap-2"><Settings className="w-5 h-5" />Settings</span>}
    >
      {panel}
    </RightDockPanel>
  );
}
