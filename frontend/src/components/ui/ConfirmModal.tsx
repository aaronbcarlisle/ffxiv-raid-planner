/**
 * ConfirmModal - Simple confirmation dialog
 *
 * A lightweight modal for confirm/cancel dialogs.
 * Use for delete confirmations and other destructive actions that
 * don't require type-to-confirm.
 */

import { useState } from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const variantStyles = {
    danger: {
      icon: 'text-status-error',
      bg: 'bg-status-error/10 border-status-error/30',
      button: 'bg-status-error text-white hover:bg-status-error/90',
    },
    warning: {
      icon: 'text-status-warning',
      bg: 'bg-status-warning/10 border-status-warning/30',
      button: 'bg-status-warning text-status-warning-contrast font-bold hover:brightness-110',
    },
    default: {
      icon: 'text-accent',
      bg: 'bg-accent/10 border-accent/30',
      button: 'bg-accent text-accent-contrast font-bold hover:bg-accent-hover',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        {/* Warning/Info message */}
        <div className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg}`}>
          {variant === 'danger' || variant === 'warning' ? (
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <p className="text-sm text-text-primary">{message}</p>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-interactive
                       rounded-lg hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${styles.button}`}
          >
            {isConfirming ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
