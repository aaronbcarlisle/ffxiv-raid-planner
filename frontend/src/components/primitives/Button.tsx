/**
 * Button - Unified button component with variants
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from '../ui/Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'success' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show loading spinner */
  loading?: boolean;
  /** Icon to show before text */
  leftIcon?: ReactNode;
  /** Icon to show after text */
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-contrast hover:bg-accent-hover active:brightness-95',
  secondary:
    'bg-surface-elevated border border-border-default text-text-secondary hover:border-accent/30 hover:text-text-primary active:bg-surface-overlay',
  ghost:
    'bg-transparent text-accent hover:bg-active-bg active:bg-accent/20',
  danger:
    'bg-status-error/20 text-status-error border border-status-error/40 hover:bg-status-error/30 active:bg-status-error/40 focus-visible:ring-status-error/50',
  warning:
    'bg-status-warning/20 text-status-warning border border-status-warning/40 hover:bg-status-warning/30 active:bg-status-warning/40 focus-visible:ring-status-warning/50',
  success:
    'bg-status-success/20 text-status-success border border-status-success/40 hover:bg-status-success/30 active:bg-status-success/40 focus-visible:ring-status-success/50',
  link:
    'bg-transparent text-accent text-sm underline-offset-4 hover:underline active:text-accent-hover',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap
          transition-all duration-fast
          focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantStyles[variant]}
          ${variant !== 'link' ? sizeStyles[size] : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" color="current" label="Loading" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
