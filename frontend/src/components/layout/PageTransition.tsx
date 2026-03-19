/**
 * PageTransition - Smooth fade-in transition on route changes.
 *
 * Wraps page content with framer-motion for enter animations only.
 * Exit animations are intentionally omitted because React Router's
 * Outlet re-renders with the new route's content during AnimatePresence
 * exit, causing the new page to briefly flash then fade out.
 *
 * Respects prefers-reduced-motion via useDevice hook.
 */

import { useLocation, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDevice } from '../../hooks/useDevice';

export function PageTransition() {
  const location = useLocation();
  const { prefersReducedMotion } = useDevice();

  if (prefersReducedMotion) {
    return <Outlet />;
  }

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] } }}
      className="flex-1 min-h-0 flex flex-col"
    >
      <Outlet />
    </motion.div>
  );
}
