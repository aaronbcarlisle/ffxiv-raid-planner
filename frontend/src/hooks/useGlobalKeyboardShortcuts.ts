/**
 * useGlobalKeyboardShortcuts Hook
 *
 * Provides keyboard shortcuts that work on any page (not just GroupView).
 * These are navigation and utility shortcuts like "My Statics" and "Show Shortcuts".
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts';

interface UseGlobalKeyboardShortcutsOptions {
  /** Callback to show the keyboard shortcuts modal */
  onShowShortcuts: () => void;
  /** Disable shortcuts (e.g., when modal is open) */
  disabled?: boolean;
  /** Whether the user is an admin (enables admin-only shortcuts) */
  isAdmin?: boolean;
}

export function useGlobalKeyboardShortcuts({
  onShowShortcuts,
  disabled = false,
  isAdmin = false,
}: UseGlobalKeyboardShortcutsOptions): void {
  const navigate = useNavigate();

  const goToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const goToAdminDashboard = useCallback(() => {
    navigate('/admin/statics');
  }, [navigate]);

  const shortcuts = useMemo<KeyboardShortcut[]>(() => {
    const baseShortcuts: KeyboardShortcut[] = [
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
    ];

    // Admin-only shortcuts
    if (isAdmin) {
      baseShortcuts.push({
        key: 's',
        description: 'Admin Dashboard',
        action: goToAdminDashboard,
        requireMod: true,
        requireShift: true,
      });
    }

    return baseShortcuts;
  }, [goToDashboard, goToAdminDashboard, onShowShortcuts, isAdmin]);

  useKeyboardShortcuts({
    disabled,
    shortcuts,
  });
}
