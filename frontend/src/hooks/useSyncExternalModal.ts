/**
 * useSyncExternalModal Hook
 *
 * Synchronizes external modal open signals (e.g., from keyboard shortcuts)
 * with internal modal state. When the external signal is true but the
 * internal state is false, it opens the modal and runs an optional callback.
 */

import { useEffect } from 'react';

/**
 * Sync external modal open trigger with internal modal state
 *
 * @param externalOpen - External trigger (e.g., from keyboard shortcut)
 * @param internalOpen - Current internal modal state
 * @param setInternalOpen - Setter for internal modal state
 * @param onSync - Optional callback when syncing (e.g., to reset other state)
 *
 * @example
 * ```tsx
 * useSyncExternalModal(
 *   openLogLootModal,
 *   showLootModal,
 *   setShowLootModal,
 *   () => {
 *     setGridModalState(null);
 *     setEntryToEdit(undefined);
 *   }
 * );
 * ```
 */
export function useSyncExternalModal(
  externalOpen: boolean | undefined,
  internalOpen: boolean,
  setInternalOpen: (open: boolean) => void,
  onSync?: () => void
): void {
  useEffect(() => {
    if (externalOpen && !internalOpen) {
      setInternalOpen(true);
      onSync?.();
    }
  }, [externalOpen, internalOpen, setInternalOpen, onSync]);
}
