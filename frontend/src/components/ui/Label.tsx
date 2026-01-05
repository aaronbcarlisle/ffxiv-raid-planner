/**
 * Label Component
 *
 * Form label with optional required indicator.
 *
 * @example
 * <Label htmlFor="name">Player Name</Label>
 * <Label htmlFor="email" required>Email Address</Label>
 */

import type { LabelHTMLAttributes, ReactNode } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Label text or content */
  children: ReactNode;
  /** Show required asterisk */
  required?: boolean;
  /** Helper text (smaller, muted) */
  description?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Disabled styling */
  disabled?: boolean;
}

const sizeStyles = {
  sm: 'text-xs',
  md: 'text-sm',
};

export function Label({
  children,
  required = false,
  description,
  size = 'md',
  disabled = false,
  className = '',
  ...props
}: LabelProps) {
  return (
    <div className={`mb-1.5 ${className}`}>
      <label
        className={`
          block font-medium
          ${sizeStyles[size]}
          ${disabled ? 'text-text-disabled' : 'text-text-secondary'}
        `}
        {...props}
      >
        {children}
        {required && (
          <span className="text-status-error ml-0.5" aria-label="required">
            *
          </span>
        )}
      </label>
      {description && (
        <p className={`mt-0.5 text-xs ${disabled ? 'text-text-disabled' : 'text-text-muted'}`}>
          {description}
        </p>
      )}
    </div>
  );
}

export default Label;
