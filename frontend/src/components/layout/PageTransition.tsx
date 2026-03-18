/**
 * PageTransition - Smooth fade transition between route changes.
 *
 * Wraps page content with framer-motion AnimatePresence for enter/exit
 * animations. Respects prefers-reduced-motion via useDevice hook.
 */

import { useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDevice } from '../../hooks/useDevice';
import { pageTransition, instantVariants } from '../../lib/motion';

export function PageTransition() {
  const location = useLocation();
  const { prefersReducedMotion } = useDevice();

  const variants = prefersReducedMotion ? instantVariants : pageTransition;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex-1 min-h-0 flex flex-col"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
