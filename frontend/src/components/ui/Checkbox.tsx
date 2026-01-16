import { Check } from 'lucide-react';

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** Helper text shown below the label */
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ id, checked, onChange, label, description, disabled, className = '' }: CheckboxProps) {
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
      className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
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
      {/* Custom checkbox visual */}
      <div
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`
          w-4 h-4 rounded flex items-center justify-center
          border transition-colors
          ${checked
            ? 'bg-accent border-accent'
            : 'bg-surface-elevated border-border-default'
          }
          ${disabled
            ? 'cursor-not-allowed'
            : 'cursor-pointer hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-0'
          }
        `}
      >
        {checked && (
          <Check
            className="w-3 h-3 text-accent-contrast"
            strokeWidth={3}
          />
        )}
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
