/**
 * IconButton - Icon-only button with accessibility label
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { VisuallyHidden } from './VisuallyHidden';

type IconButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label (required for screen readers) */
  'aria-label': string;
  /** The icon to display */
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const variantStyles: Record<IconButtonVariant, string> = {
  default:
    'bg-surface-elevated border border-border-default text-text-secondary hover:border-accent/30 hover:text-text-primary active:bg-surface-overlay',
  primary:
    'bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 active:bg-accent/40',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-interactive hover:text-text-primary active:bg-surface-overlay',
  danger:
    'bg-transparent text-text-secondary hover:bg-status-error/20 hover:text-status-error active:bg-status-error/30',
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'h-7 w-7 text-sm',
  md: 'h-8 w-8 text-base',
  lg: 'h-10 w-10 text-lg',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      icon,
      variant = 'default',
      size = 'md',
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`
          inline-flex items-center justify-center rounded-lg
          transition-all duration-fast
          focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 focus:ring-offset-surface-base
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {icon}
        <VisuallyHidden>{ariaLabel}</VisuallyHidden>
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
