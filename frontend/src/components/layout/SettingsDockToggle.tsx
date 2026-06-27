/* eslint-disable design-system/no-raw-button */
/**
 * SettingsDockToggle — the desktop open/close control for the docked Settings
 * panel, positioned to mirror the left navigation rail's collapse chevron.
 *
 * It sits at the top-right of the content area (below the header band, same
 * vertical position as the rail's identity header) and slides inward to the
 * panel's left edge when the panel is open — exactly mirroring how the rail's
 * chevron stays pinned to the rail's inner edge. Clicking it dispatches the
 * shared `HEADER_EVENTS.SETTINGS` toggle, so whichever panel listener is mounted
 * (GroupView inside a static, GlobalSettingsPanel elsewhere) opens/closes.
 *
 * Desktop only — on mobile the settings gear stays in the header and the panel
 * is a full-screen slide-out.
 */
import { useLocation, useSearchParams } from 'react-router-dom';
import { Settings, PanelRightClose } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { SETTINGS_PANEL_WIDTH } from '../settings';
import { HEADER_EVENTS } from './Header';

export function SettingsDockToggle() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const isHome = location.pathname === '/';
  const isOpen = searchParams.get('showSettings') === 'true' || !!searchParams.get('settings');

  if (!user || isHome) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(HEADER_EVENTS.SETTINGS, { detail: { toggle: true } }))}
      aria-label={isOpen ? 'Close settings' : 'Open settings'}
      aria-expanded={isOpen}
      className="hidden sm:flex fixed right-0 z-40 h-12 w-7 items-center justify-center rounded-l-lg border border-r-0 border-border-default bg-surface-raised text-text-muted hover:text-accent shadow-sm will-change-transform"
      style={{
        top: 'var(--header-height, 56px)',
        transform: isOpen ? `translateX(calc(-1 * ${SETTINGS_PANEL_WIDTH}))` : 'translateX(0)',
        transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms ease',
      }}
    >
      {isOpen ? <PanelRightClose size={16} /> : <Settings size={16} />}
    </button>
  );
}
