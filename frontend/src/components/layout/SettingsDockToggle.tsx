/* eslint-disable design-system/no-raw-button */
/**
 * SettingsDockToggle — the desktop open/close control for the docked Settings
 * panel, positioned to mirror the left navigation rail's collapse chevron.
 *
 * It sits at the top-right of the content area (below the header band, same
 * vertical position as the rail's identity header) and slides inward to the
 * panel's left edge when open — mirroring how the rail's chevron stays pinned
 * to the rail's inner edge. Open-state lives in `settingsPanelStore`, so the
 * slide animates via `transform` (GPU) and the click never touches the URL.
 *
 * Desktop only — on mobile the settings gear stays in the header and the panel
 * is a full-screen slide-out.
 */
import { useLocation } from 'react-router-dom';
import { Settings, PanelRightClose } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { SETTINGS_PANEL_WIDTH } from '../settings';

export function SettingsDockToggle() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isOpen = useSettingsPanelStore((s) => s.isOpen);
  const toggle = useSettingsPanelStore((s) => s.toggle);

  const isHome = location.pathname === '/';
  if (!user || isHome) return null;

  return (
    <button
      type="button"
      onClick={() => toggle()}
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
