import { Check } from 'lucide-react';

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ id, checked, onChange, label, disabled, className = '' }: CheckboxProps) {
  const handleClick = () => {
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
      onClick={(e) => e.preventDefault()}
    >
      {/* Hidden native checkbox for form compatibility */}
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
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
        onClick={handleClick}
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
            : 'cursor-pointer hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-0'
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
      {label && <span className="text-text-secondary text-sm">{label}</span>}
    </label>
  );
}
