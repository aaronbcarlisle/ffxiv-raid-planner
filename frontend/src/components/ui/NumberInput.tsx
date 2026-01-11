/**
 * NumberInput Component
 *
 * Numeric input with increment/decrement buttons.
 *
 * @example
 * <NumberInput
 *   value={quantity}
 *   onChange={setQuantity}
 *   min={0}
 *   max={100}
 * />
 */

import { forwardRef } from 'react';
import { Minus, Plus } from 'lucide-react';

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
    const hasError = Boolean(error);

    const currentValue = value ?? 0;

    const handleIncrement = () => {
      if (disabled) return;
      const newValue = currentValue + step;
      if (max === undefined || newValue <= max) {
        onChange(newValue);
      }
    };

    const handleDecrement = () => {
      if (disabled) return;
      const newValue = currentValue - step;
      if (min === undefined || newValue >= min) {
        onChange(newValue);
      }
    };

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

    const sizeStyles = {
      sm: 'h-8 text-sm',
      md: 'h-10 text-base',
    };

    const buttonSizeStyles = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
    };

    return (
      <div className={className}>
        <div className="flex items-center">
          {showButtons && (
            <button
              type="button"
              onClick={handleDecrement}
              disabled={disabled || (min !== undefined && currentValue <= min)}
              className={`
                ${buttonSizeStyles[size]}
                flex items-center justify-center
                bg-surface-elevated border border-border-default border-r-0
                rounded-l-lg
                text-text-secondary hover:text-text-primary hover:bg-surface-interactive
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              `}
            >
              <Minus className="w-4 h-4" />
            </button>
          )}

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
              ${sizeStyles[size]}
              ${showButtons ? 'rounded-none border-x-0' : 'rounded-lg'}
              w-full px-3 text-center
              bg-surface-elevated border border-border-default
              text-text-primary placeholder:text-text-muted
              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasError ? 'border-status-error focus-visible:ring-status-error/30' : 'focus-visible:border-accent'}
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
            `}
          />

          {showButtons && (
            <button
              type="button"
              onClick={handleIncrement}
              disabled={disabled || (max !== undefined && currentValue >= max)}
              className={`
                ${buttonSizeStyles[size]}
                flex items-center justify-center
                bg-surface-elevated border border-border-default border-l-0
                rounded-r-lg
                text-text-secondary hover:text-text-primary hover:bg-surface-interactive
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              `}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && <p className="mt-1.5 text-sm text-status-error">{error}</p>}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

export default NumberInput;
