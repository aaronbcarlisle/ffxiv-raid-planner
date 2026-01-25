/**
 * Toast Container - Fixed position container for toast notifications
 *
 * Mobile: Displays toasts at top (below sticky header) to avoid bottom nav/FABs.
 * Desktop: Displays toasts in bottom-right corner.
 * Auto-dismiss after duration.
 */

import { useEffect, useCallback } from 'react';
import { useToastStore, type Toast, type ToastType } from '../../stores/toastStore';

// Icons for each toast type
const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Color classes for each toast type
const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-status-success/20 border-status-success/40 text-status-success',
  error: 'bg-status-error/20 border-status-error/40 text-status-error',
  warning: 'bg-status-warning/20 border-status-warning/40 text-status-warning',
  info: 'bg-accent/20 border-accent/40 text-accent',
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [toast.id, onDismiss]);

  const handleAction = useCallback(() => {
    toast.action?.onClick();
    onDismiss(toast.id);
  }, [toast.action, toast.id, onDismiss]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(handleDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleDismiss]);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg
        backdrop-blur-md sm:backdrop-blur-none
        animate-in slide-in-from-top-full sm:slide-in-from-right-full fade-in-0 duration-200
        ${TOAST_COLORS[toast.type]}
      `}
      role="alert"
    >
      <span className="flex-shrink-0 mt-0.5">
        {TOAST_ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">
          {toast.message}
        </p>
        {toast.action && (
          <button
            onClick={handleAction}
            className="mt-2 text-xs font-semibold underline underline-offset-2 hover:no-underline transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-16 sm:top-auto sm:bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 max-w-md w-auto sm:w-full pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>
  );
}
