/**
 * useDevice - Device capability detection hook
 *
 * Provides information about the user's device capabilities for responsive
 * design decisions beyond CSS media queries (e.g., disabling tooltips on touch).
 *
 * Uses useSyncExternalStore with a singleton store to share media query listeners
 * across all component instances, avoiding duplicate listener registration.
 */

import { useSyncExternalStore } from 'react';

interface DeviceCapabilities {
  /** Viewport width < 640px (matches Tailwind's sm: breakpoint at 640px) */
  isSmallScreen: boolean;
  /** Touch-capable device (pointer: coarse OR maxTouchPoints > 0) */
  isTouch: boolean;
  /** Supports hover interactions (hover: hover AND pointer: fine) */
  canHover: boolean;
  /** User prefers reduced motion */
  prefersReducedMotion: boolean;
}

// Singleton store for device capabilities
// Listeners are registered once globally, not per component instance
let capabilities: DeviceCapabilities = {
  isSmallScreen: false,
  isTouch: false,
  canHover: true,
  prefersReducedMotion: false,
};

const listeners: Set<() => void> = new Set();
let initialized = false;

function initializeStore() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const smallScreenQuery = window.matchMedia('(max-width: 639px)');
  const touchQuery = window.matchMedia('(pointer: coarse)');
  const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const update = () => {
    capabilities = {
      isSmallScreen: smallScreenQuery.matches,
      isTouch: touchQuery.matches || navigator.maxTouchPoints > 0,
      canHover: hoverQuery.matches,
      prefersReducedMotion: motionQuery.matches,
    };
    // Notify all subscribers
    listeners.forEach(listener => listener());
  };

  // Set initial values
  update();

  // Register listeners once globally
  smallScreenQuery.addEventListener('change', update);
  touchQuery.addEventListener('change', update);
  hoverQuery.addEventListener('change', update);
  motionQuery.addEventListener('change', update);
}

function subscribe(listener: () => void): () => void {
  initializeStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DeviceCapabilities {
  initializeStore();
  return capabilities;
}

function getServerSnapshot(): DeviceCapabilities {
  // SSR fallback - assume desktop
  return {
    isSmallScreen: false,
    isTouch: false,
    canHover: true,
    prefersReducedMotion: false,
  };
}

export function useDevice(): DeviceCapabilities {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
