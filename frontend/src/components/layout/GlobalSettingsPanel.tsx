/**
 * GlobalSettingsPanel — the account-level Settings surface available on every
 * non-static route (Player Hub, Static Finder, dashboard, etc.).
 *
 * Inside a static (`/group/*`) GroupView renders the full role-aware panel
 * instead; here we only ever show the General (account preferences) tab. The
 * open-state lives in the URL (`?showSettings` / `?settings`) — the same
 * convention the in-static panel uses — so the header gear indicator, the
 * single-toggle behavior, and browser back/forward stay consistent everywhere.
 *
 * The header gear dispatches `HEADER_EVENTS.SETTINGS`; this panel only reacts
 * off static routes (where GroupView's own listener isn't mounted), so the two
 * never double-handle the same toggle.
 */
import { useCallback, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDevice } from '../../hooks/useDevice';
import { SettingsPanel, SETTINGS_PANEL_WIDTH } from '../settings';
import { RightDockPanel } from '../ui/RightDockPanel';
import { HEADER_EVENTS } from './Header';

export function GlobalSettingsPanel() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const { isSmallScreen } = useDevice();

  const onGroupRoute = location.pathname.startsWith('/group/');
  const isOpen = searchParams.get('showSettings') === 'true' || !!searchParams.get('settings');

  const close = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('showSettings');
      params.delete('settings');
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const toggle = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const open = params.get('showSettings') === 'true' || !!params.get('settings');
      if (open) {
        params.delete('showSettings');
        params.delete('settings');
      } else {
        params.set('showSettings', 'true');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // React to the header gear only off static routes — on `/group/*` GroupView
  // owns the SETTINGS listener, so deferring here avoids a double toggle.
  useEffect(() => {
    if (onGroupRoute) return;
    const handler = () => toggle();
    window.addEventListener(HEADER_EVENTS.SETTINGS, handler);
    return () => window.removeEventListener(HEADER_EVENTS.SETTINGS, handler);
  }, [onGroupRoute, toggle]);

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
