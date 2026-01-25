import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ReleaseBanner } from './ReleaseBanner';
import { ViewAsBanner } from '../admin';
import { KeyboardShortcutsHelp } from '../ui';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import { useAuthStore } from '../../stores/authStore';

export function Layout() {
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin ?? false;

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
    <div className="min-h-screen h-screen flex flex-col bg-surface-base overflow-hidden">
      <Header />
      <ViewAsBanner />
      <ReleaseBanner />
      {/* Content container - scrollable area below sticky header */}
      {/* scrollbar-gutter: stable prevents content shift when scrollbar appears/disappears */}
      <main className="w-full py-3 flex-1 min-h-0 flex flex-col overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        <Outlet />
      </main>

      {/* Global keyboard shortcuts modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        isAdmin={isAdmin}
      />
    </div>
  );
}
