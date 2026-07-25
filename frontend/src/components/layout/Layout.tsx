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
// Layout (shell) importing a pages-hosted chrome component is boundary-legal
// and precedented (TopBar.tsx → pages/TierBreadcrumb); pages/ is the exempt
// composition layer. Eager import — AppChrome/AppRail/chromeSlots join the
// main bundle (the auth barrel was already eager via Header); the group-route
// internals stay in the lazy NewShell chunk.
import { AppChrome } from '../../pages/chrome/AppChrome';

export function Layout() {
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin ?? false;

  // Which chrome renders is a resolved-shell decision. Same resolver as
  // GroupRoute — precedence lives in ONE place (lib/shellPreference).
  const location = useLocation();
  const resolvedShell = useResolvedShell();

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

  // Stage-1 T4 — THE COVERAGE FLIP. A v2-resolved user gets the chrome host
  // (AppChrome: rail + top bar + #main-content) on EVERY route Layout owns
  // except `/`. On `/group/*` the route still supplies TopBar + Spine through
  // the host's portal slots; everywhere else the host renders NonGroupTopBar.
  //
  // `/` is excluded deliberately (matrix §8): the legacy Header self-strips to
  // logo + auth there, SettingsDockToggle returns null, and the marketing/home
  // page is not a Person-layer surface. So `/` keeps the legacy Header even for
  // v2-resolved users — which is exactly why UserMenu's "Switch to classic UI"
  // keys on the chrome CONTEXT and not on `resolvedShell` (ruling G2).
  //
  // Everyone resolving to legacy — the default, i.e. the overwhelming majority
  // — takes the untouched return below on every route.
  const chromeActive = resolvedShell === 'v2' && location.pathname !== '/';

  if (chromeActive) {
    return (
      <div className="min-h-dvh h-dvh flex flex-col bg-surface-base overflow-hidden">
        {/* ViewAsBanner stays Layout-owned, above the chrome — matching the
            legacy branch's stacking (banner above the main area). */}
        <ViewAsBanner />
        {/* Chrome OUTSIDE PageTransition (Stage-1 req 7): the rail/top bar
            must not fade on route changes — only the routed content does. */}
        <AppChrome>
          <PageTransition />
        </AppChrome>

        {/* Bridges legacy settings window-events to the settings store. */}
        <SettingsPanelController />

        {/* Account-level settings panel for non-static routes (the in-static
            panel is rendered by V2SettingsHost). Shows only the General tab. */}
        <GlobalSettingsPanel />

        {/* No Header here — AppChrome's rail + top bar replace it. No
            SettingsDockToggle either: ruling G1 re-homes desktop account
            settings to the NonGroupTopBar's SettingsGear off-group, and the
            group TopBar has carried its own gear since F6a. */}

        {/* Global keyboard shortcuts modal */}
        <KeyboardShortcutsHelp
          isOpen={showKeyboardHelp}
          onClose={() => setShowKeyboardHelp(false)}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh h-dvh flex flex-col bg-surface-base overflow-hidden">
      {/* The legacy branch is the V1 render path, byte-for-byte. Header is
          unconditional here: `chromeActive` already took every v2-chromed
          route out of this branch, so the old `!isGroupV2Shell` guard could
          only ever be true (PR-2 director nit — a dead conditional reads like
          a live one). */}
      <Header />
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
          Unconditional in this branch for the same reason as Header above: the
          v2-chromed routes never reach it, and there it is replaced by the
          SettingsGear in the v2 top bar (G1). It self-suppresses on `/`. */}
      <SettingsDockToggle />

      {/* Global keyboard shortcuts modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        isAdmin={isAdmin}
      />
    </div>
  );
}
