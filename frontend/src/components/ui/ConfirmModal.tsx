/**
 * ConfirmModal - Simple confirmation dialog
 *
 * A lightweight modal for confirm/cancel dialogs.
 * Use for delete confirmations and other destructive actions that
 * don't require type-to-confirm.
 */

import { useState, type ReactNode } from 'react';
import { Trash2, AlertTriangle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../primitives';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  /** Optional custom icon for the title. If not provided, uses variant-based default. */
  icon?: ReactNode;
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
  icon,
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
    },
    warning: {
      icon: 'text-status-warning',
      bg: 'bg-status-warning/10 border-status-warning/30',
    },
    default: {
      icon: 'text-accent',
      bg: 'bg-accent/10 border-accent/30',
    },
  };

  const styles = variantStyles[variant];

  // Map ConfirmModal variant to Button variant
  const buttonVariant = variant === 'default' ? 'primary' : variant;

  // Determine the icon: use provided icon, or default based on variant
  const getDefaultIcon = () => {
    if (variant === 'danger') {
      return <Trash2 className="w-5 h-5 text-status-error" />;
    }
    if (variant === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-status-warning" />;
    }
    return <Info className="w-5 h-5 text-accent" />;
  };

  const titleIcon = icon ?? getDefaultIcon();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-2">
          {titleIcon}
          {title}
        </span>
      }
      size="md"
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
          <div className="text-sm text-text-primary">{message}</div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={buttonVariant}
            onClick={handleConfirm}
            loading={isConfirming}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
