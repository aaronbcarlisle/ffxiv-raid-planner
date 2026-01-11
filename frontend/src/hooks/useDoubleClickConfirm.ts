/**
 * useDoubleClickConfirm - Hook for double-click confirmation pattern
 *
 * For destructive actions that don't need type-to-confirm but should prevent accidents:
 * 1. First click: Arms the action (button changes to confirmation state)
 * 2. Second click: Executes the action
 * 3. Auto-resets after timeout if not confirmed
 * 4. Resets on blur (click away or tab out)
 *
 * @example
 * const { isArmed, handleClick, handleBlur, resetArmed } = useDoubleClickConfirm({
 *   onConfirm: async () => { await deleteItem(); },
 *   timeout: 3000,
 * });
 *
 * <button
 *   onClick={handleClick}
 *   onBlur={handleBlur}
 *   disabled={isLoading}
 * >
 *   {isArmed ? 'Confirm?' : 'Delete'}
 * </button>
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDoubleClickConfirmOptions {
  /** Callback when user confirms (second click) */
  onConfirm: () => void | Promise<void>;
  /** Timeout in ms before auto-resetting (default: 3000) */
  timeout?: number;
  /** Delay before resetting on blur (default: 100) */
  blurDelay?: number;
}

interface UseDoubleClickConfirmReturn {
  /** Whether the action is armed (waiting for confirmation) */
  isArmed: boolean;
  /** Click handler - first click arms, second click confirms */
  handleClick: () => void;
  /** Blur handler - resets armed state with small delay */
  handleBlur: () => void;
  /** Manually reset armed state */
  resetArmed: () => void;
}

export function useDoubleClickConfirm({
  onConfirm,
  timeout = 3000,
  blurDelay = 100,
}: UseDoubleClickConfirmOptions): UseDoubleClickConfirmReturn {
  const [isArmed, setIsArmed] = useState(false);
  const armedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetArmed = useCallback(() => {
    setIsArmed(false);
    if (armedTimeoutRef.current) {
      clearTimeout(armedTimeoutRef.current);
      armedTimeoutRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (isArmed) {
      // Second click - execute action
      resetArmed();
      onConfirm();
    } else {
      // First click - arm the button
      setIsArmed(true);
      armedTimeoutRef.current = setTimeout(() => {
        setIsArmed(false);
      }, timeout);
    }
  }, [isArmed, onConfirm, resetArmed, timeout]);

  const handleBlur = useCallback(() => {
    if (isArmed) {
      // Small delay to allow click to register first
      setTimeout(() => setIsArmed(false), blurDelay);
    }
  }, [isArmed, blurDelay]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (armedTimeoutRef.current) {
        clearTimeout(armedTimeoutRef.current);
      }
    };
  }, []);

  return {
    isArmed,
    handleClick,
    handleBlur,
    resetArmed,
  };
}
