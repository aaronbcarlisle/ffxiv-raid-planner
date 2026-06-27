/**
 * RightDockPanel — a right-docked panel that sits BELOW the header band and
 * overlays only the content area (never the header). The global header stays
 * above it in z-order (header is z-40, this is z-30) so its controls — notably
 * the settings gear — remain visible and clickable while the panel is open.
 *
 * The panel content stays MOUNTED across open/close and slides off-screen when
 * closed (instead of unmounting). This makes re-opening instant — the children
 * (e.g. the whole SettingsPanel + its tabs) mount once rather than on every
 * open. When closed it's translated out, `inert`, and finally `visibility:hidden`
 * once the slide-out settles so it can't be focused, read, or cause overflow.
 */
import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface RightDockPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Panel width (e.g. SETTINGS_PANEL_WIDTH). */
  width: string;
  title?: ReactNode;
  children: ReactNode;
}

export function RightDockPanel({ isOpen, onClose, width, title, children }: RightDockPanelProps) {
  // `settledClosed` hides the off-screen panel once the slide-out finishes, so a
  // closed panel can't trigger horizontal overflow or be tabbed into. It starts
  // matching isOpen and only flips back to visible the instant we re-open.
  // Adjust during render (React's recommended pattern) rather than in an effect.
  const [settledClosed, setSettledClosed] = useState(!isOpen);
  if (isOpen && settledClosed) setSettledClosed(false);

  return (
    <>
      {/* Backdrop over content only (below the header band, below the panel).
          Cheap, so it still mounts/unmounts with open-state. */}
      <AnimatePresence>
        {isOpen && (
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
        )}
      </AnimatePresence>

      {/* Docked panel — stays mounted; slides in/out via transform. */}
      <motion.aside
        role="dialog"
        aria-label="Static settings"
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
        className="fixed right-0 bottom-0 z-30 bg-surface-raised border-l border-border-default shadow-2xl flex flex-col"
        style={{
          top: 'var(--header-height, 56px)',
          width,
          maxWidth: '100vw',
          visibility: settledClosed ? 'hidden' : 'visible',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        initial={false}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onAnimationComplete={() => { if (!isOpen) setSettledClosed(true); }}
      >
        {title && (
          <div className="flex items-center justify-between px-4 h-12 border-b border-border-default flex-shrink-0">
            <div className="font-semibold text-text-primary">{title}</div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </motion.aside>
    </>
  );
}
