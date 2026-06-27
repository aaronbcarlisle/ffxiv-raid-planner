/**
 * RightDockPanel — a right-docked panel that sits BELOW the header band and
 * overlays only the content area (never the header). The global header stays
 * above it in z-order (header is z-40, this is z-30) so its controls — notably
 * the settings gear — remain visible and clickable while the panel is open.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelRightClose } from 'lucide-react';

interface RightDockPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Panel width (e.g. SETTINGS_PANEL_WIDTH). */
  width: string;
  title?: ReactNode;
  children: ReactNode;
}

export function RightDockPanel({ isOpen, onClose, width, title, children }: RightDockPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop over content only (below the header band, below the panel) */}
          <motion.div
            data-testid="rightdock-backdrop"
            className="fixed inset-x-0 bottom-0 z-20 bg-black/40"
            style={{ top: 'var(--header-height, 56px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          {/* Docked panel */}
          <motion.aside
            role="dialog"
            aria-label="Static settings"
            className="fixed right-0 bottom-0 z-30 bg-surface-raised border-l border-border-default shadow-2xl flex flex-col"
            style={{ top: 'var(--header-height, 56px)', width, maxWidth: '100vw' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {title && (
              /* Clicking the title bar closes the panel (in addition to the
                 header gear); the chevron-into-panel icon signals the affordance. */
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="group flex items-center justify-between px-4 h-12 border-b border-border-default flex-shrink-0 w-full text-left hover:bg-white/[0.03] transition-colors"
              >
                <div className="font-semibold text-text-primary">{title}</div>
                <PanelRightClose className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors flex-shrink-0" />
              </button>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
