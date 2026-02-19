/**
 * NumberInput Component
 *
 * Premium numeric input with "Unified Capsule" design.
 * Features teal +/- buttons on each side with a recessed center
 * display showing the current value.
 *
 * @example
 * <NumberInput
 *   value={quantity}
 *   onChange={setQuantity}
 *   min={0}
 *   max={100}
 * />
 */

import { forwardRef, useState, useCallback } from 'react';

export interface NumberInputProps {
  /** Input element id for label association */
  id?: string;
  /** Current value (null shows placeholder) */
  value: number | null;
  /** Change handler (null when input is empty) */
  onChange: (value: number | null) => void;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show +/- buttons */
  showButtons?: boolean;
  /** Additional className */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      id,
      value,
      onChange,
      min,
      max,
      step = 1,
      disabled = false,
      error,
      size = 'md',
      showButtons = true,
      className = '',
      placeholder,
    },
    ref
  ) => {
    const [isDecrementHovered, setIsDecrementHovered] = useState(false);
    const [isIncrementHovered, setIsIncrementHovered] = useState(false);
    const hasError = Boolean(error);
    const currentValue = value ?? 0;

    const canDecrement = min === undefined || currentValue > min;
    const canIncrement = max === undefined || currentValue < max;

    const handleIncrement = useCallback(() => {
      if (disabled || !canIncrement) return;
      const newValue = currentValue + step;
      onChange(max !== undefined ? Math.min(newValue, max) : newValue);
    }, [disabled, canIncrement, currentValue, step, max, onChange]);

    const handleDecrement = useCallback(() => {
      if (disabled || !canDecrement) return;
      const newValue = currentValue - step;
      onChange(min !== undefined ? Math.max(newValue, min) : newValue);
    }, [disabled, canDecrement, currentValue, step, min, onChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      if (inputValue === '') {
        onChange(null);
        return;
      }
      const newValue = parseFloat(inputValue);
      if (!isNaN(newValue)) {
        if (min !== undefined && newValue < min) {
          onChange(min);
        } else if (max !== undefined && newValue > max) {
          onChange(max);
        } else {
          onChange(newValue);
        }
      }
    };

    // Size dimensions for Unified Capsule design
    // md height matches Select component's desktop height (~38px with py-2 padding)
    const dimensions = size === 'sm'
      ? { height: 32, buttonWidth: 28, minCenterWidth: 40, fontSize: 13, buttonFontSize: 14 }
      : { height: 38, buttonWidth: 38, minCenterWidth: 50, fontSize: 14, buttonFontSize: 18 };

    // App color palette
    const accentColor = '#14b8a6'; // Primary accent
    const accentHover = 'rgba(20, 184, 166, 0.08)'; // Hover background

    // If not showing buttons, render simple input
    if (!showButtons) {
      return (
        <div className={className}>
          <input
            ref={ref}
            id={id}
            type="number"
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            className={`
              h-10 w-full px-3 text-center rounded-lg
              bg-surface-elevated border border-border-default
              text-text-primary placeholder:text-text-muted
              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasError ? 'border-status-error focus-visible:ring-status-error/30' : 'focus-visible:border-accent'}
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
            `}
          />
          {error && <p className="mt-1.5 text-sm text-status-error">{error}</p>}
        </div>
      );
    }

    return (
      <div className={className}>
        {/* Unified Capsule Container */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'linear-gradient(180deg, var(--color-surface-card) 0%, var(--color-surface-raised) 100%)',
            borderRadius: 12,
            border: '1px solid var(--color-border-default)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
            overflow: 'hidden',
            height: dimensions.height,
            opacity: disabled ? 0.4 : 1,
          }}
        >
          {/* Decrement Button */}
          <button
            type="button"
            onClick={handleDecrement}
            disabled={disabled || !canDecrement}
            onMouseEnter={() => setIsDecrementHovered(true)}
            onMouseLeave={() => setIsDecrementHovered(false)}
            style={{
              width: dimensions.buttonWidth,
              height: '100%',
              border: 'none',
              background: isDecrementHovered && canDecrement && !disabled
                ? accentHover
                : 'transparent',
              color: !canDecrement || disabled
                ? 'var(--color-text-disabled)'
                : accentColor,
              fontSize: dimensions.buttonFontSize,
              fontWeight: 300,
              cursor: !canDecrement || disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              fontFamily: "var(--font-mono)",
            }}
            aria-label="Decrease value"
          >
            −
          </button>

          {/* Recessed Center Value Display */}
          <div
            style={{
              minWidth: dimensions.minCenterWidth,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.25)',
              borderLeft: '1px solid var(--color-border-subtle)',
              borderRight: '1px solid var(--color-border-subtle)',
              boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.3)',
              fontFamily: "var(--font-mono)",
              fontSize: dimensions.fontSize,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '0.02em',
              padding: '0 8px',
            }}
          >
            {/* Input for accessibility and keyboard input */}
            <input
              ref={ref}
              id={id}
              type="number"
              value={value ?? ''}
              onChange={handleChange}
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              placeholder={placeholder}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                textAlign: 'center',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                color: 'inherit',
                letterSpacing: 'inherit',
                appearance: 'textfield',
                MozAppearance: 'textfield',
              }}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
            />
          </div>

          {/* Increment Button */}
          <button
            type="button"
            onClick={handleIncrement}
            disabled={disabled || !canIncrement}
            onMouseEnter={() => setIsIncrementHovered(true)}
            onMouseLeave={() => setIsIncrementHovered(false)}
            style={{
              width: dimensions.buttonWidth,
              height: '100%',
              border: 'none',
              background: isIncrementHovered && canIncrement && !disabled
                ? accentHover
                : 'transparent',
              color: !canIncrement || disabled
                ? 'var(--color-text-disabled)'
                : accentColor,
              fontSize: dimensions.buttonFontSize,
              fontWeight: 300,
              cursor: !canIncrement || disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              fontFamily: "var(--font-mono)",
            }}
            aria-label="Increase value"
          >
            +
          </button>
        </div>

        {error && <p className="mt-1.5 text-sm text-status-error">{error}</p>}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

export default NumberInput;
