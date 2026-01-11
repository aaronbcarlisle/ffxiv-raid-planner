/**
 * TextArea Component
 *
 * Multi-line text input following the design system patterns.
 *
 * @example
 * <TextArea
 *   value={notes}
 *   onChange={setNotes}
 *   placeholder="Add notes..."
 *   rows={4}
 * />
 */

import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Error message (displays error styling) */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Full width */
  fullWidth?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      value,
      onChange,
      error,
      helperText,
      fullWidth = true,
      disabled,
      rows = 3,
      className = '',
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={rows}
          className={`
            w-full rounded-lg border px-4 py-3
            bg-surface-elevated
            text-text-primary placeholder:text-text-muted
            transition-colors duration-fast
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-card
            resize-y min-h-[80px]
            ${hasError
              ? 'border-status-error focus-visible:border-status-error focus-visible:ring-status-error/30'
              : 'border-border-default focus-visible:border-accent focus-visible:ring-accent/30 hover:border-border-subtle'
            }
            ${className}
          `}
          {...props}
        />

        {/* Helper/Error Text */}
        {(error || helperText) && (
          <p className={`mt-1.5 text-sm ${hasError ? 'text-status-error' : 'text-text-muted'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default TextArea;
