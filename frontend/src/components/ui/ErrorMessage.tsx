/**
 * ErrorMessage Component
 *
 * Displays error messages with optional retry and dismiss functionality.
 * Provides consistent error styling across the application.
 *
 * @example Basic usage:
 * ```tsx
 * {error && (
 *   <ErrorMessage
 *     message={error}
 *     onDismiss={() => setError(null)}
 *   />
 * )}
 * ```
 *
 * @example With retry:
 * ```tsx
 * {error && (
 *   <ErrorMessage
 *     message={error}
 *     onRetry={() => fetchData()}
 *     onDismiss={() => setError(null)}
 *     retrying={isLoading}
 *   />
 * )}
 * ```
 */

import { RefreshCw, X } from 'lucide-react';
import { IconButton } from '../primitives';

export interface ErrorMessageProps {
  /** The error message to display */
  message: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Whether a retry is currently in progress */
  retrying?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

export function ErrorMessage({
  message,
  onRetry,
  onDismiss,
  retrying = false,
  className = '',
  size = 'md',
}: ErrorMessageProps) {
  const padding = size === 'sm' ? 'p-3' : 'p-4';
  const textSize = size === 'sm' ? 'text-sm' : 'text-base';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div
      className={`bg-status-error/10 border border-status-error/30 rounded-lg ${padding} ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Error icon */}
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className={`${iconSize} text-status-error`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className={`text-status-error ${textSize}`}>{message}</p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {onRetry && (
            <IconButton
              icon={
                <RefreshCw
                  className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
                    retrying ? 'animate-spin' : ''
                  }`}
                />
              }
              onClick={onRetry}
              variant="ghost"
              size={size}
              aria-label="Retry"
              title="Retry"
              disabled={retrying}
              className="text-status-error hover:text-status-error/80 hover:bg-status-error/10"
            />
          )}
          {onDismiss && (
            <IconButton
              icon={<X className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
              onClick={onDismiss}
              variant="ghost"
              size={size}
              aria-label="Dismiss error"
              title="Dismiss"
              className="text-status-error hover:text-status-error/80 hover:bg-status-error/10"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error message for form fields
 */
export function InlineError({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}) {
  return (
    <p className={`text-sm text-status-error ${className}`} role="alert">
      {message}
    </p>
  );
}

/**
 * ErrorBox - Simple contextual error display for modals and panels
 *
 * Use this for inline contextual errors that don't need retry/dismiss buttons.
 * For page-level errors with actions, use ErrorMessage instead.
 *
 * @example
 * ```tsx
 * {error && <ErrorBox message={error} />}
 * ```
 */
export interface ErrorBoxProps {
  /** The error message to display */
  message: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant - sm has tighter padding */
  size?: 'sm' | 'md';
}

export function ErrorBox({ message, className = '', size = 'md' }: ErrorBoxProps) {
  if (!message) return null;

  const padding = size === 'sm' ? 'p-3' : 'p-4';

  return (
    <div
      className={`bg-status-error/10 border border-status-error/30 rounded-lg ${padding} text-sm text-status-error ${className}`}
      role="alert"
    >
      {message}
    </div>
  );
}
