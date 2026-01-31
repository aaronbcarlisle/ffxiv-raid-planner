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

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from '../primitives/IconButton';

interface SlideOutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Width of the panel. Default is 'md' (28rem / 448px) */
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
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
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        tabIndex={-1}
        className={`bg-surface-card border-l border-border-default w-full ${widthClass} h-full flex flex-col focus:outline-none animate-slide-in-right`}
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
