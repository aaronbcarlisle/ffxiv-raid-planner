/**
 * useSwipe - Hook for detecting horizontal swipe gestures
 *
 * Returns touch event handlers to attach to a container element.
 * Calls onSwipeLeft/onSwipeRight when a horizontal swipe is detected.
 */

import { useRef, useCallback } from 'react';

interface UseSwipeOptions {
  /** Callback when user swipes left */
  onSwipeLeft?: () => void;
  /** Callback when user swipes right */
  onSwipeRight?: () => void;
  /** Minimum distance in pixels to trigger a swipe (default: 50) */
  minSwipeDistance?: number;
  /** Maximum vertical distance allowed (default: 100) */
  maxVerticalDistance?: number;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
  maxVerticalDistance = 100,
}: UseSwipeOptions): SwipeHandlers {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = Math.abs(touchEndY - touchStartY.current);

    // Reset touch start positions
    touchStartX.current = null;
    touchStartY.current = null;

    // Ignore if vertical movement is too large (user is scrolling)
    if (deltaY > maxVerticalDistance) return;

    // Check for horizontal swipe
    if (Math.abs(deltaX) >= minSwipeDistance) {
      if (deltaX > 0) {
        // Swiped right
        onSwipeRight?.();
      } else {
        // Swiped left
        onSwipeLeft?.();
      }
    }
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance, maxVerticalDistance]);

  return { onTouchStart, onTouchEnd };
}
