import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from '../primitives/IconButton';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'; // sm=24rem, md=28rem (default), lg=32rem, xl=36rem, 2xl=42rem, 3xl=48rem, 4xl=56rem, 5xl=64rem
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

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle keyboard events - escape to close, tab for focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // Use stopImmediatePropagation to prevent other modal escape handlers from firing
      // This ensures only the topmost modal closes when Escape is pressed
      e.stopImmediatePropagation();
      onClose();
      return;
    }

    // Focus trap - handle Tab key
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [onClose]);

  // Store previous focus and set up event listener
  useEffect(() => {
    if (!isOpen) return;

    // Store currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Set initial focus when modal opens
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Small delay to ensure modal content is rendered
      const timer = requestAnimationFrame(() => {
        if (modalRef.current) {
          const focusable = getFocusableElements(modalRef.current);

          // Prefer focusing form fields over buttons to avoid focus ring on close button
          const formField = focusable.find(el =>
            el.tagName === 'INPUT' ||
            el.tagName === 'SELECT' ||
            el.tagName === 'TEXTAREA'
          );

          if (formField) {
            formField.focus();
          } else {
            // No form fields - focus modal container itself (with tabindex=-1, no visible ring)
            modalRef.current.focus();
          }
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [isOpen]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      // Restore focus to the element that opened the modal
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Prevent all mouse events from passing through to elements behind the modal
  const handleBackdropEvent = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const sizeClass = SIZE_CLASSES[size];

  // Use portal to render at document body level, preventing inherited styles (opacity, transforms)
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropEvent}
      onContextMenu={handleBackdropEvent}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`bg-surface-card border border-border-default rounded-lg w-full ${sizeClass} max-h-[90vh] flex flex-col focus:outline-none`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-default flex-shrink-0">
          <h2 id="modal-title" className="font-display text-xl text-accent">{title}</h2>
          <IconButton
            icon={<X className="w-5 h-5" />}
            onClick={onClose}
            variant="ghost"
            aria-label="Close modal"
          />
        </div>
        <div className="p-6 overflow-y-auto overflow-x-hidden flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
