import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from '../primitives/IconButton';
import { useDevice } from '../../hooks/useDevice';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'; // sm=24rem, md=28rem (default), lg=32rem, xl=36rem, 2xl=42rem, 3xl=48rem, 4xl=56rem, 5xl=64rem
  /** Display variant - 'dialog' (centered) or 'sheet' (slides up from bottom). Auto-selects based on screen size if not specified. */
  variant?: 'dialog' | 'sheet';
  /** Optional sticky footer content */
  footer?: React.ReactNode;
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

export function Modal({ isOpen, onClose, title, children, size = 'md', variant, footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { isSmallScreen } = useDevice();

  // Auto-select variant based on screen size if not specified
  const effectiveVariant = variant ?? (isSmallScreen ? 'sheet' : 'dialog');

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

  // Variant-specific classes
  const isSheet = effectiveVariant === 'sheet';
  const containerClasses = isSheet
    ? 'fixed left-0 right-0 bottom-0 max-h-[85dvh] rounded-t-xl animate-slide-up'
    : `relative max-h-[90vh] rounded-lg ${sizeClass}`;

  // Use portal to render at document body level, preventing inherited styles (opacity, transforms)
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex ${isSheet ? 'items-end' : 'items-center'} justify-center bg-black/80 ${isSheet ? '' : 'p-4'}`}
      onClick={handleBackdropEvent}
      onContextMenu={handleBackdropEvent}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`bg-surface-card border border-border-default w-full flex flex-col focus:outline-none ${containerClasses}`}
      >
        {/* Header - sticky */}
        <div className="flex items-center justify-between p-4 border-b border-border-default flex-shrink-0">
          <h2 id="modal-title" className="font-display text-xl text-accent">{title}</h2>
          <IconButton
            icon={<X className="w-5 h-5" />}
            onClick={onClose}
            variant="ghost"
            aria-label="Close modal"
          />
        </div>

        {/* Content - scrollable, with overscroll-contain to prevent bounce effect */}
        {/* For sheet modals without footer, add bottom padding to clear home indicator */}
        <div className={`p-6 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 ${isSheet && !footer ? 'pb-6' : ''}`}>{children}</div>

        {/* Footer - sticky with extra bottom padding for sheet variant to clear home indicator */}
        {footer && (
          <div className={`border-t border-border-default p-4 flex-shrink-0 ${isSheet ? 'pb-8 pb-safe' : ''}`}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
