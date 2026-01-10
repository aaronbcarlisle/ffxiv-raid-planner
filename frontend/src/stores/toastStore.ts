/**
 * Toast Store - Zustand store for toast notifications
 *
 * Provides a queue-based toast system with auto-dismiss.
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // milliseconds, 0 = persistent
  action?: ToastAction; // Optional action button (e.g., "Retry")
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

// Default durations by type (in ms)
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

/**
 * Convenience API for creating toasts
 *
 * Usage:
 *   toast.success('Player saved!')
 *   toast.error('Failed to update gear')
 *   toast.errorWithRetry('Failed to save', retryFunction)
 *   toast.warning('Unsaved changes')
 *   toast.info('Copied to clipboard')
 */
export const toast = {
  success: (message: string, duration?: number) => {
    return useToastStore.getState().addToast({
      type: 'success',
      message,
      duration: duration ?? DEFAULT_DURATIONS.success,
    });
  },

  error: (message: string, duration?: number) => {
    return useToastStore.getState().addToast({
      type: 'error',
      message,
      duration: duration ?? DEFAULT_DURATIONS.error,
    });
  },

  /** Show error toast with a Retry button */
  errorWithRetry: (message: string, onRetry: () => void, duration?: number) => {
    return useToastStore.getState().addToast({
      type: 'error',
      message,
      duration: duration ?? 8000, // Longer duration to allow retry
      action: {
        label: 'Retry',
        onClick: onRetry,
      },
    });
  },

  warning: (message: string, duration?: number) => {
    return useToastStore.getState().addToast({
      type: 'warning',
      message,
      duration: duration ?? DEFAULT_DURATIONS.warning,
    });
  },

  info: (message: string, duration?: number) => {
    return useToastStore.getState().addToast({
      type: 'info',
      message,
      duration: duration ?? DEFAULT_DURATIONS.info,
    });
  },

  dismiss: (id: string) => {
    useToastStore.getState().removeToast(id);
  },

  dismissAll: () => {
    useToastStore.getState().clearAll();
  },
};
