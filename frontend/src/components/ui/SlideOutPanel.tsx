/**
 * SlideOutPanel Component
 *
 * A panel that slides in from the right side of the screen.
 * Used for secondary content like settings, filters, etc.
 *
 * @example
 * <SlideOutPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Settings"
 * >
 *   <p>Panel content</p>
 * </SlideOutPanel>
 */

import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from '../primitives/IconButton';

interface SlideOutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Width of the panel. Default is 'md' (28rem / 448px) */
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

// Get all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

const WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

export function SlideOutPanel({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
}: SlideOutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Track if mousedown started on backdrop (for proper click detection)
  const mouseDownOnBackdropRef = useRef(false);

  // Animation state - keeps component mounted during exit animation
  // Combined into single state to avoid cascading renders
  const [animationState, setAnimationState] = useState<'closed' | 'open' | 'closing'>(() =>
    isOpen ? 'open' : 'closed'
  );

  // Derived values from animation state
  const shouldRender = animationState !== 'closed';
  const isAnimatingOut = animationState === 'closing';

  // Handle open/close transitions (useLayoutEffect to avoid visual flicker)
  // setState is intentional here for animation state machine transitions
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (isOpen) {
      // Opening: render immediately
      setAnimationState('open');
    } else if (animationState === 'open') {
      // Closing: start exit animation
      setAnimationState('closing');
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setAnimationState('closed');
      }, 200); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, animationState]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle keyboard events - escape to close, tab for focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      // Focus trap - handle Tab key
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [onClose]
  );

  // Store previous focus and set up event listener
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Set initial focus when panel opens
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const timer = requestAnimationFrame(() => {
        if (panelRef.current) {
          const focusable = getFocusableElements(panelRef.current);
          const formField = focusable.find(
            (el) =>
              el.tagName === 'INPUT' ||
              el.tagName === 'SELECT' ||
              el.tagName === 'TEXTAREA'
          );

          if (formField) {
            formField.focus();
          } else {
            panelRef.current.focus();
          }
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [isOpen]);

  // Restore focus when panel closes
  // We blur immediately after to prevent tooltips from showing on the trigger element
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      // Briefly focus then blur to maintain accessibility while preventing tooltip flash
      previousFocusRef.current.focus();
      // Blur after a microtask to prevent tooltip from activating on focus
      requestAnimationFrame(() => {
        if (previousFocusRef.current) {
          previousFocusRef.current.blur();
        }
        previousFocusRef.current = null;
      });
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  // Track mousedown on backdrop to prevent closing during text selection
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    // Only set flag if mousedown is directly on the backdrop
    mouseDownOnBackdropRef.current = e.target === e.currentTarget;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    // Only close if both mousedown AND mouseup occurred on the backdrop
    // This prevents closing when dragging to select text
    if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) {
      onClose();
    }
    mouseDownOnBackdropRef.current = false;
  };

  const widthClass = WIDTH_CLASSES[width];

  // Animation classes based on state
  const backdropAnimation = isAnimatingOut ? 'animate-fade-out' : 'animate-fade-in';
  const panelAnimation = isAnimatingOut ? 'animate-slide-out-right' : 'animate-slide-in-right';

  return createPortal(
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-50 flex justify-end bg-black/60 ${backdropAnimation}`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        tabIndex={-1}
        className={`bg-surface-card border-l border-border-default w-full ${widthClass} h-full flex flex-col focus:outline-none ${panelAnimation}`}
      >
        {/* Header - sticky */}
        <div className="flex items-center justify-between p-4 border-b border-border-default flex-shrink-0">
          <h2
            id="panel-title"
            className="font-display text-lg text-accent"
          >
            {title}
          </h2>
          <IconButton
            icon={<X className="w-5 h-5" />}
            onClick={onClose}
            variant="ghost"
            aria-label="Close panel"
          />
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SlideOutPanel;
