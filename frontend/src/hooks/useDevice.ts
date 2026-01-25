/**
 * useDevice - Device capability detection hook
 *
 * Provides information about the user's device capabilities for responsive
 * design decisions beyond CSS media queries (e.g., disabling tooltips on touch).
 */

import { useState, useEffect } from 'react';

interface DeviceCapabilities {
  /** Viewport width <= 640px (Tailwind 'sm' breakpoint) */
  isSmallScreen: boolean;
  /** Touch-capable device (pointer: coarse OR maxTouchPoints > 0) */
  isTouch: boolean;
  /** Supports hover interactions (hover: hover AND pointer: fine) */
  canHover: boolean;
  /** User prefers reduced motion */
  prefersReducedMotion: boolean;
}

export function useDevice(): DeviceCapabilities {
  // Initialize with synchronous check to prevent flash of incorrect UI on mobile
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(() => {
    if (typeof window === 'undefined') {
      return { isSmallScreen: false, isTouch: false, canHover: true, prefersReducedMotion: false };
    }
    return {
      isSmallScreen: window.matchMedia('(max-width: 640px)').matches,
      isTouch: window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
      canHover: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const smallScreenQuery = window.matchMedia('(max-width: 640px)');
    const touchQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      setCapabilities({
        isSmallScreen: smallScreenQuery.matches,
        isTouch: touchQuery.matches || navigator.maxTouchPoints > 0,
        canHover: hoverQuery.matches,
        prefersReducedMotion: motionQuery.matches,
      });
    };

    update();

    smallScreenQuery.addEventListener('change', update);
    touchQuery.addEventListener('change', update);
    hoverQuery.addEventListener('change', update);
    motionQuery.addEventListener('change', update);

    return () => {
      smallScreenQuery.removeEventListener('change', update);
      touchQuery.removeEventListener('change', update);
      hoverQuery.removeEventListener('change', update);
      motionQuery.removeEventListener('change', update);
    };
  }, []);

  return capabilities;
}
