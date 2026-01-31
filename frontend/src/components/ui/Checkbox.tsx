import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  /** Helper text shown below the label */
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Accessible label for screen readers (use when label is visual-only or hidden) */
  'aria-label'?: string;
  /** Optional custom color (hex) for checked state - overrides accent color */
  color?: string;
}

export function Checkbox({ id, checked, onChange, label, description, disabled, className = '', 'aria-label': ariaLabel, color }: CheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent native checkbox behavior
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) {
        onChange(!checked);
      }
    }
  };

  return (
    <label
      className={`flex items-center gap-2 min-h-[44px] sm:min-h-0 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'} ${className}`}
      onClick={handleClick}
    >
      {/* Hidden native checkbox for form compatibility */}
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={() => {}} // Controlled by parent state
        disabled={disabled}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* Custom checkbox visual - touch-friendly wrapper on mobile */}
      <div
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`
          relative flex items-center justify-center
          min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0
          rounded
          ${disabled
            ? 'cursor-not-allowed'
            : 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
          }
        `}
      >
        {/* Visual checkbox - 16x16px */}
        <div
          className={`
            w-4 h-4 rounded flex items-center justify-center
            border transition-colors
            ${checked && !color
              ? 'bg-accent border-accent'
              : !checked
                ? 'bg-surface-elevated border-border-default'
                : ''
            }
            ${disabled
              ? ''
              : 'hover:border-accent/50'
            }
          `}
          style={checked && color ? { backgroundColor: color, borderColor: color } : undefined}
        >
          {checked && (
            <Check
              className="w-3 h-3 text-accent-contrast"
              strokeWidth={3}
            />
          )}
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-text-secondary text-sm">{label}</span>}
          {description && <span className="text-text-muted text-xs mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
}
