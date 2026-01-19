import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ReleaseBanner } from './ReleaseBanner';
import { ViewAsBanner } from '../admin';
import { KeyboardShortcutsHelp } from '../ui';

export function Layout() {
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

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

  return (
    <div className="min-h-screen bg-surface-base">
      <Header />
      <ViewAsBanner />
      <ReleaseBanner />
      {/* Content container - pages control their own max-width */}
      <main className="w-full px-4 py-3">
        <Outlet />
      </main>

      {/* Global keyboard shortcuts modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
}
