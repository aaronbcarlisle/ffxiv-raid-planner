/**
 * useGlobalKeyboardShortcuts Hook
 *
 * Provides keyboard shortcuts that work on any page (not just GroupView).
 * These are navigation and utility shortcuts like "My Statics" and "Show Shortcuts".
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

interface UseGlobalKeyboardShortcutsOptions {
  /** Callback to show the keyboard shortcuts modal */
  onShowShortcuts: () => void;
  /** Disable shortcuts (e.g., when modal is open) */
  disabled?: boolean;
}

export function useGlobalKeyboardShortcuts({
  onShowShortcuts,
  disabled = false,
}: UseGlobalKeyboardShortcutsOptions): void {
  const navigate = useNavigate();

  const goToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  useKeyboardShortcuts({
    disabled,
    shortcuts: [
      // Navigation shortcuts
      {
        key: 's',
        description: 'My Statics',
        action: goToDashboard,
        requireShift: true,
      },
      // Utility shortcuts
      {
        key: '?',
        description: 'Show keyboard shortcuts',
        action: onShowShortcuts,
        requireShift: true,
      },
    ],
  });
}
