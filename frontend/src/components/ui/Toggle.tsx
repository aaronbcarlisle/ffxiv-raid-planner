/**
 * Toggle Component
 *
 * Premium toggle switch with "Recessed Orb" design.
 * Features a dark sphere that appears inset into a bright teal track when on,
 * and a subtle dark track when off.
 *
 * @example
 * <Toggle
 *   checked={enabled}
 *   onChange={setEnabled}
 *   label="Enable feature"
 *   hint="This enables the feature"
 * />
 */

import { forwardRef } from 'react';

export interface ToggleProps {
  /** Whether the toggle is checked/on */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** Optional label displayed next to toggle */
  label?: string;
  /** Optional hint/description text below label */
  hint?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
  /** Accessible label for screen readers (use when label is visual-only or hidden) */
  'aria-label'?: string;
  /** Optional custom color (hex) for checked state - overrides accent color */
  color?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      checked,
      onChange,
      label,
      hint,
      disabled = false,
      size = 'md',
      className = '',
      'aria-label': ariaLabel,
      color,
    },
    ref
  ) => {
    const handleClick = () => {
      if (!disabled) {
        onChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    // Size dimensions matching the reference design
    const dimensions = size === 'sm'
      ? { width: 40, height: 24, circleSize: 18, circleTop: 3, circleOffLeft: 3, circleOnLeft: 19 }
      : { width: 48, height: 28, circleSize: 22, circleTop: 3, circleOffLeft: 3, circleOnLeft: 23 };

    // Use app color palette - custom color overrides if provided
    // App primary: #14b8a6, hover: #2dd4bf, deep: #0891b2
    const accentColor = color || '#2dd4bf';     // Slightly brighter for toggle track // design-system-ignore
    const accentColorMid = color || '#14b8a6';  // Primary accent // design-system-ignore
    const accentColorDeep = color || '#0891b2'; // Gradient end // design-system-ignore

    return (
      <div
        className={`flex items-center gap-3 ${disabled ? 'opacity-40' : ''} ${className}`}
      >
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel || label}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base rounded-full"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            borderRadius: dimensions.height / 2,
            border: 'none',
            background: checked
              ? `linear-gradient(135deg, ${accentColor} 0%, ${accentColorMid} 50%, ${accentColorDeep} 100%)`
              : 'var(--color-surface-elevated)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: checked
              ? '0 0 16px rgba(20, 184, 166, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.15)'
              : 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.03)',
          }}
        >
          {/* The dark orb/circle - uses CSS custom properties for theme awareness */}
          <span
            style={{
              width: dimensions.circleSize,
              height: dimensions.circleSize,
              borderRadius: '50%',
              background: checked
                ? 'radial-gradient(circle at 35% 35%, var(--color-toggle-orb-on-start), var(--color-toggle-orb-on-end))'
                : 'linear-gradient(180deg, var(--color-toggle-orb-off-start), var(--color-toggle-orb-off-end))',
              position: 'absolute',
              top: dimensions.circleTop,
              left: checked ? dimensions.circleOnLeft : dimensions.circleOffLeft,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: checked
                ? '0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
                : '0 1px 4px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              border: checked
                ? '1px solid rgba(0, 0, 0, 0.2)'
                : '1px solid var(--color-border-default)',
            }}
          />
        </button>

        {(label || hint) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <span
                className={`text-sm font-medium transition-colors ${
                  checked ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {label}
              </span>
            )}
            {hint && (
              <span className="text-xs text-text-muted">
                {hint}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';

export default Toggle;
