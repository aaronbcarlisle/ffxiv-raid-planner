import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { PageTransition } from './PageTransition';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { SettingsDockToggle } from './SettingsDockToggle';
import { SettingsPanelController } from './SettingsPanelController';
import { ViewAsBanner } from '../admin';
import { KeyboardShortcutsHelp } from '../ui';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import { useAuthStore } from '../../stores/authStore';
import { useResolvedShell, useShellParamPersistence } from '../../lib/shellPreference';

export function Layout() {
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin ?? false;

  // The v2 shell renders its own TopBar, so the app-wide Header (and the
  // settings dock toggle) are suppressed ONLY when the group route resolves to
  // the v2 shell. Legacy group routes render <Header/> exactly as before the
  // flip; all non-group routes always render it. Same resolver as GroupRoute —
  // precedence lives in ONE place (lib/shellPreference).
  const location = useLocation();
  const resolvedShell = useResolvedShell();
  const isGroupV2Shell = location.pathname.startsWith('/group/') && resolvedShell === 'v2';

  // S2: remember an explicit `?shell=` deep-link for this tab so v2 navigation
  // stays in v2 (and opt-out stays opted-out) without persisting to the account.
  // No-op when no `?shell=` param is present, so the legacy default is untouched.
  useShellParamPersistence();

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
          is rendered by V2SettingsHost). Shows only the General tab. */}
      <GlobalSettingsPanel />

      {/* Desktop settings open/close toggle, docked to the right edge to mirror
          the left rail's collapse chevron. (Mobile uses the header gear.)
          Suppressed only when the group route resolves to the v2 shell — v2
          mounts its own SettingsGear (via V2SettingsHost), so this toggle
          would be a redundant duplicate there. Legacy group routes and all
          non-group routes still render it. */}
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
