/**
 * RadioGroup Component
 *
 * Accessible radio button group following design system patterns.
 *
 * @example
 * <RadioGroup
 *   name="mode"
 *   value={mode}
 *   onChange={setMode}
 *   options={[
 *     { value: 'create', label: 'Create New' },
 *     { value: 'copy', label: 'Copy Existing' },
 *   ]}
 * />
 */

import { useId } from 'react';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Unique name for the radio group */
  name: string;
  /** Currently selected value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Available options */
  options: RadioOption[];
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical';
  /** Disable all options */
  disabled?: boolean;
  /** Label for the group */
  label?: string;
  /** Error message */
  error?: string;
  /** Additional className */
  className?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  orientation = 'vertical',
  disabled = false,
  label,
  error,
  className = '',
}: RadioGroupProps) {
  const groupId = useId();

  return (
    <fieldset className={`${className}`} disabled={disabled}>
      {label && (
        <legend className="text-sm font-medium text-text-secondary mb-2">
          {label}
        </legend>
      )}

      <div
        className={`
        flex gap-3
        ${orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'}
      `}
      >
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          const isSelected = value === option.value;
          const isDisabled = disabled || option.disabled;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={`
                flex items-start gap-3 cursor-pointer
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {/* Container with h-5 to align with text line height */}
              <div className="flex items-center h-5">
                <div className="relative flex items-center justify-center">
                  <input
                    type="radio"
                    id={optionId}
                    name={name}
                    value={option.value}
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => !isDisabled && onChange(option.value)}
                    className="sr-only peer"
                  />
                  <div
                    className={`
                    w-4 h-4 rounded-full border-2 transition-all
                    ${
                      isSelected
                        ? 'border-accent bg-accent'
                        : 'border-border-default bg-surface-elevated'
                    }
                    ${!isDisabled && !isSelected ? 'hover:border-accent/50' : ''}
                    peer-focus:ring-2 peer-focus:ring-accent/30 peer-focus:ring-offset-2 peer-focus:ring-offset-surface-base
                  `}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-contrast" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <span
                  className={`text-sm ${isSelected ? 'text-text-primary font-medium' : 'text-text-secondary'}`}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className="text-sm text-text-muted mt-0.5 whitespace-pre-line">
                    {option.description}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error && <p className="mt-2 text-sm text-status-error">{error}</p>}
    </fieldset>
  );
}

export default RadioGroup;
