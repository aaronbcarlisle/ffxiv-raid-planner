/**
 * useLongPress - Hook for detecting long press gestures on mobile
 *
 * Returns touch event handlers to attach to an element.
 * Calls onLongPress when a long press is detected.
 * Prevents context menu from showing during long press.
 */

import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  /** Callback when long press is detected */
  onLongPress: () => void;
  /** Duration in ms to trigger long press (default: 500) */
  duration?: number;
  /** Callback for regular click/tap (optional) */
  onClick?: () => void;
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useLongPress({
  onLongPress,
  duration = 500,
  onClick,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Store initial touch position for movement detection
    touchStartPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    isLongPressRef.current = false;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, duration);
  }, [onLongPress, duration]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimer();

    // If it was a long press, prevent any further actions
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }

    // Otherwise, it's a regular tap - call onClick if provided
    if (onClick) {
      onClick();
    }
  }, [clearTimer, onClick]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long press if user moves finger too much
    if (touchStartPosRef.current) {
      const moveThreshold = 10; // pixels
      const deltaX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);

      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clearTimer();
      }
    }
  }, [clearTimer]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // Prevent context menu during/after long press
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onContextMenu,
  };
}
