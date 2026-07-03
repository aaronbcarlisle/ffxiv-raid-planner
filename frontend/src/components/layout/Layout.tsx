import { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Header } from './Header';
import { PageTransition } from './PageTransition';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { SettingsDockToggle } from './SettingsDockToggle';
import { SettingsPanelController } from './SettingsPanelController';
import { ViewAsBanner } from '../admin';
import { KeyboardShortcutsHelp } from '../ui';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import { useAuthStore } from '../../stores/authStore';

export function Layout() {
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin ?? false;

  // The v2 shell (F6a) renders its own TopBar, so suppress the legacy Header for
  // the group route by default. FLIP P2: v2 is now the default, so suppression
  // applies to every /group/ route EXCEPT the `?shell=legacy` escape hatch, which
  // still renders <Header /> exactly as before (byte-for-byte). All non-group
  // routes always render <Header />.
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // `startsWith('/group/')` is intentionally broad (matches any share code); the
  // `shell !== 'legacy'` gate on the right-hand side scopes suppression to the v2
  // default (bare, ?shell=v2, and any other non-legacy value), leaving only the
  // legacy escape hatch (?shell=legacy) its Header.
  const isGroupV2Shell =
    location.pathname.startsWith('/group/') && searchParams.get('shell') !== 'legacy';

  // Global event listener for keyboard shortcuts modal
  // This allows the UserMenu to trigger shortcuts from any page
  const handleShowKeyboardShortcuts = useCallback(() => {
    setShowKeyboardHelp(true);
  }, []);

  useEffect(() => {
    window.addEventListener('show-keyboard-shortcuts', handleShowKeyboardShortcuts);
    return () => {
      window.removeEventListener('show-keyboard-shortcuts', handleShowKeyboardShortcuts);
    };
  }, [handleShowKeyboardShortcuts]);

  // Global keyboard shortcuts (Shift+S for My Statics, Shift+? for shortcuts help)
  // These work on any page, not just GroupView
  // Admin gets additional Ctrl+Shift+S for Admin Dashboard
  useGlobalKeyboardShortcuts({
    onShowShortcuts: handleShowKeyboardShortcuts,
    disabled: showKeyboardHelp, // Disable when modal is open
    isAdmin,
  });

  return (
    <div className="min-h-dvh h-dvh flex flex-col bg-surface-base overflow-hidden">
      {!isGroupV2Shell && <Header />}
      <ViewAsBanner />
      {/* Content container - scrollable area below sticky header */}
      {/* scrollbar-gutter: stable prevents content shift when scrollbar appears/disappears.
          Applied here on <main> (not globally on <html>) because:
          1. Only the main content area scrolls (header is fixed, page uses overflow-hidden)
          2. Global application caused layout issues on some mobile devices (see index.css)
          3. Scoping to the scroll container is more predictable across browsers */}
      <main className="w-full pt-1 pb-3 md:py-2 flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto overflow-x-hidden" style={{ scrollbarGutter: 'stable' }}>
        <PageTransition />
      </main>

      {/* Bridges legacy settings window-events to the settings store. */}
      <SettingsPanelController />

      {/* Account-level settings panel for non-static routes (the in-static panel
          is rendered by GroupView). Shows only the General tab. */}
      <GlobalSettingsPanel />

      {/* Desktop settings open/close toggle, docked to the right edge to mirror
          the left rail's collapse chevron. (Mobile uses the header gear.)
          Suppressed in v2 — v2 has no settings panel mounted yet, so the toggle
          would be dead chrome. v1 and all non-group routes still render it. */}
      {!isGroupV2Shell && <SettingsDockToggle />}

      {/* Global keyboard shortcuts modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        isAdmin={isAdmin}
      />
    </div>
  );
}
