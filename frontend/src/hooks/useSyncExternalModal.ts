/**
 * useSyncExternalModal Hook
 *
 * Synchronizes external modal open signals (e.g., from keyboard shortcuts)
 * with internal modal state. When the external signal is true but the
 * internal state is false, it opens the modal and runs an optional callback.
 */

import { useEffect, useRef } from 'react';

/**
 * Sync external modal open trigger with internal modal state
 *
 * Uses a ref for the onSync callback to avoid requiring callers to memoize it.
 * This makes the hook resilient to non-memoized inline callbacks.
 *
 * @param externalOpen - External trigger (e.g., from keyboard shortcut)
 * @param internalOpen - Current internal modal state
 * @param setInternalOpen - Setter for internal modal state
 * @param onSync - Optional callback when syncing (e.g., to reset other state).
 *                 Does not need to be memoized - stored in ref internally.
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
  // Store onSync in a ref to get the latest version without triggering effect re-runs
  const onSyncRef = useRef(onSync);

  // Update ref in effect to comply with React Compiler rules (no ref writes during render)
  useEffect(() => {
    onSyncRef.current = onSync;
  });

  useEffect(() => {
    if (externalOpen && !internalOpen) {
      setInternalOpen(true);
      onSyncRef.current?.();
    }
  }, [externalOpen, internalOpen, setInternalOpen]);
}
