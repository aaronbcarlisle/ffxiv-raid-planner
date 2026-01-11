/**
 * Input Component
 *
 * Styled text input with variants for different states.
 * Follows the design system surface hierarchy and focus patterns.
 *
 * @example
 * // Basic usage
 * <Input value={name} onChange={setName} placeholder="Enter name" />
 *
 * // With error
 * <Input value={email} onChange={setEmail} error="Invalid email" />
 *
 * // With icon
 * <Input
 *   value={search}
 *   onChange={setSearch}
 *   leftIcon={<Search className="w-4 h-4" />}
 * />
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Error message (displays error styling) */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Icon on the left side */
  leftIcon?: ReactNode;
  /** Icon on the right side */
  rightIcon?: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
}

const sizeStyles = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-4 text-lg',
};

const iconSizeStyles = {
  sm: 'pl-8',
  md: 'pl-10',
  lg: 'pl-12',
};

const rightIconSizeStyles = {
  sm: 'pr-8',
  md: 'pr-10',
  lg: 'pr-12',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      onChange,
      error,
      helperText,
      leftIcon,
      rightIcon,
      size = 'md',
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              disabled ? 'text-text-disabled' : hasError ? 'text-status-error' : 'text-text-muted'
            }`}>
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`
              w-full rounded-lg border
              bg-surface-elevated
              text-text-primary placeholder:text-text-muted
              transition-colors duration-fast
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
              disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-card
              ${sizeStyles[size]}
              ${leftIcon ? iconSizeStyles[size] : ''}
              ${rightIcon ? rightIconSizeStyles[size] : ''}
              ${hasError
                ? 'border-status-error focus-visible:border-status-error focus-visible:ring-status-error/30'
                : 'border-border-default focus-visible:border-accent focus-visible:ring-accent/30 hover:border-border-subtle'
              }
              ${className}
            `}
            {...props}
          />

          {/* Right Icon */}
          {rightIcon && (
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${
              disabled ? 'text-text-disabled' : hasError ? 'text-status-error' : 'text-text-muted'
            }`}>
              {rightIcon}
            </div>
          )}
        </div>

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

Input.displayName = 'Input';

export default Input;
