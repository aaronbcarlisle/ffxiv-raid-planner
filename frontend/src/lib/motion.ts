/**
 * Motion presets for framer-motion animations.
 *
 * All presets use CSS variable-based durations for consistency with the design system.
 * Gate on `prefersReducedMotion` from useDevice() before applying.
 */

import type { Variants, Transition } from 'framer-motion';

// Duration constants matching CSS tokens (in seconds for framer-motion)
const DURATION_FAST = 0.15;
const DURATION_NORMAL = 0.2;
const DURATION_SLOW = 0.3;

const ease = [0.4, 0, 0.2, 1] as const; // cubic-bezier matching index.css

// --- Individual element presets ---

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION_FAST, ease } },
  exit: { opacity: 0, transition: { duration: DURATION_FAST, ease } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION_NORMAL, ease } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION_FAST, ease } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION_NORMAL, ease } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: DURATION_FAST, ease } },
};

// --- Stagger container + item presets ---

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_NORMAL, ease },
  },
};

// --- Page transition ---

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION_FAST, ease } },
  exit: { opacity: 0, transition: { duration: DURATION_FAST, ease } },
};

// --- Reduced motion variants (instant, no movement) ---

export const instantVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

// --- Toast presets ---

export const toastSlideIn: Variants = {
  hidden: { opacity: 0, x: 80, scale: 0.95 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { duration: DURATION_NORMAL, ease } },
  exit: { opacity: 0, x: 80, scale: 0.95, transition: { duration: DURATION_FAST, ease } },
};

export const toastSlideInMobile: Variants = {
  hidden: { opacity: 0, y: -40, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: DURATION_NORMAL, ease } },
  exit: { opacity: 0, y: -40, scale: 0.95, transition: { duration: DURATION_FAST, ease } },
};

// --- Shared transition configs ---

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  duration: DURATION_SLOW,
  ease,
};
